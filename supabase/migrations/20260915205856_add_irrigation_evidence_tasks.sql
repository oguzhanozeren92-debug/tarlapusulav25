create or replace function public.tp_sync_irrigation_evidence_tasks(p_field_id uuid)
returns setof public.field_todos
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user uuid := auth.uid();
  v_field public.fields%rowtype;
  v_irrigation_status text := '';
  v_needs_irrigation boolean := false;
  v_has_surface_measurement boolean := false;
begin
  if v_user is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_field
  from public.fields
  where id = p_field_id and user_id = v_user;

  if not found then
    raise exception 'field_not_found';
  end if;

  v_irrigation_status := lower(trim(coalesce(v_field.irrigation_status, '')));
  v_needs_irrigation := v_irrigation_status in (
    'irrigated', 'partial', 'sulu', 'kismi', 'kısmi'
  );

  if v_needs_irrigation and v_field.irrigation_method is null then
    insert into public.field_todos as todo(
      user_id, field_id, title, task_key, description, source,
      action_target, priority, reward_rule_key, metadata, completed, dismissed
    ) values (
      v_user,
      p_field_id,
      'Sulama yöntemini seç',
      'irrigation-method',
      'Damlama, yağmurlama, tava veya kullandığın diğer yöntemi seç. Emin değilsen “Bilmiyorum” diyebilirsin; Pusula ıslanan yüzey oranını uydurmaz.',
      'field-readiness',
      'field-irrigation-method',
      90,
      null,
      jsonb_build_object('rewardPoints', 0, 'engines', jsonb_build_array('pyfao56')),
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
  else
    update public.field_todos
    set completed = true,
        completed_at = coalesce(completed_at, now()),
        updated_at = now()
    where user_id = v_user
      and field_id = p_field_id
      and task_key = 'irrigation-method'
      and not completed;
  end if;

  if v_needs_irrigation then
    select exists (
      select 1
      from (
        select
          m.measured_at::date as measurement_day,
          range_agg(
            numrange(
              greatest(0::numeric, m.depth_from_cm),
              least(15::numeric, m.depth_to_cm),
              '[)'
            )
          ) as coverage
        from public.field_water_measurements m
        where m.user_id = v_user
          and m.field_id = p_field_id
          and m.measured_at >= now() - interval '14 days'
          and m.volumetric_water_content > 0
          and m.volumetric_water_content < 1
          and m.depth_from_cm < 15
          and m.depth_to_cm > 0
        group by m.measured_at::date
      ) d
      where numrange(0::numeric, 15::numeric, '[)') <@ d.coverage
    ) into v_has_surface_measurement;
  end if;

  if v_needs_irrigation and not v_has_surface_measurement then
    insert into public.field_todos as todo(
      user_id, field_id, title, task_key, description, source,
      action_target, priority, reward_rule_key, metadata, completed, dismissed
    ) values (
      v_user,
      p_field_id,
      'Yüzey toprak nemini ölç',
      'model-surface-water-measurement',
      'Ölçüm imkanın varsa son 14 gün içinde 0–15 cm yüzey katmanının gerçek hacimsel nemini kaydet. Ölçemiyorsan “Şimdi değil” diyebilirsin; Pusula değer uydurmaz.',
      'model-readiness',
      'field-water-measurement',
      55,
      null,
      jsonb_build_object(
        'rewardPoints', 0,
        'engines', jsonb_build_array('pyfao56'),
        'optional', true,
        'surfaceDepthCm', 15,
        'maxAgeDays', 14
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
  else
    update public.field_todos
    set completed = true,
        completed_at = coalesce(completed_at, now()),
        updated_at = now()
    where user_id = v_user
      and field_id = p_field_id
      and task_key = 'model-surface-water-measurement'
      and not completed;
  end if;

  return query
  select *
  from public.field_todos
  where user_id = v_user
    and field_id = p_field_id
    and completed = false
    and dismissed = false
    and task_key in ('irrigation-method', 'model-surface-water-measurement')
  order by priority desc, created_at asc;
end;
$function$;

revoke all on function public.tp_sync_irrigation_evidence_tasks(uuid) from public;
revoke all on function public.tp_sync_irrigation_evidence_tasks(uuid) from anon;
grant execute on function public.tp_sync_irrigation_evidence_tasks(uuid) to authenticated;
