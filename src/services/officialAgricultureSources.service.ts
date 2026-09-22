import { supabase } from '../supabaseClient';

export type OfficialSourceStatus =
  | 'ready'
  | 'partial'
  | 'unavailable'
  | 'unsupported_crop'
  | 'needs_configuration'
  | 'no_data';

type JsonRecord = Record<string, any>;

async function invokeOfficialSource<T = JsonRecord>(
  functionName: string,
  body: JsonRecord = {},
): Promise<T> {
  if (!supabase) {
    throw new Error(
      'Resmî tarım veri kaynakları için Supabase bağlantısı hazır değil.',
    );
  }

  const { data, error } =
    await supabase.functions.invoke(
      functionName,
      { body },
    );

  if (error) {
    let message =
      error.message ||
      `${functionName} çağrısı başarısız oldu.`;

    try {
      if (error.context instanceof Response) {
        const payload = await error.context
          .clone()
          .json()
          .catch(() => null);

        if (payload?.error) {
          message = String(payload.error);
        }
      }
    } catch {
      // Network / body parse failure:
      // keep the original Supabase error.
    }

    throw new Error(message);
  }

  if (!data) {
    throw new Error(
      `${functionName} boş yanıt döndürdü.`,
    );
  }

  if (data.ok === false || data.success === false) {
    throw new Error(
      data.error ||
      `${functionName} kaynağı hazırlanamadı.`,
    );
  }

  return data as T;
}

export type TtsmVarietySourceResponse = {
  ok: boolean;
  status: OfficialSourceStatus;
  field_id: string | null;
  field: {
    name: string | null;
    crop: string | null;
  } | null;
  crop: string | null;
  crop_key: string | null;
  source: {
    authority: string;
    year: number;
    catalog_page: string;
    registration_page: string;
  };
  relevant_documents: Array<{
    title: string;
    url: string;
    source_page: string;
    kind:
      | 'catalog'
      | 'registration_report'
      | 'other';
  }>;
  all_document_count: number;
  note: string;
  production_authority: boolean;
  generated_at: string;
};

export async function fetchTtsmVarietySources(
  fieldId: string | number,
  crop?: string | null,
) {
  return invokeOfficialSource<TtsmVarietySourceResponse>(
    'ttsm-variety-sources',
    {
      field_id: String(fieldId),
      ...(String(crop ?? '').trim()
        ? { crop: String(crop).trim() }
        : {}),
    },
  );
}

export type MgmAgroEvidenceResponse = {
  ok: boolean;
  status: OfficialSourceStatus;
  field_id: string;
  field: {
    name: string | null;
    crop: string | null;
    city: string | null;
    district: string | null;
  };
  requestedCrop: string | null;
  source: string;
  frost: {
    sourceUrl: string;
    zdusUrl: string;
    fiveDayRiskMapsPublished: boolean;
    frostClasses: Array<{
      label: string;
      minC: number | null;
      maxC: number | null;
    }>;
    sourceChanged: boolean;
  };
  phenology: {
    crop: string;
    sourceUrl: string;
    stages: string[];
    sourceReachable: boolean;
    sourceChanged?: boolean;
    error?: string;
  } | null;
  supportedPhenologyCrops: string[];
  evidencePolicy: {
    officialSource: boolean;
    fieldSpecificMgmRiskParsed: boolean;
    role: string;
    rule: string;
  };
  warnings: string[];
  generated_at: string;
};

export async function fetchMgmAgroEvidence(
  fieldId: string | number,
  crop?: string | null,
) {
  return invokeOfficialSource<MgmAgroEvidenceResponse>(
    'mgm-agro-evidence',
    {
      field_id: String(fieldId),
      ...(String(crop ?? '').trim()
        ? { crop: String(crop).trim() }
        : {}),
    },
  );
}

export type BkuRegulationWatchResponse = {
  ok: boolean;
  status: OfficialSourceStatus;
  source: {
    authority: string;
    page: string;
  };
  latest_file?: {
    url: string;
    file_name: string;
    upload_type: string | null;
    uploaded_at: string | null;
    description: string | null;
    size: string | null;
  } | null;
  fingerprint?: string;
  changed_since_previous_snapshot?: boolean;
  first_snapshot?: boolean;
  change_summary?: {
    added_count: number;
    removed_count: number;
    added: string[];
    removed: string[];
  };
  active_ingredient_texts?: string[];
  parse_warning?: string | null;
  previous_snapshot_at?: string | null;
  current_snapshot_at?: string | null;
  production_authority?: boolean;
  note?: string;
};

export async function checkBkuRegulationWatch() {
  return invokeOfficialSource<BkuRegulationWatchResponse>(
    'bku-regulation-watch',
    {},
  );
}

export type UsdaPsdMarketContextResponse = {
  ok: boolean;
  status: OfficialSourceStatus;
  field_id?: string | null;
  crop: string;
  note?: string;
  source_url?: string;
  commodity?: {
    code: string;
    name: string;
  };
  market_year?: number | null;
  country_context?: {
    turkey: Array<JsonRecord>;
    all_countries: Array<JsonRecord>;
  };
  world_context?: unknown;
  source?: {
    authority: string;
    dataset: string;
    swagger: string;
  };
  role?: string;
  production_authority?: boolean;
  generated_at?: string;
};

export async function fetchUsdaPsdMarketContext(
  fieldId: string | number,
  crop?: string | null,
  marketYear?: number | null,
) {
  return invokeOfficialSource<UsdaPsdMarketContextResponse>(
    'usda-psd-market-context',
    {
      field_id: String(fieldId),
      ...(String(crop ?? '').trim()
        ? { crop: String(crop).trim() }
        : {}),
      ...(Number.isFinite(marketYear)
        ? { market_year: Number(marketYear) }
        : {}),
    },
  );
}

export type AdminSourceScanResponse = {
  success: boolean;
  provider: string;
  discovered?: number;
  found?: number;
  stored?: number;
  storedCandidates?: number;
  sources?: unknown[];
  sourceUrl?: string;
  sourceChanged?: boolean;
  publicationPolicy?: string;
  note?: string;
  [key: string]: unknown;
};

export async function scanAgrisKnowledge(
  query: string,
  options: {
    fromYear?: number;
    limit?: number;
  } = {},
) {
  const normalizedQuery =
    String(query ?? '').trim();

  if (normalizedQuery.length < 3) {
    throw new Error(
      'AGRIS araması en az 3 karakter olmalı.',
    );
  }

  return invokeOfficialSource<AdminSourceScanResponse>(
    'agris-knowledge-discovery',
    {
      query: normalizedQuery,
      ...(Number.isFinite(options.fromYear)
        ? { fromYear: Number(options.fromYear) }
        : {}),
      ...(Number.isFinite(options.limit)
        ? { limit: Number(options.limit) }
        : {}),
    },
  );
}

export async function scanTagemTechnicalGuidance() {
  return invokeOfficialSource<AdminSourceScanResponse>(
    'tagem-technical-guidance-source',
    {},
  );
}

export async function scanTepgeReports() {
  return invokeOfficialSource<AdminSourceScanResponse>(
    'tepge-report-source',
    {},
  );
}

export async function scanIrriRiceKnowledge() {
  return invokeOfficialSource<AdminSourceScanResponse>(
    'irri-rice-knowledge-source',
    {},
  );
}

export const OFFICIAL_AGRICULTURE_SOURCE_FUNCTIONS = {
  ttsm: 'ttsm-variety-sources',
  bkuWatch: 'bku-regulation-watch',
  mgm: 'mgm-agro-evidence',
  usdaPsd: 'usda-psd-market-context',
  agris: 'agris-knowledge-discovery',
  tagem: 'tagem-technical-guidance-source',
  tepge: 'tepge-report-source',
  irriRice: 'irri-rice-knowledge-source',
} as const;
