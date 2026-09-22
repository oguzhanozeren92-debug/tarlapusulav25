-- Field-observed phenology is authoritative evidence for basal Kcb validation.
-- The automatic phenology/Kc snapshot remains useful context, but the user does
-- not have to agree with the model. One unambiguous canonical observation for
-- today closes the evidence task. Conflicting same-day stages keep it open.
-- TarlaPusula currently operates on Turkey field dates, not UTC calendar dates.

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
  v_today date := ((now() at time zone 'Europe/Istanbul')::date);
  v_snapshot_date date;
  v_stage text;
  v_stage_label text;
  v_task_key text;
  v_distinct_observation_stages integer := 0;
  v_has_unambiguous_observation boolean := false;
  v_task_title text;
  v_task_description text;
begin
  if v_user is null then
    raise exception 'not_authenticated';
  end if;

  select *
  into v_field
  from public.fields
  where id = p_field_id
    and user_id = v_user;

  if not found then
    raise exception 'field_not_found';
  end if;

  v_crop := lower(trim(coalesce(v_field.crop, '')));

  select exists(
    select 1
    from public.crop_water_reference_profiles p
    where (
      lower(trim(p.display_name)) = v_crop
      or exists (
        select 1
        from unnest(coalesce(p.aliases, '{}'::text[])) a
        where lower(trim(a)) = v_crop
      )
    )
    and (
      p.crop_subtype is null
      or lower(trim(p.crop_subtype)) = lower(trim(coalesce(v_field.crop_subtype, '')))
    )
  )
  into v_has_kcb_reference;

  -- The model snapshot is optional context. A real same-day field observation
  -- can validate the basal Kcb even if no automatic snapshot has been written.
  select
    s.snapshot_date,
    lower(trim(coalesce(s.phenology_stage, ''))),
    s.stage_label
  into
    v_snapshot_date,
    v_stage,
    v_stage_label
  from public.field_irrigation_kc_snapshots s
  where s.user_id = v_user
    and s.field_id = p_field_id
    and s.snapshot_date = v_today
  order by s.calculated_at desc
  limit 1;

  if v_has_kcb_reference then
    v_task_key := 'model-growth-stage-observation:' || v_today::text;

    select count(distinct lower(trim(o.stage)))::integer
    into v_distinct_observation_stages
    from public.field_growth_observations o
    where o.user_id = v_user
      and o.field_id = p_field_id
      and o.observed_on = v_today
      and lower(trim(o.stage)) in (
        'pre_sowing','establishment','vegetative','reproductive','maturation',
        'harvest_window','post_harvest','dormancy','bud_swell','bud_break',
        'flowering','fruit_set','fruit_growth','veraison','leaf_fall'
      );

    v_has_unambiguous_observation := v_distinct_observation_stages = 1;
  end if;

  -- Old daily evidence tasks are no longer actionable.
  update public.field_todos
  set completed = true,
      completed_at = coalesce(completed_at, now()),
      updated_at = now(),
      metadata = coalesce(metadata, '{}'::jsonb)
        || jsonb_build_object('closedReason', 'snapshot_expired')
  where user_id = v_user
    and field_id = p_field_id
    and task_key like 'model-growth-stage-observation:%'
    and not completed
    and (v_task_key is null or task_key <> v_task_key);

  if v_task_key is not null and not v_has_unambiguous_observation then
    if v_distinct_observation_stages > 1 then
      v_task_title := 'Gelişim evresi kayıtlarını netleştir';
      v_task_description := 'Bugün aynı tarla için birden fazla farklı gelişim evresi kaydedilmiş. Sahada geçerli olan tek evreyi bırak; çelişkili kayıt varken basal Kcb doğrulanmaz.';
    elsif v_snapshot_date = v_today
       and v_stage in (
         'pre_sowing','establishment','vegetative','reproductive','maturation',
         'harvest_window','post_harvest','dormancy','bud_swell','bud_break',
         'flowering','fruit_set','fruit_growth','veraison','leaf_fall'
       ) then
      v_task_title := 'Gelişim evresini sahada kaydet';
      v_task_description := format(
        'Model bugün “%s” evresini tahmin ediyor. Tarlada gerçekten gördüğün evreyi kaydet; farklıysa modeli onaylamak zorunda değilsin. Aynı günkü saha gözlemi basal Kcb için öncelikli kanıttır.',
        coalesce(nullif(trim(v_stage_label), ''), v_stage)
      );
    else
      v_task_title := 'Bugünkü gelişim evresini kaydet';
      v_task_description := 'Tarlada bugün gerçekten gördüğün gelişim evresini kaydet. Bu saha gözlemi basal Kcb için öncelikli kanıttır; model tahmini olmadığı için sistem evre uydurmaz.';
    end if;

    insert into public.field_todos as todo(
      user_id,
      field_id,
      title,
      task_key,
      description,
      source,
      action_target,
      priority,
      reward_rule_key,
      metadata,
      completed,
      dismissed
    ) values (
      v_user,
      p_field_id,
      v_task_title,
      v_task_key,
      v_task_description,
      'model-readiness',
      'field-growth-observation',
      60,
      null,
      jsonb_build_object(
        'rewardPoints', 0,
        'engines', jsonb_build_array('pyfao56'),
        'observationDate', v_today,
        'fieldTimeZone', 'Europe/Istanbul',
        'modelSnapshotDate', case when v_snapshot_date = v_today then v_snapshot_date else null end,
        'modelExpectedStage', case when v_snapshot_date = v_today then nullif(v_stage, '') else null end,
        'stageLabel', case when v_snapshot_date = v_today then coalesce(nullif(trim(v_stage_label), ''), nullif(v_stage, '')) else null end,
        'evidence', 'same-day-field-growth-observation',
        'fieldObservationAuthoritative', true,
        'conflictingObservationStages', v_distinct_observation_stages > 1
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
  elsif v_task_key is not null and v_has_unambiguous_observation then
    update public.field_todos
    set completed = true,
        completed_at = coalesce(completed_at, now()),
        updated_at = now(),
        metadata = coalesce(metadata, '{}'::jsonb)
          || jsonb_build_object(
            'closedReason', 'same_day_growth_observation',
            'fieldObservationAuthoritative', true,
            'fieldTimeZone', 'Europe/Istanbul'
          )
    where user_id = v_user
      and field_id = p_field_id
      and task_key = v_task_key
      and not completed;
  end if;

  return query
  select *
  from public.field_todos
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
