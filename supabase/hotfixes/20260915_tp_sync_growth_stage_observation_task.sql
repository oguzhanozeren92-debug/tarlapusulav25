-- LIVE HOTFIX SOURCE
--
-- This function was installed on the live Supabase project with execute_sql because
-- the migration runner rejected the function body before execution. It is kept
-- outside supabase/migrations intentionally so repository history does not claim
-- a migration version that is absent from the live migration table.
--
-- Reconcile this idempotent SQL into a normal migration when migration history is
-- backfilled/normalized.

create or replace function public.tp_sync_growth_stage_observation_task(p_field_id uuid)
returns setof public.field_todos
language plpgsql
security invoker
set search_path to 'public'
as $function$
declare
  v_user uuid := auth.uid();
  v_field public.fields%rowtype;
  v_crop text := '';
  v_has_kcb_reference boolean := false;
  v_snapshot_date date;
  v_stage text;
  v_stage_label text;
  v_task_key text;
  v_has_match boolean := false;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;

  select * into v_field from public.fields
  where id = p_field_id and user_id = v_user;
  if not found then raise exception 'field_not_found'; end if;

  v_crop := lower(trim(coalesce(v_field.crop, '')));

  select exists(
    select 1 from public.crop_water_reference_profiles p
    where (
      lower(trim(p.display_name)) = v_crop
      or exists (
        select 1 from unnest(coalesce(p.aliases, '{}'::text[])) a
        where lower(trim(a)) = v_crop
      )
    )
    and (
      p.crop_subtype is null
      or lower(trim(p.crop_subtype)) = lower(trim(coalesce(v_field.crop_subtype, '')))
    )
  ) into v_has_kcb_reference;

  select s.snapshot_date, lower(trim(coalesce(s.phenology_stage, ''))), s.stage_label
  into v_snapshot_date, v_stage, v_stage_label
  from public.field_irrigation_kc_snapshots s
  where s.user_id = v_user and s.field_id = p_field_id
  order by s.snapshot_date desc, s.calculated_at desc
  limit 1;

  if v_has_kcb_reference
     and v_snapshot_date = ((now() at time zone 'UTC')::date)
     and v_stage in (
       'pre_sowing','establishment','vegetative','reproductive','maturation','harvest_window','post_harvest',
       'dormancy','bud_swell','bud_break','flowering','fruit_set','fruit_growth','veraison','leaf_fall'
     ) then
    v_task_key := 'model-growth-stage-observation:' || v_snapshot_date::text;

    select exists(
      select 1 from public.field_growth_observations o
      where o.user_id = v_user
        and o.field_id = p_field_id
        and o.observed_on = v_snapshot_date
        and lower(trim(o.stage)) = v_stage
    ) into v_has_match;
  end if;

  update public.field_todos
  set completed = true,
      completed_at = coalesce(completed_at, now()),
      updated_at = now(),
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('closedReason', 'snapshot_expired')
  where user_id = v_user
    and field_id = p_field_id
    and task_key like 'model-growth-stage-observation:%'
    and not completed
    and (v_task_key is null or task_key <> v_task_key);

  if v_task_key is not null and not v_has_match then
    insert into public.field_todos as todo(
      user_id, field_id, title, task_key, description, source,
      action_target, priority, reward_rule_key, metadata, completed, dismissed
    ) values (
      v_user,
      p_field_id,
      'Gelişim evresini sahada doğrula',
      v_task_key,
      format(
        'Bugünkü model evresi “%s”. Tarlada gerçekten gördüğün evreyi tarihli kaydet; yalnız aynı tarih ve evre eşleşirse basal Kcb doğrulanır.',
        coalesce(nullif(trim(v_stage_label), ''), v_stage)
      ),
      'model-readiness',
      'field-growth-observation',
      60,
      null,
      jsonb_build_object(
        'rewardPoints', 0,
        'engines', jsonb_build_array('pyfao56'),
        'snapshotDate', v_snapshot_date,
        'expectedStage', v_stage,
        'stageLabel', coalesce(nullif(trim(v_stage_label), ''), v_stage),
        'evidence', 'same-day-field-growth-observation'
      ),
      false,
      false
    )
    on conflict (user_id, field_id, task_key) where task_key is not null
    do update set
      title = excluded.title,
      description = excluded.description,
      source = excluded.source,
      action_target = excluded.action_target,
      priority = excluded.priority,
      reward_rule_key = excluded.reward_rule_key,
      metadata = excluded.metadata,
      completed = false,
      completed_at = null,
      dismissed = todo.dismissed,
      updated_at = now();
  elsif v_task_key is not null and v_has_match then
    update public.field_todos
    set completed = true,
        completed_at = coalesce(completed_at, now()),
        updated_at = now(),
        metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('closedReason', 'matching_growth_observation')
    where user_id = v_user
      and field_id = p_field_id
      and task_key = v_task_key
      and not completed;
  end if;

  return query
  select * from public.field_todos
  where user_id = v_user
    and field_id = p_field_id
    and completed = false
    and dismissed = false
    and task_key like 'model-growth-stage-observation:%'
  order by priority desc, created_at asc;
end;
$function$;

revoke all on function public.tp_sync_growth_stage_observation_task(uuid) from public;
revoke all on function public.tp_sync_growth_stage_observation_task(uuid) from anon;
grant execute on function public.tp_sync_growth_stage_observation_task(uuid) to authenticated;
