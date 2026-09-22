import type {
  FieldOperation,
} from '../types/fieldOperation';

export type OpenAgriOcsmOperationType =
  | 'IrrigationOperation'
  | 'FertilizationOperation'
  | 'ChemicalControlOperation';

export type OpenAgriOcsmDocument = {
  '@context': ['https://w3id.org/ocsm/main-context.jsonld'];
  '@graph': Array<Record<string, unknown>>;
};

export type OpenAgriOcsmMappingResult = {
  mapped: boolean;
  source: 'OpenAgri OCSM';
  operationId: string;
  operationType: OpenAgriOcsmOperationType | null;
  document: OpenAgriOcsmDocument | null;
  warnings: string[];
};

const CACHE_PREFIX = 'tp_openagri_ocsm_operations_v1:';
const MAX_CACHED_OPERATIONS = 200;
const OCSM_CONTEXT = 'https://w3id.org/ocsm/main-context.jsonld' as const;

function clean(value: unknown) {
  const text = String(value ?? '').trim();
  return text || null;
}

function finite(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function timestamp(date: string) {
  const normalized = String(date ?? '').trim();
  if (!normalized) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return `${normalized}T12:00:00`;
  }

  const parsed = Date.parse(normalized);
  if (!Number.isFinite(parsed)) return normalized;

  return new Date(parsed).toISOString();
}

function safeUrnPart(value: unknown) {
  return encodeURIComponent(String(value ?? '').trim() || 'unknown');
}

function parcelUrn(fieldId: string) {
  return `urn:tarlapusula:parcel:${safeUrnPart(fieldId)}`;
}

function operationUrn(prefix: string, operationId: string) {
  return `urn:tarlapusula:openagri:${prefix}:${safeUrnPart(operationId)}`;
}

function qudtUnit(value: string | null) {
  const unit = String(value ?? '')
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/\s+/g, '');

  const known: Record<string, string> = {
    kg: 'http://qudt.org/vocab/unit/KiloGM',
    g: 'http://qudt.org/vocab/unit/GM',
    gr: 'http://qudt.org/vocab/unit/GM',
    gram: 'http://qudt.org/vocab/unit/GM',
    l: 'http://qudt.org/vocab/unit/L',
    lt: 'http://qudt.org/vocab/unit/L',
    litre: 'http://qudt.org/vocab/unit/L',
    litreler: 'http://qudt.org/vocab/unit/L',
    ml: 'http://qudt.org/vocab/unit/MilliL',
    m3: 'http://qudt.org/vocab/unit/M3',
    'm³': 'http://qudt.org/vocab/unit/M3',
    mm: 'http://qudt.org/vocab/unit/MilliM',
    saat: 'http://qudt.org/vocab/unit/HR',
    hour: 'http://qudt.org/vocab/unit/HR',
    hours: 'http://qudt.org/vocab/unit/HR',
  };

  return known[unit] ?? null;
}

function quantityValue(
  operation: FieldOperation,
  prefix: string,
) {
  const quantity = finite(operation.quantity);
  if (quantity === null) return null;

  const rawUnit = clean(operation.unit);
  const mappedUnit = qudtUnit(rawUnit);

  return {
    '@id': operationUrn(`${prefix}:amount`, operation.id),
    '@type': 'QuantityValue',
    numericValue: quantity,
    ...(mappedUnit
      ? { unit: mappedUnit }
      : rawUnit
        ? { unitText: rawUnit }
        : {}),
  };
}

function baseDescription(operation: FieldOperation) {
  return (
    clean(operation.notes) ??
    clean(operation.title) ??
    String(operation.type || 'Tarla işlemi')
  );
}

function irrigationGraph(operation: FieldOperation) {
  const amount = quantityValue(operation, 'irrigation');

  return {
    '@id': operationUrn('irrigation', operation.id),
    '@type': 'IrrigationOperation',
    description: baseDescription(operation),
    startedAt: timestamp(operation.date),
    endedAt: timestamp(operation.date),
    ...(amount ? { hasAppliedAmount: amount } : {}),
    isOperatedOn: parcelUrn(operation.fieldId),
  };
}

function fertilizationGraph(operation: FieldOperation) {
  const amount = quantityValue(operation, 'fertilization');
  const product = clean(operation.productName);

  return {
    '@id': operationUrn('fertilization', operation.id),
    '@type': 'FertilizationOperation',
    description: baseDescription(operation),
    hasTimestamp: timestamp(operation.date),
    ...(product
      ? {
          usesFertilizer: {
            '@id': operationUrn('fertilization:product', operation.id),
            '@type': 'Fertilizer',
            hasCommercialName: product,
          },
        }
      : {}),
    ...(amount ? { hasAppliedAmount: amount } : {}),
    isOperatedOn: parcelUrn(operation.fieldId),
  };
}

function chemicalControlGraph(operation: FieldOperation) {
  const amount = quantityValue(operation, 'pestMgmt');
  const product = clean(operation.productName);

  return {
    '@id': operationUrn('pestMgmt', operation.id),
    '@type': 'ChemicalControlOperation',
    description: baseDescription(operation),
    hasTimestamp: timestamp(operation.date),
    ...(product
      ? {
          usesPesticide: {
            '@id': operationUrn('pestMgmt:pesticide', operation.id),
            '@type': 'Pesticide',
            hasCommercialName: product,
          },
        }
      : {}),
    ...(amount ? { hasAppliedAmount: amount } : {}),
    isOperatedOn: parcelUrn(operation.fieldId),
  };
}

export function mapFieldOperationToOpenAgriOcsm(
  operation: FieldOperation,
): OpenAgriOcsmMappingResult {
  const warnings: string[] = [];
  let operationType: OpenAgriOcsmOperationType | null = null;
  let graph: Record<string, unknown> | null = null;

  if (operation.type === 'Sulama') {
    operationType = 'IrrigationOperation';
    graph = irrigationGraph(operation);
  } else if (operation.type === 'Gübreleme') {
    operationType = 'FertilizationOperation';
    graph = fertilizationGraph(operation);
  } else if (operation.type === 'İlaçlama') {
    operationType = 'ChemicalControlOperation';
    graph = chemicalControlGraph(operation);
  }

  if (!graph || !operationType) {
    return {
      mapped: false,
      source: 'OpenAgri OCSM',
      operationId: operation.id,
      operationType: null,
      document: null,
      warnings: [
        `${operation.type} için doğrulanmış OpenAgri OCSM işlem eşlemesi henüz tanımlı değil; sentetik sınıf üretilmedi.`,
      ],
    };
  }

  if (operation.quantity != null && operation.unit && !qudtUnit(operation.unit)) {
    warnings.push(
      `"${operation.unit}" birimi QUDT URI'sine güvenle eşlenemedi; özgün birim metni korundu.`,
    );
  }

  if (
    (operation.type === 'Gübreleme' || operation.type === 'İlaçlama') &&
    !clean(operation.productName)
  ) {
    warnings.push(
      'Ürün/ticari ad kaydedilmediği için OCSM ürün nesnesi oluşturulmadı.',
    );
  }

  return {
    mapped: true,
    source: 'OpenAgri OCSM',
    operationId: operation.id,
    operationType,
    document: {
      '@context': [OCSM_CONTEXT],
      '@graph': [graph],
    },
    warnings,
  };
}

export function appendOpenAgriOcsmSnapshot(
  operation: FieldOperation,
) {
  const mapped = mapFieldOperationToOpenAgriOcsm(operation);

  if (!mapped.mapped || !mapped.document || typeof window === 'undefined') {
    return mapped;
  }

  const key = `${CACHE_PREFIX}${operation.fieldId}`;

  try {
    const raw = window.localStorage.getItem(key);
    const existing = raw
      ? (JSON.parse(raw) as OpenAgriOcsmDocument)
      : {
          '@context': [OCSM_CONTEXT] as [typeof OCSM_CONTEXT],
          '@graph': [],
        };

    const currentGraph = Array.isArray(existing?.['@graph'])
      ? existing['@graph']
      : [];

    const incoming = mapped.document['@graph'][0];
    const incomingId = String(incoming?.['@id'] ?? '');

    const withoutSame = currentGraph.filter(
      (item) => String(item?.['@id'] ?? '') !== incomingId,
    );

    const next: OpenAgriOcsmDocument = {
      '@context': [OCSM_CONTEXT],
      '@graph': [...withoutSame, incoming].slice(-MAX_CACHED_OPERATIONS),
    };

    window.localStorage.setItem(key, JSON.stringify(next));
  } catch (error) {
    console.warn('[OpenAgri OCSM] Yerel işlem aynası yazılamadı:', error);
  }

  return mapped;
}

export function readOpenAgriOcsmSnapshot(
  fieldId: string,
): OpenAgriOcsmDocument {
  const empty: OpenAgriOcsmDocument = {
    '@context': [OCSM_CONTEXT],
    '@graph': [],
  };

  if (typeof window === 'undefined') return empty;

  try {
    const raw = window.localStorage.getItem(
      `${CACHE_PREFIX}${String(fieldId ?? '').trim()}`,
    );

    if (!raw) return empty;

    const parsed = JSON.parse(raw) as OpenAgriOcsmDocument;

    return {
      '@context': [OCSM_CONTEXT],
      '@graph': Array.isArray(parsed?.['@graph'])
        ? parsed['@graph']
        : [],
    };
  } catch {
    return empty;
  }
}

export function buildOpenAgriOcsmDocument(
  operations: FieldOperation[],
) {
  const mapped = operations
    .map(mapFieldOperationToOpenAgriOcsm)
    .filter(
      (result) => result.mapped && result.document,
    );

  return {
    source: 'OpenAgri OCSM' as const,
    schemaContext: OCSM_CONTEXT,
    mappedCount: mapped.length,
    skippedCount: Math.max(0, operations.length - mapped.length),
    document: {
      '@context': [OCSM_CONTEXT],
      '@graph': mapped.flatMap(
        (result) => result.document?.['@graph'] ?? [],
      ),
    } satisfies OpenAgriOcsmDocument,
    warnings: mapped.flatMap((result) => result.warnings),
  };
}
