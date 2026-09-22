export type SpatialDirection =
  | 'kuzeybatı'
  | 'kuzey'
  | 'kuzeydoğu'
  | 'batı'
  | 'merkez'
  | 'doğu'
  | 'güneybatı'
  | 'güney'
  | 'güneydoğu';

export type SpatialFinding = {
  area: SpatialDirection;
  score: number;
  ndvi?: {
    relativeHealth: number;
    note: string;
  };
  radarVv?: {
    relativeBackscatter: number;
    note: string;
  };
  radarWater?: {
    blueRatio: number;
    note: string;
  };
  radarVh?: {
    relativeBackscatter: number;
    textureScore: number;
    note: string;
  };
  evidence: string[];
};

const GRID_DIRECTIONS: SpatialDirection[] = [
  'kuzeybatı',
  'kuzey',
  'kuzeydoğu',
  'batı',
  'merkez',
  'doğu',
  'güneybatı',
  'güney',
  'güneydoğu',
];

function clamp(value: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

async function loadImage(imageUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();

    if (!imageUrl.startsWith('data:')) {
      image.crossOrigin = 'anonymous';
    }

    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(new Error('Mekânsal analiz için harita görüntüsü okunamadı.'));
    image.src = imageUrl;
  });
}

function cellBounds(
  width: number,
  height: number,
  col: number,
  row: number,
) {
  const x0 = Math.floor((col / 3) * width);
  const x1 = Math.floor(((col + 1) / 3) * width);
  const y0 = Math.floor((row / 3) * height);
  const y1 = Math.floor(((row + 1) / 3) * height);

  return { x0, x1, y0, y1 };
}

function sampleCell(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  col: number,
  row: number,
) {
  const { x0, x1, y0, y1 } = cellBounds(width, height, col, row);

  let count = 0;
  let r = 0;
  let g = 0;
  let b = 0;
  let brightness = 0;
  let varianceSeed = 0;

  const stepX = Math.max(1, Math.floor((x1 - x0) / 28));
  const stepY = Math.max(1, Math.floor((y1 - y0) / 28));
  const values: number[] = [];

  for (let y = y0; y < y1; y += stepY) {
    for (let x = x0; x < x1; x += stepX) {
      const index = (y * width + x) * 4;
      const alpha = data[index + 3];
      if (alpha < 20) continue;

      const pr = data[index];
      const pg = data[index + 1];
      const pb = data[index + 2];
      const value = (pr + pg + pb) / 3;

      r += pr;
      g += pg;
      b += pb;
      brightness += value;
      values.push(value);
      count += 1;
    }
  }

  if (!count) {
    return {
      count: 0,
      r: 0,
      g: 0,
      b: 0,
      brightness: 0,
      texture: 0,
    };
  }

  const avgBrightness = brightness / count;

  for (const value of values) {
    varianceSeed += (value - avgBrightness) ** 2;
  }

  return {
    count,
    r: r / count,
    g: g / count,
    b: b / count,
    brightness: avgBrightness,
    texture: Math.sqrt(varianceSeed / Math.max(1, values.length)),
  };
}

async function readNineCells(imageUrl: string) {
  const image = await loadImage(imageUrl);
  const width = Math.max(180, Math.min(720, image.naturalWidth || image.width));
  const ratio =
    (image.naturalHeight || image.height) /
    Math.max(1, image.naturalWidth || image.width);
  const height = Math.max(180, Math.round(width * ratio));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    throw new Error('Harita görüntüsü analiz tuvali oluşturulamadı.');
  }

  ctx.drawImage(image, 0, 0, width, height);
  const imageData = ctx.getImageData(0, 0, width, height);

  return GRID_DIRECTIONS.map((area, index) => {
    const row = Math.floor(index / 3);
    const col = index % 3;

    return {
      area,
      ...sampleCell(imageData.data, width, height, col, row),
    };
  });
}

function normalizeRange(values: number[]) {
  const finite = values.filter(Number.isFinite);
  if (!finite.length) return values.map(() => 0.5);

  const min = Math.min(...finite);
  const max = Math.max(...finite);
  const spread = Math.max(0.000001, max - min);

  return values.map((value) => clamp((value - min) / spread));
}

export async function analyzeSpatialFieldImages(input: {
  ndviImage?: string | null;
  radarVvImage?: string | null;
  radarWaterImage?: string | null;
  radarVhImage?: string | null;
}): Promise<{
  findings: SpatialFinding[];
  importantArea: SpatialFinding | null;
  importantAreaByLayer: {
    vegetation: SpatialFinding | null;
    'radar-vv': SpatialFinding | null;
    'radar-vh': SpatialFinding | null;
    'radar-water': SpatialFinding | null;
  };
}> {
  const [ndviCells, vvCells, waterCells, vhCells] = await Promise.all([
    input.ndviImage
      ? readNineCells(input.ndviImage).catch(() => null)
      : Promise.resolve(null),
    input.radarVvImage
      ? readNineCells(input.radarVvImage).catch(() => null)
      : Promise.resolve(null),
    input.radarWaterImage
      ? readNineCells(input.radarWaterImage).catch(() => null)
      : Promise.resolve(null),
    input.radarVhImage
      ? readNineCells(input.radarVhImage).catch(() => null)
      : Promise.resolve(null),
  ]);

  const ndviHealthRaw =
    ndviCells?.map((cell) =>
      (cell.g - cell.r * 0.72 - cell.b * 0.08) / 255,
    ) ?? [];
  const ndviHealth = ndviCells ? normalizeRange(ndviHealthRaw) : [];

  // VV siyah-beyaz render olduğu için yalnızca göreli geri-saçılım farkını okuruz.
  // Bu değer tek başına "nem" veya "su" teşhisi değildir.
  const vvRaw = vvCells?.map((cell) => cell.brightness) ?? [];
  const vvScores = vvCells ? normalizeRange(vvRaw) : [];

  const waterRaw =
    waterCells?.map((cell) =>
      (cell.b - (cell.r + cell.g) / 2) / 255,
    ) ?? [];
  const waterScores = waterCells ? normalizeRange(waterRaw) : [];

  const vhBackscatterRaw = vhCells?.map((cell) => cell.brightness) ?? [];
  const vhBackscatter = vhCells ? normalizeRange(vhBackscatterRaw) : [];
  const vhTextureRaw = vhCells?.map((cell) => cell.texture) ?? [];
  const vhTexture = vhCells ? normalizeRange(vhTextureRaw) : [];

  const findings: SpatialFinding[] = GRID_DIRECTIONS.map((area, index) => {
    const evidence: string[] = [];
    let importance = 0;

    const finding: SpatialFinding = {
      area,
      score: 0,
      evidence,
    };

    if (ndviCells) {
      const health = ndviHealth[index] ?? 0.5;
      const stress = 1 - health;

      finding.ndvi = {
        relativeHealth: Number(health.toFixed(3)),
        note:
          stress > 0.68
            ? 'NDVI görünümünde çevresine göre daha zayıf'
            : health > 0.68
              ? 'NDVI görünümünde çevresine göre daha güçlü'
              : 'NDVI görünümünde belirgin olmayan fark',
      };

      if (stress > 0.68) {
        importance += stress * 0.34;
        evidence.push('NDVI çevresine göre zayıf');
      }
    }

    if (vvCells) {
      const vv = vvScores[index] ?? 0.5;
      const deviation = Math.abs(vv - 0.5) * 2;

      finding.radarVv = {
        relativeBackscatter: Number(vv.toFixed(3)),
        note:
          vv < 0.24
            ? 'VV görünümünde çevresine göre daha düşük geri saçılım'
            : vv > 0.76
              ? 'VV görünümünde çevresine göre daha yüksek geri saçılım'
              : 'VV görünümünde belirgin göreli fark yok',
      };

      if (deviation > 0.52) {
        importance += deviation * 0.18;
        evidence.push('VV göreli geri-saçılım farkı belirgin');
      }
    }

    if (waterCells) {
      const water = waterScores[index] ?? 0.5;

      finding.radarWater = {
        blueRatio: Number(water.toFixed(3)),
        note:
          water > 0.68
            ? 'Radar su görünümünde göreli su adayı sinyali daha yüksek'
            : 'Radar su görünümünde belirgin göreli artış yok',
      };

      if (water > 0.68) {
        importance += water * 0.30;
        evidence.push('radar su adayı sinyali yüksek');
      }
    }

    if (vhCells) {
      const backscatter = vhBackscatter[index] ?? 0.5;
      const texture = vhTexture[index] ?? 0.5;
      const intensityDifference = Math.abs(backscatter - 0.5) * 2;
      const structuralDifference = Math.max(intensityDifference, texture);

      finding.radarVh = {
        relativeBackscatter: Number(backscatter.toFixed(3)),
        textureScore: Number(texture.toFixed(3)),
        note:
          backscatter < 0.24
            ? 'VH görünümünde çevresine göre daha düşük geri saçılım'
            : backscatter > 0.76
              ? 'VH görünümünde çevresine göre daha yüksek geri saçılım'
              : texture > 0.7
                ? 'VH görünümünde çevresine göre daha değişken yapı'
                : 'VH görünümünde belirgin göreli fark yok',
      };

      if (structuralDifference > 0.52) {
        importance += structuralDifference * 0.18;
        evidence.push('VH göreli yapı farkı belirgin');
      }
    }

    finding.score = Number(importance.toFixed(3));
    return finding;
  });

  const ranked = [...findings].sort((a, b) => b.score - a.score);
  const importantArea =
    ranked[0] && ranked[0].score >= 0.32 ? ranked[0] : null;

  const pick = (
    scorer: (finding: SpatialFinding) => number,
    threshold: number,
  ) => {
    const ordered = [...findings]
      .map((finding) => ({ finding, value: scorer(finding) }))
      .sort((a, b) => b.value - a.value);

    return ordered[0] && ordered[0].value >= threshold
      ? ordered[0].finding
      : null;
  };

  const importantAreaByLayer = {
    vegetation: pick(
      (finding) => 1 - (finding.ndvi?.relativeHealth ?? 0.5),
      0.68,
    ),
    'radar-vv': pick(
      (finding) =>
        Math.abs((finding.radarVv?.relativeBackscatter ?? 0.5) - 0.5) * 2,
      0.52,
    ),
    'radar-vh': pick(
      (finding) => {
        const vh = finding.radarVh;
        if (!vh) return 0;
        return Math.max(
          Math.abs(vh.relativeBackscatter - 0.5) * 2,
          vh.textureScore,
        );
      },
      0.52,
    ),
    'radar-water': pick(
      (finding) => finding.radarWater?.blueRatio ?? 0,
      0.68,
    ),
  };

  return { findings, importantArea, importantAreaByLayer };
}
