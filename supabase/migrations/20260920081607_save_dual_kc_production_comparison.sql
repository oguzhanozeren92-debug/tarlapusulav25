create or replace function public.save_dual_kc_production_comparison(
  p_run_id uuid,
  p_comparison jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_field_id uuid;
begin
  if v_uid is null then raise exception 'authentication_required'; end if;
  if p_comparison is null
     or jsonb_typeof(p_comparison) <> 'object'
     or coalesce(p_comparison->>'source', '') <> 'tarlapusula-production-irrigation-engine'
     or coalesce((p_comparison->>'production_authority')::boolean, true) <> false
  then raise exception 'invalid_comparison_payload'; end if;

  select r.field_id into v_field_id
  from public.model_engine_runs r
  where r.id = p_run_id and r.user_id = v_uid
    and r.engine = 'pyfao56' and r.mode = 'shadow'
    and r.status = 'completed' and r.completed_at is not null;

  if v_field_id is null then raise exception 'eligible_shadow_run_not_found'; end if;
  if not exists (select 1 from public.fields f where f.id = v_field_id and f.user_id = v_uid)
  then raise exception 'field_access_denied'; end if;

  update public.model_engine_runs
  set comparison = p_comparison, updated_at = now()
  where id = p_run_id and user_id = v_uid
    and (comparison is null or comparison = '{}'::jsonb);

  return found;
end;
$$;

revoke all on function public.save_dual_kc_production_comparison(uuid, jsonb) from public, anon;
grant execute on function public.save_dual_kc_production_comparison(uuid, jsonb) to authenticated;
