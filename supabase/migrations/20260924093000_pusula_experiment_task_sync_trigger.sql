create or replace function private.tp_sync_pusula_experiment_evidence_tasks_from_calibration()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_today date := (now() at time zone 'Europe/Istanbul')::date;
  v_planting_date date;
  v_season_id uuid;
  v_safe_season_key text;
  v_stage_task_key text;
  v_photo_task_key text;
  v_comparable_days integer := 0;
  v_has_observation_today boolean := false;
  v_photo_count integer := 0;
begin
  if new.review_eligible is distinct from true
     or new.status is distinct from 'consistent'
     or new.season_key = 'unknown'
     or new.season_key like 'mixed:%' then
    update public.field_todos
    set dismissed = true, updated_at = now()
    where user_id = new.user_id
      and field_id = new.field_id
      and source = 'pusula-experiment'
      and completed = false
      and coalesce(dismissed, false) = false;
    return new;
  end if;

  begin
    v_planting_date := nullif(substring(new.season_key from '(\d{4}-\d{2}-\d{2})$'), '')::date;
  exception
    when others then
      v_planting_date := null;
  end;

  if v_planting_date is null then
    return new;
  end if;

  select fs.id
  into v_season_id
  from public.field_seasons fs
  where fs.user_id = new.user_id
    and fs.field_id = new.field_id
    and fs.planting_date = v_planting_date
  order by fs.created_at desc
  limit 1;

  if v_season_id is null then
    return new;
  end if;

  with daily as (
    select
      fgo.observed_on,
      count(distinct case
        when fgo.stage in ('establishment', 'vegetative') then 'vegetative'
        when fgo.stage = 'reproductive' then 'reproductive'
        when fgo.stage in ('maturation', 'harvest_window') then 'mature'
        else null
      end) as bucket_count
    from public.field_growth_observations fgo
    where fgo.user_id = new.user_id
      and fgo.field_id = new.field_id
      and fgo.season_id = v_season_id
    group by fgo.observed_on
  )
  select count(*)::integer
  into v_comparable_days
  from daily
  where bucket_count = 1;

  select exists (
    select 1
    from public.field_growth_observations fgo
    where fgo.user_id = new.user_id
      and fgo.field_id = new.field_id
      and fgo.season_id = v_season_id
      and fgo.observed_on = v_today
  )
  into v_has_observation_today;

  select count(*)::integer
  into v_photo_count
  from public.field_observation_photos fop
  where fop.user_id = new.user_id
    and fop.field_id = new.field_id
    and fop.captured_at::date >= v_planting_date;

  v_safe_season_key := regexp_replace(lower(new.season_key), '[^a-z0-9:_|-]+', '-', 'g');
  v_stage_task_key := 'pusula-experiment-growth-stage:' || v_safe_season_key || ':' || v_today::text;
  v_photo_task_key := 'pusula-experiment-field-photo:' || v_safe_season_key;

  update public.field_todos
  set dismissed = true, updated_at = now()
  where user_id = new.user_id
    and field_id = new.field_id
    and source = 'pusula-experiment'
    and action_target = 'field-growth-observation'
    and completed = false
    and coalesce(dismissed, false) = false
    and task_key is distinct from v_stage_task_key;

  if v_comparable_days < 2 and not v_has_observation_today then
    insert into public.field_todos (
      user_id,
      field_id,
      title,
      due_date,
      completed,
      task_key,
      description,
      source,
      action_target,
      priority,
      reward_rule_key,
      metadata,
      dismissed,
      updated_at
    )
    values (
      new.user_id,
      new.field_id,
      'Bugünkü gelişim evresini kontrol et',
      v_today,
      false,
      v_stage_task_key,
      'Pusula Deneyi model çıktısını gerçek tarla gözlemiyle doğrulamak için bugünkü gelişim evresini kaydet. Bu görev tamamlandığında +20 Pusula Puanı kazanırsın.',
      'pusula-experiment',
      'field-growth-observation',
      75,
      'TASK_PUSULA_EXPERIMENT_STAGE',
      jsonb_build_object(
        'rewardPoints', 20,
        'seasonKey', new.season_key,
        'seasonId', v_season_id,
        'seasonStart', v_planting_date,
        'evidenceRequest', 'growth_stage',
        'experiment', 'pusula-experiment-v1',
        'engines', jsonb_build_array('pcse', 'cropforge'),
        'internalValidation', true
      ),
      false,
      now()
    )
    on conflict (user_id, field_id, task_key) where task_key is not null
    do update set
      title = excluded.title,
      due_date = excluded.due_date,
      description = excluded.description,
      source = excluded.source,
      action_target = excluded.action_target,
      priority = excluded.priority,
      reward_rule_key = excluded.reward_rule_key,
      metadata = excluded.metadata,
      updated_at = now()
    where public.field_todos.completed = false
      and coalesce(public.field_todos.dismissed, false) = false;
  else
    update public.field_todos
    set dismissed = true, updated_at = now()
    where user_id = new.user_id
      and field_id = new.field_id
      and source = 'pusula-experiment'
      and action_target = 'field-growth-observation'
      and completed = false
      and coalesce(dismissed, false) = false;
  end if;

  if v_photo_count < 1 then
    insert into public.field_todos (
      user_id,
      field_id,
      title,
      due_date,
      completed,
      task_key,
      description,
      source,
      action_target,
      priority,
      reward_rule_key,
      metadata,
      dismissed,
      updated_at
    )
    values (
      new.user_id,
      new.field_id,
      'Tarlayı kontrol et ve fotoğraf yükle',
      v_today,
      false,
      v_photo_task_key,
      'Pusula Deneyi için sahadan gerçek bir fotoğraf kanıtı ekle. Fotoğraf yalnız kanıt kapsamı olarak kullanılır; tek başına gelişim evresi gerçeği sayılmaz. Bu görev +30 Pusula Puanı kazandırır.',
      'pusula-experiment',
      'field-photo',
      65,
      'FIELD_OBSERVATION_PHOTO',
      jsonb_build_object(
        'rewardPoints', 30,
        'seasonKey', new.season_key,
        'seasonId', v_season_id,
        'seasonStart', v_planting_date,
        'evidenceRequest', 'field_photo',
        'sourceLayer', 'vegetation',
        'openPhoto', true,
        'experiment', 'pusula-experiment-v1',
        'internalValidation', true
      ),
      false,
      now()
    )
    on conflict (user_id, field_id, task_key) where task_key is not null
    do update set
      title = excluded.title,
      due_date = excluded.due_date,
      description = excluded.description,
      source = excluded.source,
      action_target = excluded.action_target,
      priority = excluded.priority,
      reward_rule_key = excluded.reward_rule_key,
      metadata = excluded.metadata,
      updated_at = now()
    where public.field_todos.completed = false
      and coalesce(public.field_todos.dismissed, false) = false;
  else
    update public.field_todos
    set dismissed = true, updated_at = now()
    where user_id = new.user_id
      and field_id = new.field_id
      and source = 'pusula-experiment'
      and action_target = 'field-photo'
      and completed = false
      and coalesce(dismissed, false) = false;
  end if;

  return new;
end;
$$;

revoke all on function private.tp_sync_pusula_experiment_evidence_tasks_from_calibration()
from public, anon, authenticated;

drop trigger if exists trg_tp_sync_pusula_experiment_evidence_tasks
on public.model_shadow_calibration_states;

create trigger trg_tp_sync_pusula_experiment_evidence_tasks
after insert or update of review_eligible, status, season_key, updated_at
on public.model_shadow_calibration_states
for each row
execute function private.tp_sync_pusula_experiment_evidence_tasks_from_calibration();

comment on function private.tp_sync_pusula_experiment_evidence_tasks_from_calibration() is
  'Creates only real, point-bearing Pusula Experiment field evidence tasks after the repeated-day shadow calibration gate becomes review eligible. Stale evidence requests are dismissed without points.';