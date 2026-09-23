-- TarlaPusula - generated field task rewards
-- Amaç:
-- 1) Kullanıcıya gösterilen gerçek görevlerin 0 puan kalmaması.
-- 2) Kanıtla tamamlanan görevlerin puanının sunucu tarafında tek sefer verilmesi.
-- 3) Mevcut reward_rule_key kullanan görevlerin eski akışına dokunulmaması.

create schema if not exists private;

insert into public.gamification_rules(rule_key, label, points, daily_limit, active)
values
  ('TASK_IRRIGATION_METHOD', 'Sulama yöntemini tamamla', 15, null, true),
  ('TASK_SURFACE_WATER_MEASUREMENT', 'Yüzey toprak nemi ölçümü ekle', 30, null, true),
  ('TASK_GROWTH_STAGE_OBSERVATION', 'Gelişim evresini sahada kaydet', 20, null, true),
  ('TASK_IRRIGATION_AMOUNT', 'Sulama suyu miktarını tamamla', 15, null, true),
  ('TASK_IRRIGATION_SYNTHESIS_CHECK', 'Sulama kararını sahada doğrula', 25, null, true)
on conflict (rule_key) do update
set label = excluded.label,
    points = excluded.points,
    daily_limit = excluded.daily_limit,
    active = excluded.active,
    updated_at = now();

create or replace function private.tp_generated_task_reward_rule(
  p_task_key text
)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  select case
    when p_task_key = 'irrigation-method'
      then 'TASK_IRRIGATION_METHOD'
    when p_task_key = 'model-surface-water-measurement'
      then 'TASK_SURFACE_WATER_MEASUREMENT'
    when p_task_key like 'model-growth-stage-observation:%'
      then 'TASK_GROWTH_STAGE_OBSERVATION'
    when p_task_key = 'model-last-irrigation-amount'
      then 'TASK_IRRIGATION_AMOUNT'
    when p_task_key = 'irrigation-synthesis-field-check'
      then 'TASK_IRRIGATION_SYNTHESIS_CHECK'
    else null
  end;
$$;

create or replace function private.tp_generated_task_reward_evidence(
  p_task public.field_todos
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_task_date date;
  v_has_surface_measurement boolean := false;
  v_has_irrigation_amount boolean := false;
begin
  if p_task.task_key = 'irrigation-method' then
    return exists (
      select 1
      from public.fields f
      where f.id = p_task.field_id
        and f.user_id = p_task.user_id
        and f.irrigation_method is not null
    );
  end if;

  if p_task.task_key = 'model-surface-water-measurement' then
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
        where m.user_id = p_task.user_id
          and m.field_id = p_task.field_id
          and m.measured_at >= now() - interval '14 days'
          and m.volumetric_water_content > 0
          and m.volumetric_water_content < 1
          and m.depth_from_cm < 15
          and m.depth_to_cm > 0
        group by m.measured_at::date
      ) d
      where numrange(0::numeric, 15::numeric, '[)') <@ d.coverage
    ) into v_has_surface_measurement;

    return v_has_surface_measurement;
  end if;

  if p_task.task_key like 'model-growth-stage-observation:%' then
    begin
      v_task_date := right(p_task.task_key, 10)::date;
    exception when others then
      return false;
    end;

    return exists (
      select 1
      from public.field_growth_observations o
      where o.user_id = p_task.user_id
        and o.field_id = p_task.field_id
        and o.observed_on = v_task_date
    );
  end if;

  if p_task.task_key = 'model-last-irrigation-amount' then
    select exists (
      select 1
      from public.activities a
      where a.user_id = p_task.user_id
        and a.field_id = p_task.field_id
        and lower(trim(a.activity_type)) = lower('Sulama')
        and a.activity_date >= ((now() at time zone 'Europe/Istanbul')::date - 120)
        and (
          (
            coalesce(a.quantity, 0) > 0
            and (
              lower(trim(coalesce(a.unit, ''))) = 'mm'
              or lower(trim(coalesce(a.unit, ''))) = 'm³'
              or lower(trim(coalesce(a.unit, ''))) = 'm3'
              or lower(trim(coalesce(a.unit, ''))) like '%m³/da%'
              or lower(trim(coalesce(a.unit, ''))) like '%m3/da%'
              or lower(trim(coalesce(a.unit, ''))) like '%m³ / da%'
              or lower(trim(coalesce(a.unit, ''))) like '%m3 / da%'
            )
          )
          or coalesce(a.notes, '') ~* 'toplam[[:space:]]+sulama[[:space:]]+suyu[[:space:]]*:[[:space:]]*[0-9]+([.,][0-9]+)?[[:space:]]*m[³3]'
          or coalesce(a.notes, '') ~* 'toplam[[:space:]]+su[[:space:]]*:[[:space:]]*[0-9]+([.,][0-9]+)?[[:space:]]*m[³3]'
          or coalesce(a.notes, '') ~* 'dekara[[:space:]]+sulama[[:space:]]+suyu[[:space:]]*:[[:space:]]*[0-9]+([.,][0-9]+)?[[:space:]]*m[³3][[:space:]]*/[[:space:]]*da'
          or coalesce(a.notes, '') ~* '[0-9]+([.,][0-9]+)?[[:space:]]*m[³3][[:space:]]*/[[:space:]]*da'
        )
    ) into v_has_irrigation_amount;

    return v_has_irrigation_amount;
  end if;

  if p_task.task_key = 'irrigation-synthesis-field-check' then
    -- Bu görev saha kontrolü / veri doğrulaması sonucunda kapanır.
    -- snapshot_expired gibi teknik kapanışları ödüllendirmiyoruz.
    return coalesce(p_task.metadata->>'closedReason', '') <> 'snapshot_expired';
  end if;

  return false;
end;
$$;

create or replace function private.tp_award_generated_field_task()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rule_key text;
  v_rule_points integer;
  v_dedupe_key text;
begin
  if old.completed is true or new.completed is not true then
    return new;
  end if;

  -- Eski görev ödül sistemi zaten reward_rule_key üzerinden puan veriyor.
  if new.reward_rule_key is not null then
    return new;
  end if;

  v_rule_key := private.tp_generated_task_reward_rule(new.task_key);
  if v_rule_key is null then
    return new;
  end if;

  if not private.tp_generated_task_reward_evidence(new) then
    return new;
  end if;

  select r.points
  into v_rule_points
  from public.gamification_rules r
  where r.rule_key = v_rule_key
    and r.active = true;

  if v_rule_points is null or v_rule_points <= 0 then
    return new;
  end if;

  v_dedupe_key := format('generated-field-task:%s', new.id);

  if exists (
    select 1
    from public.gamification_transactions gt
    where gt.user_id = new.user_id
      and gt.dedupe_key = v_dedupe_key
  ) then
    return new;
  end if;

  insert into public.user_gamification(user_id)
  values(new.user_id)
  on conflict(user_id) do nothing;

  begin
    insert into public.gamification_transactions(
      user_id,
      rule_key,
      points,
      dedupe_key,
      metadata
    ) values (
      new.user_id,
      v_rule_key,
      v_rule_points,
      v_dedupe_key,
      jsonb_build_object(
        'source', 'generated_field_task',
        'taskId', new.id,
        'taskKey', new.task_key,
        'fieldId', new.field_id
      )
    );

    update public.user_gamification
    set points = points + v_rule_points,
        lifetime_points = lifetime_points + v_rule_points,
        updated_at = now()
    where user_id = new.user_id;
  exception when unique_violation then
    null;
  end;

  return new;
end;
$$;

revoke all on function private.tp_generated_task_reward_rule(text) from public, anon, authenticated;
revoke all on function private.tp_generated_task_reward_evidence(public.field_todos) from public, anon, authenticated;
revoke all on function private.tp_award_generated_field_task() from public, anon, authenticated;

drop trigger if exists trg_award_generated_field_task on public.field_todos;
create trigger trg_award_generated_field_task
after update of completed on public.field_todos
for each row
when (old.completed is false and new.completed is true)
execute function private.tp_award_generated_field_task();

-- Açık eski kayıtların UI metadata'sını da puanlı hale getiriyoruz.
update public.field_todos
set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'rewardPoints',
      case
        when task_key = 'irrigation-method' then 15
        when task_key = 'model-surface-water-measurement' then 30
        when task_key like 'model-growth-stage-observation:%' then 20
        when task_key = 'model-last-irrigation-amount' then 15
        when task_key = 'irrigation-synthesis-field-check' then 25
        else coalesce((metadata->>'rewardPoints')::integer, 10)
      end
    ),
    updated_at = now()
where completed = false
  and dismissed = false
  and (
    task_key in (
      'irrigation-method',
      'model-surface-water-measurement',
      'model-last-irrigation-amount',
      'irrigation-synthesis-field-check'
    )
    or task_key like 'model-growth-stage-observation:%'
  );
