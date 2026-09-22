import './pusulaAssets.css';
import pusulaBody from './compass-body.webp';
import pusulaNeedle from './compass-needle-centered.webp';

/**
 * TarlaPusula marka varliklari uygulamanin icinden yuklenir.
 * Kritik Pusula logosu ag/Supabase baglantisina bagli degildir.
 */
export const PUSULA_BODY_SRC = pusulaBody;
export const PUSULA_NEEDLE_SRC = pusulaNeedle;

export const PUSULA_ASSETS = {
  body: PUSULA_BODY_SRC,
  needle: PUSULA_NEEDLE_SRC,
} as const;
