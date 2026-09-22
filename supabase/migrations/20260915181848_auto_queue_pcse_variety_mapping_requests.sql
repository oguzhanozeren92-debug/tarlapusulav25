create or replace function private.queue_pcse_variety_mapping_request()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_crop_ref public.pcse_crop_reference_mappings%rowtype;
  v_normalized_variety text;
  v_has_verified_mapping boolean := false;
begin
  if nullif(trim(coalesce(new.variety_name, '')), '') is null
     or nullif(trim(coalesce(new.crop, '')), '') is null then
    return new;
  end if;

  select m.* into v_crop_ref
  from public.pcse_crop_reference_mappings m
  where m.verified = true
    and (
      lower(trim(m.crop_name)) = lower(trim(new.crop))
      or exists (
        select 1
        from unnest(coalesce(m.crop_aliases, '{}'::text[])) alias_name
        where lower(trim(alias_name)) = lower(trim(new.crop))
      )
    )
  limit 1;

  if not found then
    return new;
  end if;

  v_normalized_variety := lower(regexp_replace(trim(new.variety_name), '\s+', ' ', 'g'));

  select exists (
    select 1
    from public.pcse_variety_mappings vm
    where vm.verified = true
      and vm.crop_name = v_crop_ref.crop_name
      and vm.model_version = coalesce(v_crop_ref.model_version, '7.2')
      and vm.normalized_local_variety_name = v_normalized_variety
  ) into v_has_verified_mapping;

  if v_has_verified_mapping then
    update public.pcse_variety_mapping_requests
    set status = 'mapped',
        local_variety_name = trim(new.variety_name),
        wofost_crop_key = v_crop_ref.wofost_crop_key,
        last_seen_at = now(),
        updated_at = now()
    where crop_name = v_crop_ref.crop_name
      and normalized_local_variety_name = v_normalized_variety
      and model_version = coalesce(v_crop_ref.model_version, '7.2');
    return new;
  end if;

  insert into public.pcse_variety_mapping_requests (
    crop_name,
    local_variety_name,
    normalized_local_variety_name,
    wofost_crop_key,
    model_family,
    model_version,
    status,
    first_seen_at,
    last_seen_at,
    created_at,
    updated_at
  ) values (
    v_crop_ref.crop_name,
    trim(new.variety_name),
    v_normalized_variety,
    v_crop_ref.wofost_crop_key,
    coalesce(v_crop_ref.model_family, 'WOFOST'),
    coalesce(v_crop_ref.model_version, '7.2'),
    'pending',
    now(),
    now(),
    now(),
    now()
  )
  on conflict (crop_name, normalized_local_variety_name, model_version)
  do update set
    local_variety_name = excluded.local_variety_name,
    wofost_crop_key = excluded.wofost_crop_key,
    last_seen_at = now(),
    updated_at = now();

  return new;
end;
$$;

revoke all on function private.queue_pcse_variety_mapping_request() from public, anon, authenticated;

drop trigger if exists trg_queue_pcse_variety_mapping_request on public.field_seasons;
create trigger trg_queue_pcse_variety_mapping_request
after insert or update of crop, variety_name on public.field_seasons
for each row
execute function private.queue_pcse_variety_mapping_request();
