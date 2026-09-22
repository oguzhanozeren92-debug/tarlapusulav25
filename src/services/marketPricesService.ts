import { supabase } from '../supabaseClient';

export type MarketLocation = {
  city?: string;
  district?: string;
  latitude?: number;
  longitude?: number;
  label: string;
};

export type MarketCropPrice = {
  id: string;
  product: string;
  marketName: string;
  city: string;
  district?: string;
  minPrice: number;
  avgPrice: number;
  maxPrice: number;
  unit: string;
  date: string;
  sourceName: string;
  sourceUrl?: string;
  latitude?: number | null;
  longitude?: number | null;
  distanceKm: number;
  quantity?: number | null;
  transactionCount?: number | null;
  transactionTotal?: number | null;
};

export type MarketFuelPrice = {
  id: string;
  provinceCode?: number | null;
  city: string;
  brand: string;
  fuelType: string;
  price: number;
  unit: string;
  date: string;
  sourceName: string;
};

export type MarketFuelProvinceSummary = {
  city: string;
  provinceCode?: number | null;
  date: string;
  minPrice: number;
  averagePrice: number;
  medianPrice: number;
  maxPrice: number;
  brandCount: number;
  unit: string;
  sourceName: string;
  rows: MarketFuelPrice[];
};

export type MarketFertilizerPrice = {
  id: string;
  product: string;
  price: number;
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
  unit: string;
  date: string;
  sourceName: string;
  sourceUrl?: string;
  region?: string;
  brand?: string | null;
  packageSize?: string | null;
  equivalent50Kg: number | null;
  equivalent25Kg: number | null;
};

export type MarketData = {
  cropPrices: MarketCropPrice[];
  fuelPrices: MarketFuelPrice[];
  fertilizerPrices: MarketFertilizerPrice[];
  dataSource: 'supabase' | 'unavailable';
  updatedAt: string | null;
};

const text = (value: unknown) => String(value ?? '').trim();

const toNumber = (value: unknown, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const toNullableNumber = (value: unknown) => {
  if (value === '' || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const pick = (row: Record<string, any>, keys: string[]) => {
  for (const key of keys) {
    const value = row?.[key];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return null;
};

export const normalizeMarketText = (value: unknown) =>
  String(value ?? '')
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/\s+/g, ' ')
    .trim();

const TURKISH_PROVINCES = [
  'Adana','Adıyaman','Afyonkarahisar','Ağrı','Amasya','Ankara','Antalya','Artvin','Aydın','Balıkesir','Bilecik','Bingöl','Bitlis','Bolu','Burdur','Bursa','Çanakkale','Çankırı','Çorum','Denizli','Diyarbakır','Edirne','Elazığ','Erzincan','Erzurum','Eskişehir','Gaziantep','Giresun','Gümüşhane','Hakkari','Hatay','Isparta','Mersin','İstanbul','İzmir','Kars','Kastamonu','Kayseri','Kırklareli','Kırşehir','Kocaeli','Konya','Kütahya','Malatya','Manisa','Kahramanmaraş','Mardin','Muğla','Muş','Nevşehir','Niğde','Ordu','Rize','Sakarya','Samsun','Siirt','Sinop','Sivas','Tekirdağ','Tokat','Trabzon','Tunceli','Şanlıurfa','Uşak','Van','Yozgat','Zonguldak','Aksaray','Bayburt','Karaman','Kırıkkale','Batman','Şırnak','Bartın','Ardahan','Iğdır','Yalova','Karabük','Kilis','Osmaniye','Düzce',
];

function provinceFromMarketName(marketName: string) {
  const haystack = normalizeMarketText(marketName);
  return (
    TURKISH_PROVINCES.find((province) =>
      haystack.includes(normalizeMarketText(province)),
    ) ?? ''
  );
}

function haversineKm(
  lat1?: number | null,
  lon1?: number | null,
  lat2?: number | null,
  lon2?: number | null,
) {
  if (
    !Number.isFinite(Number(lat1)) ||
    !Number.isFinite(Number(lon1)) ||
    !Number.isFinite(Number(lat2)) ||
    !Number.isFinite(Number(lon2))
  ) {
    return 9999;
  }

  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(Number(lat2) - Number(lat1));
  const dLon = toRad(Number(lon2) - Number(lon1));
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(Number(lat1))) *
      Math.cos(toRad(Number(lat2))) *
      Math.sin(dLon / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function normalizeCropRows(
  rows: Record<string, any>[],
  location: MarketLocation,
): MarketCropPrice[] {
  return rows
    .map((row, index) => {
      const product = text(pick(row, ['product_name', 'product', 'crop_name', 'urun_adi']));
      const marketName = text(pick(row, ['borsa_name', 'market_name', 'exchange_name', 'market']));
      const avgPrice = toNumber(pick(row, ['avg_price', 'average_price', 'price', 'ortalama_fiyat']));
      if (!product || !marketName || avgPrice <= 0) return null;

      const minPrice = toNumber(pick(row, ['min_price', 'minimum_price', 'en_dusuk']), avgPrice);
      const maxPrice = toNumber(pick(row, ['max_price', 'maximum_price', 'en_yuksek']), avgPrice);
      const latitude = toNullableNumber(pick(row, ['latitude', 'lat']));
      const longitude = toNullableNumber(pick(row, ['longitude', 'lng', 'lon']));
      const parsedCity = text(pick(row, ['city', 'province', 'il'])) || provinceFromMarketName(marketName) || 'Türkiye';
      const explicitDistance = toNullableNumber(pick(row, ['distance_km', 'distanceKm']));
      const sameCity =
        location.city && normalizeMarketText(parsedCity) === normalizeMarketText(location.city);

      const computedDistance = haversineKm(
        location.latitude,
        location.longitude,
        latitude,
        longitude,
      );

      return {
        id: text(row.id) || `crop-${index}-${normalizeMarketText(product)}-${normalizeMarketText(marketName)}`,
        product,
        marketName,
        city: parsedCity,
        district: text(pick(row, ['district', 'ilce'])) || undefined,
        minPrice: minPrice || avgPrice,
        avgPrice,
        maxPrice: maxPrice || avgPrice,
        unit: text(pick(row, ['unit', 'price_unit', 'birim'])) || 'TL/kg',
        date: text(pick(row, ['price_date', 'date', 'data_date', 'tarih'])) || '',
        sourceName: text(pick(row, ['source_name', 'source', 'kaynak'])) || 'TOBB',
        sourceUrl: text(pick(row, ['source_url'])) || undefined,
        latitude,
        longitude,
        distanceKm:
          explicitDistance ?? (sameCity ? 0 : computedDistance),
        quantity: toNullableNumber(pick(row, ['quantity', 'miktar'])),
        transactionCount: toNullableNumber(pick(row, ['transaction_count', 'islem_adedi'])),
        transactionTotal: toNullableNumber(pick(row, ['transaction_total', 'islem_tutari'])),
      } satisfies MarketCropPrice;
    })
    .filter(Boolean) as MarketCropPrice[];
}

function normalizeFuelRows(rows: Record<string, any>[]): MarketFuelPrice[] {
  return rows
    .map((row, index) => {
      const price = toNumber(pick(row, ['price', 'fiyat']));
      const city = text(pick(row, ['province_name', 'city', 'province', 'il']));
      const fuelType = text(pick(row, ['fuel_type', 'yakit_tipi'])) || 'Motorin';
      const brand = text(pick(row, ['brand', 'marka'])) || 'Marka belirtilmemiş';
      if (!price || !city) return null;

      return {
        id: text(row.id) || `fuel-${index}-${normalizeMarketText(city)}-${normalizeMarketText(brand)}`,
        provinceCode: toNullableNumber(pick(row, ['province_code', 'il_kodu'])),
        city,
        brand,
        fuelType,
        price,
        unit: text(pick(row, ['unit', 'price_unit', 'birim'])) || 'TL/L',
        date: text(pick(row, ['price_date', 'date', 'data_date', 'tarih'])) || '',
        sourceName: text(pick(row, ['source_name', 'source', 'kaynak'])) || 'EPDK',
      } satisfies MarketFuelPrice;
    })
    .filter(Boolean) as MarketFuelPrice[];
}

function normalizeFertilizerRows(
  rows: Record<string, any>[],
): MarketFertilizerPrice[] {
  return rows
    .map((row, index) => {
      const product = text(pick(row, ['product_name', 'product', 'fertilizer_name', 'urun_adi']));
      const price = toNumber(pick(row, ['price', 'avg_price', 'average_price', 'ortalama_fiyat']));
      if (!product || !price) return null;

      const unit = text(pick(row, ['unit', 'price_unit', 'birim'])) || 'TL/ton';
      const isTon = normalizeMarketText(unit).includes('ton');

      return {
        id: text(row.id) || `fert-${index}-${normalizeMarketText(product)}`,
        product,
        price,
        avgPrice: price,
        minPrice: price,
        maxPrice: price,
        unit,
        date: text(pick(row, ['price_date', 'date', 'data_date', 'tarih'])) || '',
        sourceName: text(pick(row, ['source_name', 'source', 'kaynak'])) || 'TZOB',
        sourceUrl: text(pick(row, ['source_url'])) || undefined,
        region: text(pick(row, ['region', 'bolge'])) || undefined,
        brand: text(pick(row, ['brand', 'marka'])) || null,
        packageSize: text(pick(row, ['package_size', 'ambalaj'])) || null,
        equivalent50Kg: isTon ? Number((price / 20).toFixed(2)) : null,
        equivalent25Kg: isTon ? Number((price / 40).toFixed(2)) : null,
      } satisfies MarketFertilizerPrice;
    })
    .filter(Boolean) as MarketFertilizerPrice[];
}

export function getLatestRowsByKey<T extends { date: string }>(
  rows: T[],
  keyFor: (row: T) => string,
): T[] {
  const map = new Map<string, T>();

  for (const row of rows) {
    const key = normalizeMarketText(keyFor(row));
    if (!key) continue;
    const current = map.get(key);

    if (
      !current ||
      new Date(row.date).getTime() > new Date(current.date).getTime()
    ) {
      map.set(key, row);
    }
  }

  return Array.from(map.values());
}

function referenceScore(row: MarketCropPrice) {
  const transactionTotal = Number(row.transactionTotal ?? 0);
  const quantity = Number(row.quantity ?? 0);
  const transactionCount = Number(row.transactionCount ?? 0);

  return transactionTotal * 1000000 + quantity * 1000 + transactionCount;
}

export function getFeaturedCropMarkets(
  rows: MarketCropPrice[],
  location: MarketLocation,
  _product: string,
) {
  if (!rows.length) return [];

  const uniqueByMarket = getLatestRowsByKey(rows, (row) => row.marketName);
  const localCity = normalizeMarketText(location.city);

  const nearest = [...uniqueByMarket].sort((a, b) => {
    const aLocal = localCity && normalizeMarketText(a.city) === localCity ? 0 : 1;
    const bLocal = localCity && normalizeMarketText(b.city) === localCity ? 0 : 1;
    if (aLocal !== bLocal) return aLocal - bLocal;

    const aDistance = Number.isFinite(a.distanceKm) ? a.distanceKm : 9999;
    const bDistance = Number.isFinite(b.distanceKm) ? b.distanceKm : 9999;
    if (aDistance !== bDistance) return aDistance - bDistance;

    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  const selected = nearest.slice(0, 2);
  const selectedNames = new Set(selected.map((row) => normalizeMarketText(row.marketName)));
  const remaining = uniqueByMarket.filter(
    (row) => !selectedNames.has(normalizeMarketText(row.marketName)),
  );

  const reference = [...remaining].sort((a, b) => {
    const score = referenceScore(b) - referenceScore(a);
    if (score !== 0) return score;
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  })[0];

  if (reference) selected.push(reference);
  return selected.slice(0, 3);
}

export function getFuelProvinceSummaries(
  rows: MarketFuelPrice[],
): MarketFuelProvinceSummary[] {
  const provinceNames = Array.from(new Set(rows.map((row) => row.city).filter(Boolean)));
  const result: MarketFuelProvinceSummary[] = [];

  for (const city of provinceNames) {
    const provinceRows = rows.filter(
      (row) => normalizeMarketText(row.city) === normalizeMarketText(city),
    );
    if (!provinceRows.length) continue;

    const latestDate = provinceRows
      .map((row) => row.date)
      .filter(Boolean)
      .sort()
      .at(-1);
    if (!latestDate) continue;

    const latestDay = latestDate.slice(0, 10);
    const latestRows = provinceRows.filter((row) => row.date.slice(0, 10) === latestDay);
    if (!latestRows.length) continue;

    const prices = latestRows.map((row) => row.price).filter(Number.isFinite).sort((a, b) => a - b);
    if (!prices.length) continue;

    const averagePrice = prices.reduce((sum, value) => sum + value, 0) / prices.length;
    const middle = Math.floor(prices.length / 2);
    const medianPrice =
      prices.length % 2
        ? prices[middle]
        : (prices[middle - 1] + prices[middle]) / 2;

    result.push({
      city,
      provinceCode: latestRows[0].provinceCode,
      date: latestRows[0].date,
      minPrice: prices[0],
      averagePrice,
      medianPrice,
      maxPrice: prices[prices.length - 1],
      brandCount: latestRows.length,
      unit: latestRows[0].unit,
      sourceName: latestRows[0].sourceName,
      rows: [...latestRows].sort((a, b) => a.price - b.price),
    });
  }

  return result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export async function fetchMarketData(
  location: MarketLocation,
): Promise<MarketData> {
  if (!supabase) {
    return {
      cropPrices: [],
      fuelPrices: [],
      fertilizerPrices: [],
      dataSource: 'unavailable',
      updatedAt: null,
    };
  }

  try {
    const [cropResult, fuelResult, fertilizerResult] = await Promise.all([
      supabase
        .from('market_crop_prices')
        .select('*')
        .order('price_date', { ascending: false })
        .limit(1500),
      supabase
        .from('market_fuel_prices')
        .select('*')
        .order('price_date', { ascending: false })
        .limit(1500),
      supabase
        .from('market_fertilizer_prices')
        .select('*')
        .order('price_date', { ascending: false })
        .limit(300),
    ]);

    if (cropResult.error) console.warn('TOBB fiyatları okunamadı:', cropResult.error);
    if (fuelResult.error) console.warn('EPDK fiyatları okunamadı:', fuelResult.error);
    if (fertilizerResult.error) console.warn('TZOB fiyatları okunamadı:', fertilizerResult.error);

    const cropPrices =
      !cropResult.error && cropResult.data
        ? normalizeCropRows(cropResult.data as Record<string, any>[], location)
        : [];

    let fuelPrices =
      !fuelResult.error && fuelResult.data
        ? normalizeFuelRows(fuelResult.data as Record<string, any>[])
        : [];

    const fertilizerPrices =
      !fertilizerResult.error && fertilizerResult.data
        ? normalizeFertilizerRows(fertilizerResult.data as Record<string, any>[])
        : [];

    if (location.city) {
      const city = normalizeMarketText(location.city);
      fuelPrices = [...fuelPrices].sort((a, b) => {
        const aLocal = normalizeMarketText(a.city) === city ? 0 : 1;
        const bLocal = normalizeMarketText(b.city) === city ? 0 : 1;
        if (aLocal !== bLocal) return aLocal - bLocal;
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });
    }

    const hasLiveData =
      cropPrices.length > 0 || fuelPrices.length > 0 || fertilizerPrices.length > 0;

    const dates = [
      ...cropPrices.map((row) => row.date),
      ...fuelPrices.map((row) => row.date),
      ...fertilizerPrices.map((row) => row.date),
    ]
      .filter(Boolean)
      .sort();

    return {
      cropPrices,
      fuelPrices,
      fertilizerPrices,
      dataSource: hasLiveData ? 'supabase' : 'unavailable',
      updatedAt: dates.at(-1) ?? null,
    };
  } catch (error) {
    console.warn('Piyasa verileri okunamadı:', error);
    return {
      cropPrices: [],
      fuelPrices: [],
      fertilizerPrices: [],
      dataSource: 'unavailable',
      updatedAt: null,
    };
  }
}
