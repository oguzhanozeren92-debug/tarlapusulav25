create or replace function public.tp_sync_model_readiness_tasks(p_field_id uuid)
returns setof public.field_todos
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user uuid := auth.uid();
  v_field public.fields%rowtype;
  v_has_planting_date boolean := false;
  v_has_variety boolean := false;
  v_has_recent_irrigation boolean := false;
  v_is_perennial boolean := false;
  v_crop text := '';
  v_irrigation_status text := '';
  v_pcse_crop_supported boolean := false;
  v_task_id uuid;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;

  select * into v_field
  from public.fields
  where id = p_field_id and user_id = v_user;
  if not found then raise exception 'field_not_found'; end if;

  v_crop := lower(trim(coalesce(v_field.crop, '')));
  v_irrigation_status := lower(trim(coalesce(v_field.irrigation_status, '')));
  v_is_perennial :=
    coalesce(lower(v_field.crop_cycle), '') in ('perennial', 'çok yıllık', 'cok yillik', 'perennial_crop')
    or v_crop in (
      'antep fıstığı','antepfıstığı','antep fistigi','antepfistigi','fıstık','fistik','pistachio',
      'badem','almond','kiraz','cherry','cherries','ceviz','walnut','walnuts',
      'üzüm','uzum','grape','grapes','elma','apple','armut','pear','zeytin','olive'
    );

  select exists(
    select 1
    from public.pcse_crop_reference_mappings m
    where m.verified = true
      and (
        lower(trim(m.crop_name)) = v_crop
        or exists (
          select 1
          from unnest(coalesce(m.crop_aliases, '{}'::text[])) a
          where lower(trim(a)) = v_crop
        )
      )
  ) into v_pcse_crop_supported;

  select exists(
    select 1 from public.field_seasons s
    where s.user_id = v_user and s.field_id = p_field_id
      and s.planting_date is not null
      and (v_field.season is null or s.year = v_field.season)
  ) into v_has_planting_date;

  if not v_is_perennial and v_crop <> '' and not v_has_planting_date then
    insert into public.field_todos as todo(
      user_id, field_id, title, task_key, description, source,
      action_target, priority, reward_rule_key, metadata, completed, dismissed
    ) values (
      v_user, p_field_id, 'Ekim / dikim tarihini tamamla', 'model-planting-date',
      'Ekim veya dikim tarihini gir; fenoloji, PCSE ve AquaCrop aynı gerçek başlangıç tarihinden beslensin.',
      'model-readiness', 'field-season', 70,
      'TASK_MODEL_PLANTING_DATE', jsonb_build_object('rewardPoints', 10, 'engines', jsonb_build_array('pcse','aquacrop')), false, false
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
    select id into v_task_id
    from public.field_todos
    where user_id = v_user and field_id = p_field_id
      and task_key = 'model-planting-date' and not completed
    limit 1;
    if v_task_id is not null then
      perform 1 from public.tp_complete_field_task(v_task_id) limit 1;
    end if;
  end if;

  v_task_id := null;
  select exists(
    select 1 from public.field_seasons s
    where s.user_id = v_user and s.field_id = p_field_id
      and nullif(trim(coalesce(s.variety_name, '')), '') is not null
      and (v_field.season is null or s.year = v_field.season)
  ) into v_has_variety;

  if not v_is_perennial and v_crop <> '' and v_pcse_crop_supported and not v_has_variety then
    insert into public.field_todos as todo(
      user_id, field_id, title, task_key, description, source,
      action_target, priority, reward_rule_key, metadata, completed, dismissed
    ) values (
      v_user, p_field_id, 'Ürün çeşidini biliyorsan ekle', 'model-crop-variety',
      'Ektiğin çeşidin adını biliyorsan yaz. Bilmiyorsan bu görevi şimdilik kapatabilirsin; sistem rastgele çeşit seçmez.',
      'model-readiness', 'field-season', 35,
      null, jsonb_build_object('rewardPoints', 0, 'engines', jsonb_build_array('pcse'), 'optional', true), false, false
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
    select id into v_task_id
    from public.field_todos
    where user_id = v_user and field_id = p_field_id
      and task_key = 'model-crop-variety' and not completed
    limit 1;
    if v_task_id is not null then
      perform 1 from public.tp_complete_field_task(v_task_id) limit 1;
    end if;
  end if;

  v_task_id := null;
  select exists(
    select 1 from public.activities a
    where a.user_id = v_user and a.field_id = p_field_id
      and a.activity_type = 'Sulama'
      and a.activity_date >= current_date - 120
  ) into v_has_recent_irrigation;

  if v_irrigation_status in ('irrigated','partial','sulu','kismi','kısmi')
     and not v_has_recent_irrigation then
    insert into public.field_todos as todo(
      user_id, field_id, title, task_key, description, source,
      action_target, priority, reward_rule_key, metadata, completed, dismissed
    ) values (
      v_user, p_field_id, 'Son sulama kaydını ekle', 'model-last-irrigation',
      'Son sulama tarihini ve mümkünse verilen su miktarını kaydet; günlük su dengesi ve AquaCrop sulama programı bu gerçek kayıttan beslensin.',
      'model-readiness', 'field-operation:Sulama', 65,
      'TASK_MODEL_LAST_IRRIGATION', jsonb_build_object('rewardPoints', 10, 'engines', jsonb_build_array('pyfao56','aquacrop')), false, false
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
    select id into v_task_id
    from public.field_todos
    where user_id = v_user and field_id = p_field_id
      and task_key = 'model-last-irrigation' and not completed
    limit 1;
    if v_task_id is not null then
      perform 1 from public.tp_complete_field_task(v_task_id) limit 1;
    end if;
  end if;

  return query
  select * from public.field_todos
  where user_id = v_user and field_id = p_field_id
    and completed = false and dismissed = false
    and source = 'model-readiness'
  order by priority desc, created_at asc;
end;
$function$;
