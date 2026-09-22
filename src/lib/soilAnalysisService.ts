import { supabase } from '../supabaseClient';

/* =========================================================
   TYPES
   ========================================================= */

export type SoilLabResult = {
  name: string;
  address?: string;
  phone?: string;
  latitude?: number;
  longitude?: number;
  distanceKm?: number;
  mapUrl?: string;
};

export type SoilAIResult = {
  soilSummary: string;
  cropInterpretation: string;
  attentionPoints: string[];
  recommendations: string[];

  values?: {
    ph?: string | number;
    ec?: string | number;
    organicMatter?: string | number;
    nitrogen?: string | number;
    phosphorus?: string | number;
    potassium?: string | number;
    lime?: string | number;
  };
};

export type SoilAnalysisRecord = {
  id: string;
  user_id?: string;

  field_id: string;
  field_name: string;

  crop?: string | null;

  report_path?: string | null;
  pdf_path?: string | null;

  report_file_name?: string | null;

  summary?: string | null;

  status?: 'good' | 'check' | 'alert' | 'unknown';
  status_label?: string | null;

  ai_result?: SoilAIResult | null;

  created_at: string;
};

type AnalyzeSoilReportParams = {
  file: File;

  field: {
    id: string;
    name: string;

    crop?: string;

    area?: number | null;

    ada?: string | number | null;
    parsel?: string | number | null;

    city?: string;
    district?: string;
    village?: string;
  };
};

type FindLabsParams = {
  latitude?: number | null;
  longitude?: number | null;

  city?: string;
  district?: string;
};

type ProvinceOption = {
  id: number;
  name: string;
};

type DistrictOption = {
  id: number;
  name: string;
};

/* =========================================================
   YARDIMCI
   ========================================================= */

function safeFileName(name: string) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .toLowerCase();
}

function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
) {
  const R = 6371;

  const dLat =
    ((lat2 - lat1) * Math.PI) / 180;

  const dLon =
    ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) *
      Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c =
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a),
    );

  return R * c;
}

/* =========================================================
   İLLER
   ========================================================= */

export async function loadProvinceOptions(): Promise<
  ProvinceOption[]
> {
  try {
    const response = await fetch(
      'https://turkiyeapi.dev/api/v1/provinces',
    );

    if (!response.ok) {
      throw new Error(
        'İller alınamadı.',
      );
    }

    const json = await response.json();

    const raw =
      json?.data ??
      json ??
      [];

    if (!Array.isArray(raw)) {
      return [];
    }

    return raw
      .map((item: any) => ({
        id: Number(
          item.id ??
            item.provinceId ??
            item.code,
        ),

        name: String(
          item.name ??
            item.province ??
            '',
        ),
      }))
      .filter(
        (item: ProvinceOption) =>
          Number.isFinite(item.id) &&
          item.name,
      )
      .sort((a: ProvinceOption, b: ProvinceOption) =>
        a.name.localeCompare(
          b.name,
          'tr',
        ),
      );
  } catch (error) {
    console.error(
      'İller yüklenemedi:',
      error,
    );

    throw new Error(
      'İl listesi şu anda alınamadı.',
    );
  }
}

/* =========================================================
   İLÇELER
   ========================================================= */

export async function loadDistrictOptions(
  provinceId: number,
): Promise<DistrictOption[]> {
  if (!provinceId) {
    return [];
  }

  try {
    const response = await fetch(
      `https://turkiyeapi.dev/api/v1/provinces/${provinceId}`,
    );

    if (!response.ok) {
      throw new Error(
        'İlçeler alınamadı.',
      );
    }

    const json = await response.json();

    const province =
      json?.data ??
      json;

    const raw =
      province?.districts ??
      province?.district ??
      [];

    if (!Array.isArray(raw)) {
      return [];
    }

    return raw
      .map(
        (
          item: any,
          index: number,
        ) => ({
          id: Number(
            item.id ??
              item.districtId ??
              index + 1,
          ),

          name: String(
            item.name ??
              item.district ??
              '',
          ),
        }),
      )
      .filter(
        (item: DistrictOption) =>
          item.name,
      )
      .sort(
        (
          a: DistrictOption,
          b: DistrictOption,
        ) =>
          a.name.localeCompare(
            b.name,
            'tr',
          ),
      );
  } catch (error) {
    console.error(
      'İlçeler yüklenemedi:',
      error,
    );

    throw new Error(
      'İlçe listesi şu anda alınamadı.',
    );
  }
}

/* =========================================================
   KONUMU YAZIYA ÇEVİR
   ========================================================= */

async function geocodeLocation(
  city: string,
  district: string,
): Promise<{
  lat: number;
  lng: number;
} | null> {
  const query = [
    district,
    city,
    'Türkiye',
  ]
    .filter(Boolean)
    .join(', ');

  if (!query) {
    return null;
  }

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=tr&q=${encodeURIComponent(
        query,
      )}`,
      {
        headers: {
          Accept: 'application/json',
        },
      },
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    if (
      !Array.isArray(data) ||
      !data.length
    ) {
      return null;
    }

    const lat = Number(
      data[0]?.lat,
    );

    const lng = Number(
      data[0]?.lon,
    );

    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng)
    ) {
      return null;
    }

    return {
      lat,
      lng,
    };
  } catch (error) {
    console.warn(
      'Konum koordinata çevrilemedi:',
      error,
    );

    return null;
  }
}

/* =========================================================
   YAKIN TOPRAK ANALİZ LABORATUVARLARI
   ========================================================= */

export async function findNearbySoilLabs({
  latitude,
  longitude,
  city = '',
  district = '',
}: FindLabsParams): Promise<
  SoilLabResult[]
> {
  let lat =
    latitude != null
      ? Number(latitude)
      : null;

  let lng =
    longitude != null
      ? Number(longitude)
      : null;

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng)
  ) {
    const geocoded =
      await geocodeLocation(
        city,
        district,
      );

    if (!geocoded) {
      throw new Error(
        'Seçilen konum haritada bulunamadı.',
      );
    }

    lat = geocoded.lat;
    lng = geocoded.lng;
  }

  const radius = 50000;

  const overpassQuery = `
[out:json][timeout:25];
(
  node["amenity"="laboratory"](around:${radius},${lat},${lng});
  way["amenity"="laboratory"](around:${radius},${lat},${lng});
  relation["amenity"="laboratory"](around:${radius},${lat},${lng});

  node["healthcare"="laboratory"](around:${radius},${lat},${lng});
  way["healthcare"="laboratory"](around:${radius},${lat},${lng});
  relation["healthcare"="laboratory"](around:${radius},${lat},${lng});

  node["name"~"toprak|soil|analiz|laboratuvar",i](around:${radius},${lat},${lng});
  way["name"~"toprak|soil|analiz|laboratuvar",i](around:${radius},${lat},${lng});
  relation["name"~"toprak|soil|analiz|laboratuvar",i](around:${radius},${lat},${lng});
);
out center tags;
`;

  try {
    const response = await fetch(
      'https://overpass-api.de/api/interpreter',
      {
        method: 'POST',

        headers: {
          'Content-Type':
            'application/x-www-form-urlencoded;charset=UTF-8',
        },

        body:
          'data=' +
          encodeURIComponent(
            overpassQuery,
          ),
      },
    );

    if (!response.ok) {
      throw new Error(
        'Laboratuvar servisine ulaşılamadı.',
      );
    }

    const data =
      await response.json();

    const elements =
      Array.isArray(
        data?.elements,
      )
        ? data.elements
        : [];

    const results =
      elements
        .map((element: any) => {
          const labLat =
            Number(
              element.lat ??
                element.center?.lat,
            );

          const labLng =
            Number(
              element.lon ??
                element.center?.lon,
            );

          if (
            !Number.isFinite(labLat) ||
            !Number.isFinite(labLng)
          ) {
            return null;
          }

          const tags =
            element.tags ?? {};

          const name =
            tags.name ||
            tags.operator ||
            'Analiz Laboratuvarı';

          const addressParts = [
            tags['addr:street'],
            tags['addr:housenumber'],
            tags['addr:suburb'],
            tags['addr:district'],
            tags['addr:city'],
          ].filter(Boolean);

          const address =
            addressParts.join(' ') ||
            tags.address ||
            '';

          const phone =
            tags.phone ||
            tags['contact:phone'] ||
            '';

          const distanceKm =
            calculateDistanceKm(
              Number(lat),
              Number(lng),
              labLat,
              labLng,
            );

          return {
            name,
            address,
            phone,
            latitude: labLat,
            longitude: labLng,
            distanceKm,

            mapUrl:
              `https://www.google.com/maps/search/?api=1&query=${labLat},${labLng}`,
          } satisfies SoilLabResult;
        })
        .filter(
          (
            item: SoilLabResult | null,
          ): item is SoilLabResult =>
            item !== null,
        )
        .sort(
          (a, b) =>
            (a.distanceKm ?? 9999) -
            (b.distanceKm ?? 9999),
        );

    const unique =
      new Map<
        string,
        SoilLabResult
      >();

    results.forEach(
      (item) => {
        const key =
          `${item.name}-${item.latitude}-${item.longitude}`;

        if (!unique.has(key)) {
          unique.set(
            key,
            item,
          );
        }
      },
    );

    return Array.from(
      unique.values(),
    ).slice(0, 12);
  } catch (error) {
    console.error(
      'Laboratuvar arama hatası:',
      error,
    );

    throw new Error(
      'Yakındaki laboratuvarlar şu anda getirilemedi.',
    );
  }
}

/* =========================================================
   KULLANICI
   ========================================================= */

async function requireUser() {
  const {
    data,
    error,
  } =
    await supabase.auth.getUser();

  if (error) {
    throw error;
  }

  if (!data.user) {
    throw new Error(
      'Bu işlem için giriş yapmalısın.',
    );
  }

  return data.user;
}

/* =========================================================
   ANALİZ GEÇMİŞİ
   ========================================================= */

export async function listSoilAnalyses(
  fieldId: string,
): Promise<
  SoilAnalysisRecord[]
> {
  const user =
    await requireUser();

  const {
    data,
    error,
  } = await supabase
    .from('soil_analyses')
    .select('*')
    .eq('user_id', user.id)
    .eq('field_id', fieldId)
    .order(
      'created_at',
      {
        ascending: false,
      },
    );

  if (error) {
    throw error;
  }

  return (
    data ?? []
  ) as SoilAnalysisRecord[];
}

/* =========================================================
   RAPORU STORAGE'A YÜKLE
   ========================================================= */

async function uploadSoilReport(
  file: File,
  userId: string,
  fieldId: string,
) {
  const extension =
    file.name
      .split('.')
      .pop()
      ?.toLowerCase() ||
    'bin';

  const baseName =
    safeFileName(
      file.name.replace(
        /\.[^/.]+$/,
        '',
      ),
    ) || 'soil-report';

  const path =
    `${userId}/${fieldId}/reports/` +
    `${Date.now()}-${baseName}.${extension}`;

  const {
    error,
  } = await supabase.storage
    .from('soil-analysis')
    .upload(
      path,
      file,
      {
        cacheControl: '3600',
        upsert: false,
        contentType:
          file.type ||
          undefined,
      },
    );

  if (error) {
    throw new Error(
      `Rapor yüklenemedi: ${error.message}`,
    );
  }

  return path;
}

/* =========================================================
   AI ANALİZ
   ========================================================= */

export async function analyzeSoilReport({
  file,
  field,
}: AnalyzeSoilReportParams): Promise<
  SoilAnalysisRecord
> {
  const user =
    await requireUser();

  let reportPath:
    | string
    | null = null;

  try {
    reportPath =
      await uploadSoilReport(
        file,
        user.id,
        field.id,
      );

    const {
      data,
      error,
    } =
      await supabase.functions.invoke(
        'soil-analysis',
        {
          body: {
            reportPath,

            reportFileName:
              file.name,

            reportMimeType:
              file.type,

            field: {
              id: field.id,
              name: field.name,

              crop:
                field.crop || '',

              area:
                field.area ?? null,

              ada:
                field.ada ?? null,

              parsel:
                field.parsel ??
                null,

              city:
                field.city || '',

              district:
                field.district ||
                '',

              village:
                field.village ||
                '',
            },
          },
        },
      );

    if (error) {
      throw new Error(
        error.message ||
          'AI servisi çalıştırılamadı.',
      );
    }

    if (!data) {
      throw new Error(
        'AI servisinden sonuç alınamadı.',
      );
    }

    if (data.error) {
      throw new Error(
        data.error,
      );
    }

    const record =
      data.record ??
      data.analysis ??
      data;

    if (!record?.id) {
      throw new Error(
        'AI sonucu oluşturuldu ancak kayıt bilgisi alınamadı.',
      );
    }

    return record as SoilAnalysisRecord;
  } catch (error) {
    console.error(
      'Toprak analizi hatası:',
      error,
    );

    throw error;
  }
}

/* =========================================================
   STORAGE DOSYASINI AÇ
   ========================================================= */

export async function getSoilAnalysisFileUrl(
  path: string,
) {
  if (!path) {
    throw new Error(
      'Dosya yolu bulunamadı.',
    );
  }

  const {
    data,
    error,
  } = await supabase.storage
    .from('soil-analysis')
    .createSignedUrl(
      path,
      60 * 30,
    );

  if (error) {
    throw new Error(
      `Dosya açılamadı: ${error.message}`,
    );
  }

  if (!data?.signedUrl) {
    throw new Error(
      'Dosya bağlantısı oluşturulamadı.',
    );
  }

  return data.signedUrl;
}