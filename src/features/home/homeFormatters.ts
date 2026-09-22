export function titleCaseEachWordTr(value: unknown) {
  const text = String(value ?? '');

  let result = '';
  let shouldUppercase = true;

  const separators = new Set([
    ' ',
    '\t',
    '\n',
    '\r',
    '–',
    '—',
    '/',
    '(',
    '[',
    '{',
    '"',
    "'",
    '“',
    '‘',
    '-',
  ]);

  for (const char of text) {
    if (shouldUppercase && char.trim()) {
      result += char.toLocaleUpperCase('tr-TR');
      shouldUppercase = false;
      continue;
    }

    result += char;

    if (separators.has(char)) {
      shouldUppercase = true;
    }
  }

  return result;
}

function formatSatelliteDateOnly(raw: string) {
  const isoParts = raw.split('-');

  if (
    isoParts.length >= 3 &&
    isoParts[0].length === 4 &&
    isoParts[1].length === 2 &&
    isoParts[2].slice(0, 2).length === 2
  ) {
    const year = isoParts[0];
    const month = isoParts[1];
    const day = isoParts[2].slice(0, 2);

    return `${day}.${month}.${year}`;
  }

  const normalized = raw.replaceAll('/', '.').replaceAll('-', '.');
  const trParts = normalized.split('.');

  if (trParts.length === 3 && trParts[2].length === 4) {
    const day = trParts[0].padStart(2, '0');
    const month = trParts[1].padStart(2, '0');
    const year = trParts[2];

    return `${day}.${month}.${year}`;
  }

  const date = new Date(raw);

  if (Number.isNaN(date.getTime())) {
    return raw;
  }

  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

export function formatHomeSatelliteDate(value: unknown) {
  const raw = String(value ?? '').trim();

  if (!raw) {
    return '';
  }

  const dateLabel = formatSatelliteDateOnly(raw);
  const scene =
    typeof window !== 'undefined'
      ? window.__tpHomeSatelliteSceneInfo
      : null;

  if (!scene || String(scene.latestImageDate ?? '').trim() !== raw) {
    return dateLabel;
  }

  const sourceLabel = String(scene.collection ?? '')
    .toLowerCase()
    .includes('sentinel-2')
    ? 'Sentinel-2'
    : String(scene.collection ?? '').trim();

  const cloudLabel =
    scene.cloudCover != null && Number.isFinite(Number(scene.cloudCover))
      ? ` · Bulut %${Math.round(Number(scene.cloudCover))}`
      : '';

  return `${dateLabel}${sourceLabel ? ` · ${sourceLabel}` : ''}${cloudLabel}`;
}
