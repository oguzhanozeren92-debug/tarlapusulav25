-- LIVE HOTFIX SOURCE
--
-- Installed on the live Supabase project with execute_sql. It is intentionally
-- kept outside supabase/migrations because no migration-history row exists for
-- this change. Reconcile it into a normal migration when migration history is
-- normalized/backfilled.
--
-- IMPORTANT: all "today" comparisons use the Turkey field day, matching the
-- irrigation water-balance Edge Function. This avoids a 00:00-03:00 local-time
-- mismatch while PostgreSQL current_date is still on the previous UTC day.

create or replace function public.tp_sync_irrigation_amount_task(p_field_id uuid)
returns setof public.field_todos
language plpgsql
security invoker
set search_path to 'public'
as $function$
declare
  v_user uuid := auth.uid();
  v_field public.fields%rowtype;
  v_irrigation_status text := '';
  v_activity public.activities%rowtype;
  v_unit text := '';
  v_notes text := '';
  v_has_amount boolean := false;
  v_task_key text := 'model-last-irrigation-amount';
  v_field_date date := (now() at time zone 'Europe/Istanbul')::date;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;

  select * into v_field
  from public.fields
  where id = p_field_id and user_id = v_user;
  if not found then raise exception 'field_not_found'; end if;

  v_irrigation_status := lower(trim(coalesce(v_field.irrigation_status, '')));

  if v_irrigation_status not in ('irrigated','partial','sulu','kismi','kısmi') then
    update public.field_todos
    set completed = true,
        completed_at = coalesce(completed_at, now()),
        updated_at = now(),
        metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('closedReason','not_irrigated')
    where user_id = v_user and field_id = p_field_id
      and task_key = v_task_key and not completed;
    return;
  end if;

  select * into v_activity
  from public.activities a
  where a.user_id = v_user
    and a.field_id = p_field_id
    and lower(trim(a.activity_type)) = lower('Sulama')
    and a.activity_date between v_field_date - 120 and v_field_date
  order by a.activity_date desc, a.created_at desc
  limit 1;

  if not found then
    update public.field_todos
    set completed = true,
        completed_at = coalesce(completed_at, now()),
        updated_at = now(),
        metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('closedReason','awaiting_irrigation_record')
    where user_id = v_user and field_id = p_field_id
      and task_key = v_task_key and not completed;
    return;
  end if;

  v_unit := lower(trim(coalesce(v_activity.unit, '')));
  v_notes := coalesce(v_activity.notes, '');

  v_has_amount := (
    coalesce(v_activity.quantity, 0) > 0
    and (
      v_unit = 'mm'
      or v_unit = 'm³'
      or v_unit = 'm3'
      or v_unit like '%m³/da%'
      or v_unit like '%m3/da%'
      or v_unit like '%m³ / da%'
      or v_unit like '%m3 / da%'
    )
  ) or (
    v_notes ~* 'toplam[[:space:]]+sulama[[:space:]]+suyu[[:space:]]*:[[:space:]]*[0-9]+([.,][0-9]+)?[[:space:]]*m[³3]'
    or v_notes ~* 'toplam[[:space:]]+su[[:space:]]*:[[:space:]]*[0-9]+([.,][0-9]+)?[[:space:]]*m[³3]'
    or v_notes ~* 'dekara[[:space:]]+sulama[[:space:]]+suyu[[:space:]]*:[[:space:]]*[0-9]+([.,][0-9]+)?[[:space:]]*m[³3][[:space:]]*/[[:space:]]*da'
    or v_notes ~* '[0-9]+([.,][0-9]+)?[[:space:]]*m[³3][[:space:]]*/[[:space:]]*da'
  );

  if v_has_amount then
    update public.field_todos
    set completed = true,
        completed_at = coalesce(completed_at, now()),
        updated_at = now(),
        metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
          'closedReason','quantified_irrigation_record',
          'activityId',v_activity.id,
          'activityDate',v_activity.activity_date,
          'evidenceDate',v_field_date,
          'fieldTimeZone','Europe/Istanbul'
        )
    where user_id = v_user and field_id = p_field_id
      and task_key = v_task_key and not completed;
  else
    insert into public.field_todos as todo(
      user_id, field_id, title, task_key, description, source,
      action_target, priority, reward_rule_key, metadata, completed, dismissed
    ) values (
      v_user,
      p_field_id,
      'Sulama suyu miktarını tamamla',
      v_task_key,
      'Son sulama kaydı var ama verilen su miktarı bilinmiyor. Miktarı biliyorsan m³ veya m³/da olarak kaydet. Bilmiyorsan değer uydurma; kayıt geçerli kalır fakat pyfao56 su dengesi bu veri olmadan açılmaz.',
      'model-readiness',
      'field-operation:Sulama',
      62,
      null,
      jsonb_build_object(
        'rewardPoints',0,
        'engines',jsonb_build_array('pyfao56'),
        'activityId',v_activity.id,
        'activityDate',v_activity.activity_date,
        'evidenceDate',v_field_date,
        'fieldTimeZone','Europe/Istanbul',
        'requiredEvidence','quantified-irrigation-water'
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
  end if;

  return query
  select * from public.field_todos
  where user_id = v_user and field_id = p_field_id
    and task_key = v_task_key
    and completed = false and dismissed = false;
end;
$function$;

revoke all on function public.tp_sync_irrigation_amount_task(uuid) from public;
revoke all on function public.tp_sync_irrigation_amount_task(uuid) from anon;
grant execute on function public.tp_sync_irrigation_amount_task(uuid) to authenticated;
