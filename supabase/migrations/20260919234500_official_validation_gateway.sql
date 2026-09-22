create table if not exists public.official_source_registry (
  provider_key text primary key,
  domain text not null check (domain in ('plant_protection','fertilizer','disaster','crop','local_research')),
  name text not null,
  authority text not null,
  base_url text not null,
  verification_mode text not null check (verification_mode in ('manual_official_web','api','file_import')),
  programmatic_access text not null check (programmatic_access in ('verified','pending','unavailable')),
  terms_url text,
  notes text,
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.official_validation_records (
  id uuid primary key default gen_random_uuid(),
  provider_key text not null references public.official_source_registry(provider_key) on update cascade on delete restrict,
  provider_record_id text,
  domain text not null check (domain in ('plant_protection','fertilizer','disaster','crop','local_research')),
  subject_type text not null,
  subject_name text not null,
  crop text,
  pest_or_disease text,
  active_ingredient text,
  product_name text,
  verification_status text not null check (verification_status in ('verified','needs_check','not_found','conflict','stale')),
  source_url text not null,
  source_observed_at timestamptz not null,
  valid_until timestamptz,
  source_snapshot jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  verified_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint official_bku_source_host check (
    provider_key <> 'tr_bku'
    or source_url ~ '^https://bku\.tarimorman\.gov\.tr/'
  )
);

create unique index if not exists official_validation_provider_record_uidx
  on public.official_validation_records(provider_key, provider_record_id)
  where provider_record_id is not null;
create index if not exists official_validation_lookup_idx
  on public.official_validation_records(provider_key, verification_status, lower(coalesce(crop,'')), lower(coalesce(active_ingredient,'')), lower(coalesce(product_name,'')));
create index if not exists official_validation_verified_by_idx
  on public.official_validation_records(verified_by);
create index if not exists official_validation_observed_idx
  on public.official_validation_records(source_observed_at desc);

alter table public.official_source_registry enable row level security;
alter table public.official_validation_records enable row level security;

drop policy if exists official_source_registry_read on public.official_source_registry;
create policy official_source_registry_read on public.official_source_registry
  for select to authenticated using (enabled or public.is_admin());

drop policy if exists official_source_registry_admin_insert on public.official_source_registry;
drop policy if exists official_source_registry_admin_update on public.official_source_registry;
drop policy if exists official_source_registry_admin_delete on public.official_source_registry;
create policy official_source_registry_admin_insert on public.official_source_registry for insert to authenticated with check (public.is_admin());
create policy official_source_registry_admin_update on public.official_source_registry for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy official_source_registry_admin_delete on public.official_source_registry for delete to authenticated using (public.is_admin());

drop policy if exists official_validation_records_read on public.official_validation_records;
create policy official_validation_records_read on public.official_validation_records
  for select to authenticated using (verification_status = 'verified' or public.is_admin());

drop policy if exists official_validation_records_admin_insert on public.official_validation_records;
drop policy if exists official_validation_records_admin_update on public.official_validation_records;
drop policy if exists official_validation_records_admin_delete on public.official_validation_records;
create policy official_validation_records_admin_insert on public.official_validation_records for insert to authenticated with check (public.is_admin());
create policy official_validation_records_admin_update on public.official_validation_records for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy official_validation_records_admin_delete on public.official_validation_records for delete to authenticated using (public.is_admin());

insert into public.official_source_registry (
  provider_key, domain, name, authority, base_url, verification_mode, programmatic_access, terms_url, notes, enabled
) values (
  'tr_bku',
  'plant_protection',
  'Bitki Koruma Ürünleri Veri Tabanı',
  'T.C. Tarım ve Orman Bakanlığı - Gıda ve Kontrol Genel Müdürlüğü',
  'https://bku.tarimorman.gov.tr/',
  'manual_official_web',
  'pending',
  null,
  'Kamuya açık resmi BKU web verisi doğrulama kaynağıdır. BKÜ Takip Sistemi için ayrı web servis dokümanı bulunmakla birlikte TarlaPusula tarafından üçüncü taraf ruhsat/tavsiye sorgu API erişimi ve kullanım şartları henüz resmi olarak doğrulanmamıştır; bu nedenle otomatik API/scraping yapılmaz.',
  true
)
on conflict (provider_key) do update set
  domain = excluded.domain,
  name = excluded.name,
  authority = excluded.authority,
  base_url = excluded.base_url,
  verification_mode = excluded.verification_mode,
  programmatic_access = excluded.programmatic_access,
  terms_url = excluded.terms_url,
  notes = excluded.notes,
  enabled = excluded.enabled,
  updated_at = now();

create or replace function public.find_official_plant_protection_verification(
  p_crop text default null,
  p_pest_or_disease text default null,
  p_active_ingredient text default null,
  p_product_name text default null,
  p_limit integer default 10
)
returns table (
  id uuid,
  provider_key text,
  provider_record_id text,
  subject_type text,
  subject_name text,
  crop text,
  pest_or_disease text,
  active_ingredient text,
  product_name text,
  verification_status text,
  source_url text,
  source_observed_at timestamptz,
  valid_until timestamptz,
  source_snapshot jsonb
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    r.id, r.provider_key, r.provider_record_id, r.subject_type, r.subject_name,
    r.crop, r.pest_or_disease, r.active_ingredient, r.product_name,
    r.verification_status, r.source_url, r.source_observed_at, r.valid_until, r.source_snapshot
  from public.official_validation_records r
  where r.domain = 'plant_protection'
    and r.verification_status = 'verified'
    and (r.valid_until is null or r.valid_until > now())
    and (nullif(trim(coalesce(p_crop,'')), '') is null or lower(coalesce(r.crop,'')) = lower(trim(p_crop)))
    and (nullif(trim(coalesce(p_pest_or_disease,'')), '') is null or lower(coalesce(r.pest_or_disease,'')) = lower(trim(p_pest_or_disease)))
    and (nullif(trim(coalesce(p_active_ingredient,'')), '') is null or lower(coalesce(r.active_ingredient,'')) = lower(trim(p_active_ingredient)))
    and (nullif(trim(coalesce(p_product_name,'')), '') is null or lower(coalesce(r.product_name,'')) = lower(trim(p_product_name)))
  order by r.source_observed_at desc
  limit greatest(1, least(coalesce(p_limit, 10), 25));
$$;

revoke execute on function public.find_official_plant_protection_verification(text,text,text,text,integer) from public, anon;
grant execute on function public.find_official_plant_protection_verification(text,text,text,text,integer) to authenticated;
