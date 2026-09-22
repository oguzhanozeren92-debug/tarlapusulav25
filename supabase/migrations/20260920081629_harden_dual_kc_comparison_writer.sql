create or replace function public.save_dual_kc_production_comparison(
  p_run_id uuid,
  p_comparison jsonb
)
returns boolean
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'authentication_required'; end if;
  if p_comparison is null
     or jsonb_typeof(p_comparison) <> 'object'
     or coalesce(p_comparison->>'source', '') <> 'tarlapusula-production-irrigation-engine'
     or coalesce((p_comparison->>'production_authority')::boolean, true) <> false
  then raise exception 'invalid_comparison_payload'; end if;

  update public.model_engine_runs r
  set comparison = p_comparison, updated_at = now()
  where r.id = p_run_id and r.user_id = v_uid
    and r.engine = 'pyfao56' and r.mode = 'shadow'
    and r.status = 'completed' and r.completed_at is not null
    and (r.comparison is null or r.comparison = '{}'::jsonb);

  return found;
end;
$$;

grant update (comparison, updated_at) on public.model_engine_runs to authenticated;
drop policy if exists model_engine_runs_update_own_dual_kc_comparison on public.model_engine_runs;
create policy model_engine_runs_update_own_dual_kc_comparison
on public.model_engine_runs for update to authenticated
using ((select auth.uid()) = user_id and engine = 'pyfao56' and mode = 'shadow' and status = 'completed')
with check ((select auth.uid()) = user_id and engine = 'pyfao56' and mode = 'shadow' and status = 'completed');
