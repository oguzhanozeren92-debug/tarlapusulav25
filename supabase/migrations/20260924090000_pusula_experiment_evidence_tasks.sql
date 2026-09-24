create schema if not exists private;

insert into public.gamification_rules (
  rule_key,
  label,
  points,
  daily_limit,
  active,
  updated_at
)
values (
  'TASK_PUSULA_EXPERIMENT_STAGE',
  'Pusula Deneyi gelişim evresi saha gözlemi',
  20,
  null,
  true,
  now()
)
on conflict (rule_key) do update
set
  label = excluded.label,
  points = excluded.points,
  daily_limit = excluded.daily_limit,
  active = excluded.active,
  updated_at = now();

create or replace function private.tp_complete_pusula_experiment_task(
  p_task_id uuid,
  p_expected_rule_key text,
  p_dedupe_key text,
  p_evidence_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_task public.field_todos%rowtype;
  v_rule public.gamification_rules%rowtype;
  v_transaction_id uuid;
begin
  select *
  into v_task
  from public.field_todos
  where id = p_task_id
  for update;

  if not found then
    return;
  end if;

  if v_task.source is distinct from 'pusula-experiment'
     or v_task.completed = true
     or coalesce(v_task.dismissed, false) = true
     or v_task.reward_rule_key is distinct from p_expected_rule_key then
    return;
  end if;

  select *
  into v_rule
  from public.gamification_rules
  where rule_key = p_expected_rule_key
    and active = true;

  if not found or v_rule.points <= 0 then
    raise exception 'pusula_experiment_reward_rule_unavailable:%', p_expected_rule_key;
  end if;

  update public.field_todos
  set
    completed = true,
    completed_at = now(),
    updated_at = now(),
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'completedByEvidence', true,
      'completedByEvidenceAt', now(),
      'awardedPoints', v_rule.points
    )
  where id = v_task.id;

  insert into public.user_gamification (user_id)
  values (v_task.user_id)
  on conflict (user_id) do nothing;

  insert into public.gamification_transactions (
    user_id,
    rule_key,
    points,
    dedupe_key,
    metadata
  )
  values (
    v_task.user_id,
    v_rule.rule_key,
    v_rule.points,
    p_dedupe_key,
    coalesce(p_evidence_metadata, '{}'::jsonb) || jsonb_build_object(
      'source', 'pusula_experiment_evidence_task',
      'taskId', v_task.id,
      'fieldId', v_task.field_id,
      'taskKey', v_task.task_key
    )
  )
  on conflict (user_id, dedupe_key) where dedupe_key is not null
  do nothing
  returning id into v_transaction_id;

  if v_transaction_id is not null then
    update public.user_gamification
    set
      points = points + v_rule.points,
      lifetime_points = lifetime_points + v_rule.points,
      updated_at = now()
    where user_id = v_task.user_id;
  end if;
end;
$$;

revoke all on function private.tp_complete_pusula_experiment_task(uuid, text, text, jsonb)
from public, anon, authenticated;

create or replace function private.tp_complete_pusula_experiment_stage_task()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_task_id uuid;
begin
  if new.season_id is null then
    return new;
  end if;

  select ft.id
  into v_task_id
  from public.field_todos ft
  where ft.user_id = new.user_id
    and ft.field_id = new.field_id
    and ft.source = 'pusula-experiment'
    and ft.action_target = 'field-growth-observation'
    and ft.reward_rule_key = 'TASK_PUSULA_EXPERIMENT_STAGE'
    and ft.completed = false
    and coalesce(ft.dismissed, false) = false
    and ft.due_date = new.observed_on
    and ft.created_at <= new.created_at
    and ft.metadata ->> 'seasonId' = new.season_id::text
    and ft.task_key like 'pusula-experiment-growth-stage:%'
  order by ft.created_at desc
  limit 1;

  if v_task_id is not null then
    perform private.tp_complete_pusula_experiment_task(
      v_task_id,
      'TASK_PUSULA_EXPERIMENT_STAGE',
      'pusula-experiment-stage:' || v_task_id::text,
      jsonb_build_object(
        'evidenceType', 'growth_stage',
        'observationId', new.id,
        'observedOn', new.observed_on,
        'stage', new.stage,
        'seasonId', new.season_id
      )
    );
  end if;

  return new;
end;
$$;

revoke all on function private.tp_complete_pusula_experiment_stage_task()
from public, anon, authenticated;

drop trigger if exists trg_tp_complete_pusula_experiment_stage_task
on public.field_growth_observations;

create trigger trg_tp_complete_pusula_experiment_stage_task
after insert on public.field_growth_observations
for each row
execute function private.tp_complete_pusula_experiment_stage_task();

create or replace function private.tp_complete_pusula_experiment_photo_task()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_task public.field_todos%rowtype;
  v_reward_key text;
  v_season_key text;
  v_season_start date;
  v_photo_count integer;
  v_georeferenced_count integer;
begin
  select ft.*
  into v_task
  from public.field_todos ft
  where ft.user_id = new.user_id
    and ft.field_id = new.field_id
    and ft.source = 'pusula-experiment'
    and ft.action_target = 'field-photo'
    and ft.reward_rule_key = 'FIELD_OBSERVATION_PHOTO'
    and ft.completed = false
    and coalesce(ft.dismissed, false) = false
    and ft.created_at <= new.created_at
    and ft.task_key like 'pusula-experiment-field-photo:%'
    and nullif(ft.metadata ->> 'seasonStart', '')::date <= new.captured_at::date
  order by ft.created_at desc
  limit 1;

  if not found then
    return new;
  end if;

  v_reward_key := coalesce(new.satellite_date::text, new.captured_at::date::text);
  v_season_key := nullif(v_task.metadata ->> 'seasonKey', '');
  v_season_start := nullif(v_task.metadata ->> 'seasonStart', '')::date;

  perform private.tp_complete_pusula_experiment_task(
    v_task.id,
    'FIELD_OBSERVATION_PHOTO',
    'field-observation-photo:' || new.point_id::text || ':' || v_reward_key,
    jsonb_build_object(
      'evidenceType', 'field_photo',
      'photoId', new.id,
      'pointId', new.point_id,
      'capturedAt', new.captured_at,
      'satelliteDate', new.satellite_date,
      'seasonKey', v_season_key
    )
  );

  if v_season_key is not null and v_season_start is not null then
    select
      count(*)::integer,
      count(*) filter (
        where p.captured_lat is not null
          and p.captured_lng is not null
          and p.captured_lat between -90 and 90
          and p.captured_lng between -180 and 180
      )::integer
    into v_photo_count, v_georeferenced_count
    from public.field_observation_photos p
    where p.user_id = new.user_id
      and p.field_id = new.field_id
      and p.captured_at::date >= v_season_start;

    update public.pusula_experiment_states pes
    set
      field_photo_count = v_photo_count,
      georeferenced_photo_count = v_georeferenced_count,
      evidence = jsonb_set(
        jsonb_set(
          coalesce(pes.evidence, '{}'::jsonb),
          '{photos,photo_count}',
          to_jsonb(v_photo_count),
          true
        ),
        '{photos,georeferenced_photo_count}',
        to_jsonb(v_georeferenced_count),
        true
      ),
      updated_at = now()
    where pes.user_id = new.user_id
      and pes.field_id = new.field_id
      and pes.season_key = v_season_key;
  end if;

  return new;
end;
$$;

revoke all on function private.tp_complete_pusula_experiment_photo_task()
from public, anon, authenticated;

drop trigger if exists trg_tp_complete_pusula_experiment_photo_task
on public.field_observation_photos;

create trigger trg_tp_complete_pusula_experiment_photo_task
after insert on public.field_observation_photos
for each row
execute function private.tp_complete_pusula_experiment_photo_task();

comment on function private.tp_complete_pusula_experiment_task(uuid, text, text, jsonb) is
  'Completes and rewards only server-generated Pusula Experiment evidence tasks after verified evidence insertion. Never rewards task creation or automatic model output.';
