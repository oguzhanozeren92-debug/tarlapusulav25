export type Position = [number, number]

export type PolygonGeometry = {
  type: 'Polygon'
  coordinates: Position[][]
}

export type EarthSearchScene = {
  id: string
  datetime: string
  cloudCover: number | null
  collection: string
  geometry: unknown
  assets: Record<string, { href: string; type?: string; roles?: string[] }>
  redUrl: string | null
  nirUrl: string | null
  sclUrl: string | null
  thumbnailUrl: string | null
}

const EARTH_SEARCH_URL = 'https://earth-search.aws.element84.com/v1/search'

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function normalizeDateOnly(value: string | undefined) {
  const raw = String(value ?? '').trim()
  if (!raw) return null

  const direct = raw.match(/^\d{4}-\d{2}-\d{2}/)?.[0]
  if (direct) return direct

  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? null : isoDate(parsed)
}

function normalizeRing(ring: Position[]): Position[] {
  if (ring.length < 3) throw new Error('Tarla sınırı en az 3 nokta içermeli.')
  const first = ring[0]
  const last = ring[ring.length - 1]
  return first[0] === last[0] && first[1] === last[1] ? ring : [...ring, first]
}

function assetHref(assets: EarthSearchScene['assets'], keys: string[]): string | null {
  for (const key of keys) {
    const href = assets?.[key]?.href
    if (href) return href
  }
  return null
}

export async function findSentinel2Scenes(options: {
  ring: Position[]
  daysBack?: number
  maxCloudCover?: number
  limit?: number
  /**
   * Render edilen görüntünün tarihi biliniyorsa aynı günün COG sahnesini ara.
   * Böylece ekranda başka tarihin görüntüsü dururken başka tarihin istatistiği
   * gösterilmez.
   */
  date?: string
  signal?: AbortSignal
}): Promise<EarthSearchScene[]> {
  const {
    ring,
    daysBack = 45,
    maxCloudCover = 30,
    limit = 12,
    date,
    signal,
  } = options

  const requestedDate = normalizeDateOnly(date)

  let datetime: string

  if (requestedDate) {
    datetime = `${requestedDate}T00:00:00Z/${requestedDate}T23:59:59Z`
  } else {
    const end = new Date()
    const start = new Date(end)
    start.setUTCDate(start.getUTCDate() - daysBack)
    datetime = `${isoDate(start)}T00:00:00Z/${isoDate(end)}T23:59:59Z`
  }

  const intersects: PolygonGeometry = {
    type: 'Polygon',
    coordinates: [normalizeRing(ring)],
  }

  const response = await fetch(EARTH_SEARCH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      collections: ['sentinel-2-l2a'],
      intersects,
      datetime,
      query: { 'eo:cloud_cover': { lte: maxCloudCover } },
      limit,
      sortby: [{ field: 'properties.datetime', direction: 'desc' }],
    }),
    signal,
  })

  if (!response.ok) {
    throw new Error(`Earth Search isteği başarısız (${response.status}).`)
  }

  const data = await response.json()
  const features = Array.isArray(data?.features) ? data.features : []

  return features.map((item: any) => {
    const assets = item.assets ?? {}
    return {
      id: String(item.id),
      datetime: String(item.properties?.datetime ?? item.properties?.start_datetime ?? ''),
      cloudCover:
        typeof item.properties?.['eo:cloud_cover'] === 'number'
          ? item.properties['eo:cloud_cover']
          : null,
      collection: String(item.collection ?? 'sentinel-2-l2a'),
      geometry: item.geometry ?? null,
      assets,
      redUrl: assetHref(assets, ['red', 'B04']),
      nirUrl: assetHref(assets, ['nir', 'nir08', 'B08']),
      sclUrl: assetHref(assets, ['scl', 'SCL']),
      thumbnailUrl: assetHref(assets, ['thumbnail', 'visual']),
    }
  })
}

export async function findLatestSentinel2Scene(options: {
  ring: Position[]
  daysBack?: number
  maxCloudCover?: number
  date?: string
  signal?: AbortSignal
}): Promise<EarthSearchScene | null> {
  const scenes = await findSentinel2Scenes({ ...options, limit: 1 })
  return scenes[0] ?? null
}
