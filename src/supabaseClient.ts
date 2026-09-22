import {
  createClient,
  type SupabaseClient,
} from '@supabase/supabase-js';

const env = import.meta.env;

/*
  Önce Vite .env değerlerini kullanır.
  .env yoksa TarlaPusula'nın kendi publishable
  Supabase bilgilerine fallback yapar.
*/
const DEFAULT_SUPABASE_URL =
  'https://xwyfidtktauxivsosmex.supabase.co';

const DEFAULT_SUPABASE_PUBLISHABLE_KEY =
  'sb_publishable_Ans_S4Zx2A1LXLT7FMfEZA_h-n-kfu_';

const rawSupabaseUrl = String(
  env.VITE_SUPABASE_URL ||
    env.VITE_SUPABASE_PROJECT_URL ||
    DEFAULT_SUPABASE_URL,
).trim();

const supabaseUrl = rawSupabaseUrl
  .replace(/\/rest\/v1\/?$/i, '')
  .replace(/\/+$/, '');

const supabaseKey = String(
  env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    env.VITE_SUPABASE_ANON_KEY ||
    env.VITE_SUPABASE_KEY ||
    DEFAULT_SUPABASE_PUBLISHABLE_KEY,
).trim();

export const isSupabaseConfigured = Boolean(
  supabaseUrl && supabaseKey,
);

export const supabaseConfigError = !supabaseUrl
  ? 'Supabase URL bulunamadı.'
  : !supabaseKey
    ? 'Supabase publishable key bulunamadı.'
    : '';

function createTarlaPusulaSupabaseClient(): SupabaseClient {
  if (!isSupabaseConfigured) {
    throw new Error(
      `TarlaPusula Supabase ayarları eksik: ${supabaseConfigError || 'bilinmeyen yapılandırma hatası'}`,
    );
  }

  try {
    const client = createClient(
      supabaseUrl,
      supabaseKey,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storageKey: 'tarlapusula-auth',
        },
      },
    );

    console.log(
      'TarlaPusula Supabase bağlantısı hazır:',
      supabaseUrl,
    );

    return client;
  } catch (error) {
    console.error(
      'Supabase istemcisi oluşturulamadı:',
      error,
    );

    throw error;
  }
}

/*
  Uygulamanın tamamı tek, geçerli Supabase istemcisi kullanır.
  Yapılandırma bozuksa null istemciyi uygulama boyunca taşımak yerine
  başlangıçta fail-fast davranırız.
*/
export const supabase: SupabaseClient = createTarlaPusulaSupabaseClient();
