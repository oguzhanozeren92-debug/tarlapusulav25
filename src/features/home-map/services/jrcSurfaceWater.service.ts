/**
 * EC JRC Global Surface Water v1.5 — 2024 release.
 *
 * This is a cartographic evidence layer, not an analytical flood model.
 * The public tile service renders Surface Water Occurrence for the full
 * 1984–2024 observation period. JRC documents the web tiles as suitable
 * for mapping/visualisation; quantitative analysis must use the source
 * raster products instead of reading values back from these RGB tiles.
 */
 export const JRC_SURFACE_WATER_OCCURRENCE = {
  product: 'Global Surface Water v1.5',
  layer: 'occurrence',
  period: '1984–2024',
  spatialResolution: '30 m',
  tileUrl:
    'https://storage.googleapis.com/water-world/tiles2024/occurrence/{z}/{x}/{y}.png',
  maxZoom: 13,
  attribution: 'Source: EC JRC/Google',
  productionAuthority: false,
  analyticalAuthority: false,
  purpose:
    'Tarihsel açık yüzey suyu gözlemini harita bağlamı olarak göstermek.',
  caution:
    'Bugünkü su varlığı, drenaj kapasitesi veya gelecekteki sel riski değildir.',
} as const;

export type JrcSurfaceWaterOccurrenceConfig =
  typeof JRC_SURFACE_WATER_OCCURRENCE;
