create or replace function public.tp_complete_field_task(p_task_id uuid)
returns table(
  completed boolean,
  awarded boolean,
  awarded_points integer,
  reason text,
  points bigint,
  lifetime_points bigint,
  unlocked_fields integer,
  next_field_number integer,
  next_threshold integer,
  remaining_to_next bigint,
  progress_percent integer
)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user uuid := auth.uid();
  v_task public.field_todos%rowtype;
  v_field public.fields%rowtype;
  v_rule public.gamification_rules%rowtype;
  v_condition_met boolean := false;
  v_dedupe_key text;
  v_state record;
  v_awarded boolean := false;
  v_awarded_points integer := 0;
begin
  if v_user is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_task
  from public.field_todos
  where id = p_task_id and user_id = v_user
  for update;

  if not found then
    raise exception 'task_not_found';
  end if;

  select * into v_field
  from public.fields
  where id = v_task.field_id and user_id = v_user;

  if not found then
    raise exception 'field_not_found';
  end if;

  v_condition_met := case v_task.task_key
    when 'irrigation-status' then v_field.irrigation_status is not null
    when 'canopy-development' then v_field.canopy_development_class is not null or v_field.canopy_cover_percent is not null
    when 'canopy-height' then v_field.canopy_height_class is not null or v_field.canopy_height_m is not null
    when 'model-planting-date' then exists(
      select 1 from public.field_seasons s
      where s.user_id = v_user
        and s.field_id = v_task.field_id
        and s.planting_date is not null
        and (v_field.season is null or s.year = v_field.season)
    )
    when 'model-crop-variety' then exists(
      select 1 from public.field_seasons s
      where s.user_id = v_user
        and s.field_id = v_task.field_id
        and nullif(btrim(coalesce(s.variety_name, '')), '') is not null
        and (v_field.season is null or s.year = v_field.season)
    )
    when 'model-last-irrigation' then exists(
      select 1 from public.activities a
      where a.user_id = v_user
        and a.field_id = v_task.field_id
        and a.activity_type = 'Sulama'
        and a.activity_date >= current_date - 120
    )
    else false
  end;

  if not v_condition_met then
    select * into v_state from public.tp_get_gamification_state();
    return query select false, false, 0, 'completion_not_verified',
      v_state.points, v_state.lifetime_points, v_state.unlocked_fields,
      v_state.next_field_number, v_state.next_threshold,
      v_state.remaining_to_next, v_state.progress_percent;
    return;
  end if;

  update public.field_todos
  set completed = true,
      completed_at = coalesce(completed_at, now()),
      updated_at = now()
  where id = v_task.id and user_id = v_user;

  if v_task.reward_rule_key is not null then
    select * into v_rule
    from public.gamification_rules
    where rule_key = v_task.reward_rule_key
      and active = true;

    if found then
      v_dedupe_key := format('field-task:%s:%s', v_task.field_id, v_task.task_key);

      if not exists (
        select 1 from public.gamification_transactions gt
        where gt.user_id = v_user and gt.dedupe_key = v_dedupe_key
      ) then
        insert into public.user_gamification(user_id)
        values(v_user)
        on conflict(user_id) do nothing;

        begin
          insert into public.gamification_transactions(
            user_id, rule_key, points, dedupe_key, metadata
          ) values (
            v_user,
            v_rule.rule_key,
            v_rule.points,
            v_dedupe_key,
            jsonb_build_object(
              'source', 'verified_field_task',
              'taskId', v_task.id,
              'taskKey', v_task.task_key,
              'fieldId', v_task.field_id
            )
          );

          update public.user_gamification
          set points = user_gamification.points + v_rule.points,
              lifetime_points = user_gamification.lifetime_points + v_rule.points,
              updated_at = now()
          where user_id = v_user;

          v_awarded := true;
          v_awarded_points := v_rule.points;
        exception when unique_violation then
          v_awarded := false;
          v_awarded_points := 0;
        end;
      end if;
    end if;
  end if;

  select * into v_state from public.tp_get_gamification_state();

  return query select true, v_awarded, v_awarded_points,
    case when v_awarded then 'awarded' else 'completed_no_new_award' end,
    v_state.points, v_state.lifetime_points, v_state.unlocked_fields,
    v_state.next_field_number, v_state.next_threshold,
    v_state.remaining_to_next, v_state.progress_percent;
end;
$function$;
