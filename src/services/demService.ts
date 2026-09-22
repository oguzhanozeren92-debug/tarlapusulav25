export type DemGridCell = {
  id: string;
  row: number;
  col: number;
  latitude: number;
  longitude: number;
  elevationM: number | null;
  slopeDeg: number | null;
  aspectDeg: number | null;
  aspectLabel: string;
};

export type DemTerrainProfile = {
  success: true;
  source: 'Copernicus DEM GLO-90';
  provider: 'Open-Meteo Elevation API';
  resolutionMeters: 90;
  requestedLatitude: number;
  requestedLongitude: number;
  generatedAt: string;
  gridSize: number;
  stepMeters: number;
  cells: DemGridCell[];
  stats: {
    centerElevationM: number | null;
    minElevationM: number | null;
    maxElevationM: number | null;
    reliefM: number | null;
    averageSlopeDeg: number | null;
    maxSlopeDeg: number | null;
    dominantAspect: string;
  };
};

const API_URL = 'https://api.open-meteo.com/v1/elevation';

function finite(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function round(value: number | null, digits = 1) {
  if (value === null || !Number.isFinite(value)) return null;
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

function aspectLabel(degrees: number | null) {
  if (degrees === null) return '—';
  const labels = ['K', 'KD', 'D', 'GD', 'G', 'GB', 'B', 'KB'];
  const normalized = ((degrees % 360) + 360) % 360;
  return labels[Math.round(normalized / 45) % 8];
}

function buildGrid(
  latitude: number,
  longitude: number,
  gridSize: number,
  stepMeters: number,
) {
  const half = Math.floor(gridSize / 2);
  const latStep = stepMeters / 111_320;
  const cosLat = Math.max(0.15, Math.cos((latitude * Math.PI) / 180));
  const lonStep = stepMeters / (111_320 * cosLat);

  return Array.from({ length: gridSize * gridSize }, (_, index) => {
    const row = Math.floor(index / gridSize);
    const col = index % gridSize;

    return {
      id: `${row}-${col}`,
      row,
      col,
      latitude: latitude + (row - half) * latStep,
      longitude: longitude + (col - half) * lonStep,
    };
  });
}

async function fetchElevations(
  points: Array<{ latitude: number; longitude: number }>,
  signal?: AbortSignal,
) {
  const params = new URLSearchParams({
    latitude: points.map((p) => p.latitude.toFixed(6)).join(','),
    longitude: points.map((p) => p.longitude.toFixed(6)).join(','),
  });

  const response = await fetch(`${API_URL}?${params.toString()}`, {
    method: 'GET',
    signal,
  });

  if (!response.ok) {
    throw new Error(`DEM yükseklik isteği başarısız: HTTP ${response.status}`);
  }

  const json = (await response.json()) as {
    elevation?: Array<number | null>;
    error?: boolean;
    reason?: string;
  };

  if (json.error) throw new Error(json.reason || 'DEM servisi hata döndürdü.');
  if (!Array.isArray(json.elevation)) {
    throw new Error('DEM servisi beklenen yükseklik dizisini döndürmedi.');
  }

  return json.elevation.map(finite);
}

function horn(
  z1: number, z2: number, z3: number,
  z4: number, _z5: number, z6: number,
  z7: number, z8: number, z9: number,
  size: number,
) {
  const dzdx =
    ((z3 + 2 * z6 + z9) - (z1 + 2 * z4 + z7)) / (8 * size);
  const dzdy =
    ((z7 + 2 * z8 + z9) - (z1 + 2 * z2 + z3)) / (8 * size);

  const slope =
    (Math.atan(Math.sqrt(dzdx * dzdx + dzdy * dzdy)) * 180) / Math.PI;

  if (slope < 0.15) {
    return { slope, aspect: null as number | null };
  }

  let aspect = (Math.atan2(dzdy, -dzdx) * 180) / Math.PI;

  if (aspect < 0) aspect = 90 - aspect;
  else if (aspect > 90) aspect = 360 - aspect + 90;
  else aspect = 90 - aspect;

  return {
    slope,
    aspect: ((aspect % 360) + 360) % 360,
  };
}

function avg(values: number[]) {
  return values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : null;
}

export async function fetchDemTerrainProfile(
  latitude: number,
  longitude: number,
  options?: {
    gridSize?: number;
    stepMeters?: number;
    signal?: AbortSignal;
  },
): Promise<DemTerrainProfile> {
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw new Error('DEM için geçerli bir enlem gerekli.');
  }

  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new Error('DEM için geçerli bir boylam gerekli.');
  }

  let gridSize = Math.max(5, Math.min(9, options?.gridSize ?? 9));
  if (gridSize % 2 === 0) gridSize -= 1;

  const stepMeters = Math.max(
    60,
    Math.min(180, options?.stepMeters ?? 90),
  );

  const points = buildGrid(
    latitude,
    longitude,
    gridSize,
    stepMeters,
  );

  const elevations = await fetchElevations(points, options?.signal);

  const matrix = Array.from({ length: gridSize }, () =>
    Array<number | null>(gridSize).fill(null),
  );

  points.forEach((point, index) => {
    matrix[point.row][point.col] = elevations[index] ?? null;
  });

  const cells: DemGridCell[] = points.map((point, index) => ({
    ...point,
    elevationM: elevations[index] ?? null,
    slopeDeg: null,
    aspectDeg: null,
    aspectLabel: '—',
  }));

  for (let row = 1; row < gridSize - 1; row += 1) {
    for (let col = 1; col < gridSize - 1; col += 1) {
      const z = [
        matrix[row - 1][col - 1],
        matrix[row - 1][col],
        matrix[row - 1][col + 1],
        matrix[row][col - 1],
        matrix[row][col],
        matrix[row][col + 1],
        matrix[row + 1][col - 1],
        matrix[row + 1][col],
        matrix[row + 1][col + 1],
      ];

      if (z.some((value) => value === null)) continue;

      const terrain = horn(
        ...(z as [
          number, number, number,
          number, number, number,
          number, number, number
        ]),
        stepMeters,
      );

      const cell = cells[row * gridSize + col];
      cell.slopeDeg = round(terrain.slope, 1);
      cell.aspectDeg = round(terrain.aspect, 0);
      cell.aspectLabel = aspectLabel(terrain.aspect);
    }
  }

  const elevationsValid = cells
    .map((cell) => cell.elevationM)
    .filter((value): value is number => value !== null);

  const slopes = cells
    .map((cell) => cell.slopeDeg)
    .filter((value): value is number => value !== null);

  const minElevationM = elevationsValid.length
    ? Math.min(...elevationsValid)
    : null;

  const maxElevationM = elevationsValid.length
    ? Math.max(...elevationsValid)
    : null;

  const aspectCounts = new Map<string, number>();

  cells.forEach((cell) => {
    if (cell.aspectDeg !== null) {
      aspectCounts.set(
        cell.aspectLabel,
        (aspectCounts.get(cell.aspectLabel) ?? 0) + 1,
      );
    }
  });

  const dominantAspect = aspectCounts.size
    ? [...aspectCounts.entries()].sort((a, b) => b[1] - a[1])[0][0]
    : 'Düz / belirsiz';

  return {
    success: true,
    source: 'Copernicus DEM GLO-90',
    provider: 'Open-Meteo Elevation API',
    resolutionMeters: 90,
    requestedLatitude: latitude,
    requestedLongitude: longitude,
    generatedAt: new Date().toISOString(),
    gridSize,
    stepMeters,
    cells,
    stats: {
      centerElevationM: round(
        cells[Math.floor(cells.length / 2)]?.elevationM ?? null,
        0,
      ),
      minElevationM: round(minElevationM, 0),
      maxElevationM: round(maxElevationM, 0),
      reliefM:
        minElevationM !== null && maxElevationM !== null
          ? round(maxElevationM - minElevationM, 0)
          : null,
      averageSlopeDeg: round(avg(slopes), 1),
      maxSlopeDeg: slopes.length ? round(Math.max(...slopes), 1) : null,
      dominantAspect,
    },
  };
}
