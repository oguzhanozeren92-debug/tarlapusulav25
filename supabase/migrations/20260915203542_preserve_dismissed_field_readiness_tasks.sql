create or replace function public.tp_sync_field_tasks(p_field_id uuid)
returns setof public.field_todos
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user uuid := auth.uid();
  v_field public.fields%rowtype;
  v_is_canopy_crop boolean := false;
  v_crop text := '';
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

  v_crop := lower(trim(coalesce(v_field.crop, '')));
  v_is_canopy_crop := v_crop in (
    'antep fıstığı','antepfıstığı','antep fistigi','antepfistigi','fıstık','fistik','pistachio',
    'badem','almond','kiraz','cherry','cherries','ceviz','walnut','walnuts'
  );

  if v_field.irrigation_status is null then
    insert into public.field_todos(
      user_id, field_id, title, task_key, description, source,
      action_target, priority, reward_rule_key, metadata, completed, dismissed
    ) values (
      v_user, p_field_id, 'Sulama durumunu tamamla', 'irrigation-status',
      'Sulama bilgisini gir; su stresi ve sulama yorumları daha isabetli olsun.',
      'field-readiness', 'field-irrigation-status', 95,
      'TASK_IRRIGATION_STATUS', jsonb_build_object('rewardPoints', 20), false, false
    )
    on conflict (user_id, field_id, task_key) where task_key is not null
    do update set
      title = excluded.title, description = excluded.description, source = excluded.source,
      action_target = excluded.action_target, priority = excluded.priority,
      reward_rule_key = excluded.reward_rule_key, metadata = excluded.metadata,
      completed = false, completed_at = null, updated_at = now();
  else
    update public.field_todos
    set completed = true, completed_at = coalesce(completed_at, now()), updated_at = now()
    where user_id = v_user and field_id = p_field_id and task_key = 'irrigation-status' and not completed;
  end if;

  if v_is_canopy_crop and v_field.canopy_development_class is null and v_field.canopy_cover_percent is null then
    insert into public.field_todos(
      user_id, field_id, title, task_key, description, source,
      action_target, priority, reward_rule_key, metadata, completed, dismissed
    ) values (
      v_user, p_field_id, 'Taç gelişimini tamamla', 'canopy-development',
      'Bahçedeki ağaçların taç gelişimini seç; Pusula su dengesi ve gelişim değerlendirmelerinde gerçek bahçe yapısını kullansın.',
      'field-readiness', 'field-canopy-development', 80,
      'TASK_CANOPY_DEVELOPMENT', jsonb_build_object('rewardPoints', 15), false, false
    )
    on conflict (user_id, field_id, task_key) where task_key is not null
    do update set
      title = excluded.title, description = excluded.description, source = excluded.source,
      action_target = excluded.action_target, priority = excluded.priority,
      reward_rule_key = excluded.reward_rule_key, metadata = excluded.metadata,
      completed = false, completed_at = null, updated_at = now();
  else
    update public.field_todos
    set completed = true, completed_at = coalesce(completed_at, now()), updated_at = now()
    where user_id = v_user and field_id = p_field_id and task_key = 'canopy-development' and not completed;
  end if;

  if v_is_canopy_crop and v_field.canopy_height_class is null and v_field.canopy_height_m is null then
    insert into public.field_todos(
      user_id, field_id, title, task_key, description, source,
      action_target, priority, reward_rule_key, metadata, completed, dismissed
    ) values (
      v_user, p_field_id, 'Ağaç boyunu tamamla', 'canopy-height',
      'Bahçedeki ortalama ağaç boyunu seç; Pusula dual-Kc su dengesi ve gelişim değerlendirmelerinde uygun canopy yüksekliğini kullansın.',
      'field-readiness', 'field-canopy-height', 75,
      'TASK_CANOPY_HEIGHT', jsonb_build_object('rewardPoints', 15), false, false
    )
    on conflict (user_id, field_id, task_key) where task_key is not null
    do update set
      title = excluded.title, description = excluded.description, source = excluded.source,
      action_target = excluded.action_target, priority = excluded.priority,
      reward_rule_key = excluded.reward_rule_key, metadata = excluded.metadata,
      completed = false, completed_at = null, updated_at = now();
  else
    update public.field_todos
    set completed = true, completed_at = coalesce(completed_at, now()), updated_at = now()
    where user_id = v_user and field_id = p_field_id and task_key = 'canopy-height' and not completed;
  end if;

  return query
  select * from public.field_todos
  where user_id = v_user and field_id = p_field_id
    and completed = false and dismissed = false and task_key is not null
  order by priority desc, created_at asc;
end;
$function$;
