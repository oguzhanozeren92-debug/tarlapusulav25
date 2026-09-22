const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  if (!req.headers.get('Authorization')?.trim()) return json({ error: 'authentication_required' }, 401);
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: 'invalid_json' }, 400); }
  if (!body || Object.keys(body).some((key) => key !== 'field_id')) return json({ error: 'only_field_id_is_accepted' }, 400);
  const fieldId = String(body.field_id ?? '').trim();
  if (!fieldId) return json({ error: 'field_id_required' }, 400);
  return json({
    ok: false,
    status: 'blocked',
    engine: 'agrifm',
    field_id: fieldId,
    contract_version: 2,
    required_input_contract: 'sentinel2_l2a_temporal_cube_v1',
    required_cube_schema_version: 1,
    required_fingerprint_algorithm: 'SHA-256',
    rollout: 'off',
    evidence_scope: 'research_only',
    production_authority: false,
    model_execution_attempted: false,
    missing: ['validated_server_side_multiband_temporal_cube', 'validated_model_weights'],
    note: 'AgriFM execution is deliberately disabled until real server-derived inputs and validated weights pass the promotion gate.',
  }, 409);
});
