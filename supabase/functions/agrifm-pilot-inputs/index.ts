const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type RequestBody = { field_id?: string };
const MIN_OBSERVATIONS = 4;
const MAX_CLOUD_COVER = 30;
const CUBE_SCHEMA_VERSION = 1;
const REQUIRED_BANDS = ['B02', 'B03', 'B04', 'B08'] as const;
const PROCESS_URL = 'https://sh.dataspace.copernicus.eu/process/v1';
const CATALOG_URL = 'https://sh.dataspace.copernicus.eu/catalog/v1/search';
const TOKEN_URL = 'https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token';
const getCopernicusToken = async () => {
  const clientId = Deno.env.get('COPERNICUS_CLIENT_ID')?.trim();
  const clientSecret = Deno.env.get('COPERNICUS_CLIENT_SECRET')?.trim();
  if (!clientId || !clientSecret) throw new Error('copernicus_credentials_missing');
  const params = new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret });
  const response = await fetch(TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params });
  if (!response.ok) throw new Error('copernicus_auth_failed');
  const payload = await response.json();
  if (!payload?.access_token) throw new Error('copernicus_auth_failed');
  return String(payload.access_token);
};
const normalizeScene = (scene: any) => {
  const id = String(scene?.id ?? '').trim();
  const acquiredAt = String(scene?.properties?.datetime ?? scene?.properties?.start_datetime ?? '').trim();
  const cloud = Number(scene?.properties?.['eo:cloud_cover']);
  if (!id || !acquiredAt || Number.isNaN(new Date(acquiredAt).getTime())) return null;
  return { stac_item_id: id, acquired_at: new Date(acquiredAt).toISOString(), cloud_cover_percent: Number.isFinite(cloud) ? cloud : null };
};
const listScenes = async (token: string, geometry: Record<string, unknown>) => {
  const end = new Date();
  const start = new Date(end.getTime() - 365 * 86_400_000);
  const response = await fetch(CATALOG_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ collections: ['sentinel-2-l2a'], datetime: `${start.toISOString()}/${end.toISOString()}`, intersects: geometry, limit: 100 }),
  });
  if (!response.ok) throw new Error('copernicus_catalog_failed');
  const payload = await response.json();
  return Array.isArray(payload?.features) ? payload.features : [];
};
const CUBE_WIDTH = 64;
const CUBE_HEIGHT = 64;
const MAX_SELECTED_OBSERVATIONS = 12;
const MAX_CUBE_BYTES = 8 * 1024 * 1024;
const MAX_TOTAL_EVIDENCE_BYTES = 32 * 1024 * 1024;
const MULTIBAND_SCRIPT = `
//VERSION=3
function setup() {
  return { input: [{ bands: ["B02","B03","B04","B08","SCL","dataMask"] }], output: [{ id: "reflectance", bands: 4, sampleType: "FLOAT32" }, { id: "validMask", bands: 1, sampleType: "UINT8" }] };
}
function evaluatePixel(s) {
  const rejected = [0,1,3,8,9,10,11].includes(s.SCL);
  const valid = s.dataMask === 1 && !rejected;
  return { reflectance: valid ? [s.B02,s.B03,s.B04,s.B08] : [0,0,0,0], validMask: [valid ? 1 : 0] };
}
`;
const selectScenes = (raw: any[]) => {
  const normalized = raw.map(normalizeScene).filter(Boolean) as Array<{stac_item_id:string;acquired_at:string;cloud_cover_percent:number|null}>;
  const eligible = normalized.filter((s) => s.cloud_cover_percent === null || s.cloud_cover_percent <= MAX_CLOUD_COVER);
  eligible.sort((a,b) => a.acquired_at.localeCompare(b.acquired_at));
  const unique = new Map<string, typeof eligible[number]>();
  for (const scene of eligible) unique.set(`${scene.stac_item_id}|${scene.acquired_at}`, scene);
  return [...unique.values()].slice(-MAX_SELECTED_OBSERVATIONS);
};
const sceneDayRange = (iso: string) => {
  const day = iso.slice(0,10);
  return { from: `${day}T00:00:00Z`, to: `${day}T23:59:59Z` };
};
const fetchSceneTensor = async (token: string, geometry: Record<string, unknown>, acquiredAt: string) => {
  const timeRange = sceneDayRange(acquiredAt);
  const response = await fetch(PROCESS_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/tar' },
    body: JSON.stringify({
      input: { bounds: { geometry, properties: { crs: 'http://www.opengis.net/def/crs/OGC/1.3/CRS84' } }, data: [{ type: 'sentinel-2-l2a', dataFilter: { timeRange, mosaickingOrder: 'mostRecent', maxCloudCoverage: MAX_CLOUD_COVER } }] },
      output: { width: CUBE_WIDTH, height: CUBE_HEIGHT, responses: [{ identifier: 'reflectance', format: { type: 'image/tiff' } }, { identifier: 'validMask', format: { type: 'image/tiff' } }] },
      evalscript: MULTIBAND_SCRIPT,
    }),
  });
  if (!response.ok) throw new Error('copernicus_process_failed');
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!bytes.length || bytes.length > MAX_CUBE_BYTES) throw new Error('invalid_scene_tensor_payload');
  return bytes;
};
const encodeUtf8 = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));
const sha256Hex = async (bytes: Uint8Array) => {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((v) => v.toString(16).padStart(2,'0')).join('');
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const auth = req.headers.get('Authorization')?.trim();
  if (!auth) return json({ error: 'authentication_required' }, 401);
  let body: RequestBody;
  try { body = await req.json(); } catch { return json({ error: 'invalid_json' }, 400); }
  if (!body || Object.keys(body).some((key) => key !== 'field_id')) return json({ error: 'only_field_id_is_accepted' }, 400);
  const fieldId = String(body.field_id ?? '').trim();
  if (!fieldId) return json({ error: 'field_id_required' }, 400);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim();
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')?.trim();
  if (!supabaseUrl || !anonKey) return json({ error: 'server_configuration_missing' }, 500);
  const client = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: auth } } });
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData.user) return json({ error: 'authentication_required' }, 401);
  const { data: field, error: fieldError } = await client.from('fields').select('id,user_id,parcel_geometry').eq('id', fieldId).eq('user_id', userData.user.id).maybeSingle();
  if (fieldError) return json({ error: 'field_lookup_failed' }, 500);
  if (!field) return json({ error: 'field_not_found' }, 404);
  const geometry = field.parcel_geometry as Record<string, unknown> | null;
  const geometryType = geometry?.type === 'Feature' ? (geometry.geometry as Record<string, unknown> | undefined)?.type : geometry?.type;
  if (geometryType !== 'Polygon' && geometryType !== 'MultiPolygon') return json({ error: 'valid_stored_field_geometry_required' }, 409);

  let discoveredScenes = 0;
  let selectedScenes: Array<{stac_item_id:string;acquired_at:string;cloud_cover_percent:number|null}> = [];
  let token = '';
  try {
    token = await getCopernicusToken();
    const rawGeometry = geometry?.type === 'Feature' ? geometry.geometry as Record<string, unknown> : geometry;
    const scenes = await listScenes(token, rawGeometry as Record<string, unknown>);
    selectedScenes = selectScenes(scenes);
    discoveredScenes = selectedScenes.length;
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'copernicus_scene_discovery_failed' }, 502);
  }

  const sceneEvidence: Array<{stac_item_id:string;acquired_at:string;cloud_cover_percent:number|null;payload_sha256:string;payload_bytes:number}> = [];
  if (selectedScenes.length >= MIN_OBSERVATIONS) {
    const rawGeometry = geometry?.type === 'Feature' ? geometry.geometry as Record<string, unknown> : geometry as Record<string, unknown>;
    try {
      for (const scene of selectedScenes) {
        const bytes = await fetchSceneTensor(token, rawGeometry, scene.acquired_at);
        sceneEvidence.push({ ...scene, payload_sha256: await sha256Hex(bytes), payload_bytes: bytes.length });
      }
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : 'copernicus_process_failed' }, 502);
    }
  }

  const totalEvidenceBytes = sceneEvidence.reduce((sum, scene) => sum + scene.payload_bytes, 0);
  if (totalEvidenceBytes > MAX_TOTAL_EVIDENCE_BYTES) return json({ error: 'agrifm_evidence_payload_too_large' }, 413);
  const evidenceManifest = sceneEvidence.map(({ stac_item_id, acquired_at, payload_sha256, payload_bytes }) => ({ stac_item_id, acquired_at, payload_sha256, payload_bytes }));
  const manifestSha256 = sceneEvidence.length ? await sha256Hex(encodeUtf8({ field_id: fieldId, contract: 'sentinel2_l2a_temporal_cube_v1', scenes: evidenceManifest })) : null;

  return json({
    ok: false,
    status: 'blocked',
    field_id: fieldId,
    engine: 'agrifm',
    contract_version: 2,
    rollout: 'off',
    evidence_scope: 'research_only',
    production_authority: false,
    input_authority: 'server_derived_only',
    client_supplied_satellite_values_accepted: false,
    source: {
      collection: 'sentinel-2-l2a',
      provider: 'Copernicus Data Space Ecosystem',
      processing_level: 'L2A',
      temporal_order: 'ascending_acquisition_time',
      duplicate_acquisition_policy: 'reject',
      spatial_alignment: 'common_10m_grid',
      resampling_policy: 'explicit_per_band_required',
      missing_pixel_policy: 'mask_not_zero_fill',
      cube_fingerprint_required: true,
      fingerprint_algorithm: 'SHA-256',
      fingerprint_scope: 'pixels_mask_dates_scene_ids_geometry_contract',
      spatial_resolution_m: 10,
      cube_shape_policy: 'fixed_64x64_field_bbox',
      cube_width: CUBE_WIDTH,
      cube_height: CUBE_HEIGHT,
      maximum_cube_bytes: MAX_CUBE_BYTES,
      oversized_cube_policy: 'reject',
      geometry_authority: 'stored_field_geometry',
      client_geometry_accepted: false,
      required_bands: [...REQUIRED_BANDS],
      cube_schema_version: CUBE_SCHEMA_VERSION,
      pixel_dtype: 'float32',
      reflectance_scale: 'unitless_0_1',
      reflectance_range: [0, 1],
      invalid_reflectance_policy: 'reject_unmasked_out_of_range',
      minimum_observations: MIN_OBSERVATIONS,
      maximum_selected_observations: MAX_SELECTED_OBSERVATIONS,
      selection_policy: 'latest_eligible_unique_acquisitions',
      observation_identity: 'stac_item_id_plus_acquisition_time',
      provenance_required: ['stac_item_id', 'acquired_at', 'collection', 'provider'],
      maximum_scene_cloud_cover_percent: MAX_CLOUD_COVER,
      cloud_mask: 'SCL',
      scl_rejected_classes: [0, 1, 3, 8, 9, 10, 11],
    },
    scene_discovery: { lookback_days: 365, eligible_scene_count: discoveredScenes, minimum_required: MIN_OBSERVATIONS },
    scene_evidence: sceneEvidence,
    evidence_manifest_sha256: manifestSha256,
    total_evidence_bytes: totalEvidenceBytes,
    missing: discoveredScenes < MIN_OBSERVATIONS ? ['minimum_real_sentinel_observations', 'decoded_validated_temporal_cube'] : ['decoded_validated_temporal_cube'],
    note: 'AgriFM remains rollout=off until real cloud-masked multiband Sentinel-2 temporal cubes are produced server-side. NDVI aggregates are not substituted for model inputs.',
  }, 409);
});
