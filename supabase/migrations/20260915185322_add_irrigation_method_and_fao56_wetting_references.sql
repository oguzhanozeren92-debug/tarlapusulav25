alter table public.fields
  add column if not exists irrigation_method text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'fields_irrigation_method_check'
      and conrelid = 'public.fields'::regclass
  ) then
    alter table public.fields
      add constraint fields_irrigation_method_check
      check (
        irrigation_method is null or irrigation_method in (
          'sprinkler',
          'basin',
          'border',
          'furrow_every_narrow',
          'furrow_every_wide',
          'furrow_alternating',
          'trickle',
          'unknown'
        )
      );
  end if;
end $$;

create table if not exists public.irrigation_wetting_reference_profiles (
  method_key text primary key,
  display_name_tr text not null,
  fw_min numeric(5,3) not null check (fw_min > 0 and fw_min <= 1),
  fw_max numeric(5,3) not null check (fw_max > 0 and fw_max <= 1 and fw_max >= fw_min),
  source_label text not null,
  source_url text not null,
  reference_version text not null default 'FAO-56 Table 20',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.irrigation_wetting_reference_profiles enable row level security;

revoke all on table public.irrigation_wetting_reference_profiles from public;
revoke all on table public.irrigation_wetting_reference_profiles from anon;
revoke insert, update, delete, truncate, references, trigger on table public.irrigation_wetting_reference_profiles from authenticated;
grant select on table public.irrigation_wetting_reference_profiles to authenticated;

drop policy if exists irrigation_wetting_reference_profiles_authenticated_select on public.irrigation_wetting_reference_profiles;
create policy irrigation_wetting_reference_profiles_authenticated_select
  on public.irrigation_wetting_reference_profiles
  for select
  to authenticated
  using (true);

insert into public.irrigation_wetting_reference_profiles (
  method_key, display_name_tr, fw_min, fw_max, source_label, source_url, reference_version
) values
  ('sprinkler', 'Yağmurlama', 1.000, 1.000, 'FAO-56 Table 20', 'https://www.fao.org/4/X0490E/x0490e0c.htm', 'FAO-56 Table 20'),
  ('basin', 'Tava / göllendirme', 1.000, 1.000, 'FAO-56 Table 20', 'https://www.fao.org/4/X0490E/x0490e0c.htm', 'FAO-56 Table 20'),
  ('border', 'Şerit / salma', 1.000, 1.000, 'FAO-56 Table 20', 'https://www.fao.org/4/X0490E/x0490e0c.htm', 'FAO-56 Table 20'),
  ('furrow_every_narrow', 'Karık - her karık, dar yatak', 0.600, 1.000, 'FAO-56 Table 20', 'https://www.fao.org/4/X0490E/x0490e0c.htm', 'FAO-56 Table 20'),
  ('furrow_every_wide', 'Karık - her karık, geniş yatak', 0.400, 0.600, 'FAO-56 Table 20', 'https://www.fao.org/4/X0490E/x0490e0c.htm', 'FAO-56 Table 20'),
  ('furrow_alternating', 'Karık - dönüşümlü karık', 0.300, 0.500, 'FAO-56 Table 20', 'https://www.fao.org/4/X0490E/x0490e0c.htm', 'FAO-56 Table 20'),
  ('trickle', 'Damlama', 0.300, 0.400, 'FAO-56 Table 20', 'https://www.fao.org/4/X0490E/x0490e0c.htm', 'FAO-56 Table 20')
on conflict (method_key) do update set
  display_name_tr = excluded.display_name_tr,
  fw_min = excluded.fw_min,
  fw_max = excluded.fw_max,
  source_label = excluded.source_label,
  source_url = excluded.source_url,
  reference_version = excluded.reference_version,
  updated_at = now();
