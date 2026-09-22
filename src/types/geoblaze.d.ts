declare module 'georaster' {
  type GeoRasterMetadata = {
    noDataValue?: number | null;
    projection?: number | string;
    xmin?: number;
    xmax?: number;
    ymin?: number;
    ymax?: number;
    pixelWidth?: number;
    pixelHeight?: number;
    [key: string]: unknown;
  };

  type GeoRaster = {
    noDataValue?: number | null;
    projection?: number | string;
    xmin: number;
    xmax: number;
    ymin: number;
    ymax: number;
    pixelWidth: number;
    pixelHeight: number;
    width: number;
    height: number;
    numberOfRasters?: number;
    values?: unknown;
    [key: string]: unknown;
  };

  type ParseGeoRaster = (
    valuesOrSource: unknown,
    metadata?: GeoRasterMetadata,
  ) => GeoRaster | Promise<GeoRaster>;

  const parseGeoraster: ParseGeoRaster;
  export default parseGeoraster;
}

declare module 'geoblaze' {
  type GeoBlazeGeometry =
    | unknown
    | {
        geometry: unknown;
        srs: number | string;
        densify?: number;
      };

  type GeoBlazeExtraOptions = {
    debug_level?: number;
    include_meta?: boolean;
    rescale?: boolean;
    vrm?: number | [number, number] | 'minimal';
  };

  type GeoBlazeApi = {
    stats: (
      georaster: unknown,
      geometry?: GeoBlazeGeometry,
      calcStatsOptions?: unknown,
      test?: ((value: number) => boolean) | undefined,
      extraOptions?: GeoBlazeExtraOptions,
    ) => Promise<any[]>;
    parse: (source: unknown) => Promise<any>;
    mean: (georaster: unknown, geometry?: GeoBlazeGeometry) => Promise<number[]>;
    min: (georaster: unknown, geometry?: GeoBlazeGeometry) => Promise<number[]>;
    max: (georaster: unknown, geometry?: GeoBlazeGeometry) => Promise<number[]>;
    median: (georaster: unknown, geometry?: GeoBlazeGeometry) => Promise<number[]>;
    identify: (georaster: unknown, geometry?: unknown) => Promise<number[]>;
  };

  const geoblaze: GeoBlazeApi;
  export default geoblaze;
}
