create table if not exists public.soil_evaporation_reference_profiles (
  texture_key text primary key,
  texture_label text not null,
  rew_min_mm numeric(6,2) not null check (rew_min_mm >= 0),
  rew_max_mm numeric(6,2) not null check (rew_max_mm >= rew_min_mm),
  tew_min_mm_at_ze_010 numeric(6,2) not null check (tew_min_mm_at_ze_010 >= 0),
  tew_max_mm_at_ze_010 numeric(6,2) not null check (tew_max_mm_at_ze_010 >= tew_min_mm_at_ze_010),
  ze_recommended_min_m numeric(5,3) not null default 0.10,
  ze_recommended_max_m numeric(5,3) not null default 0.15,
  source_label text not null default 'FAO-56 Table 19',
  source_url text not null default 'https://www.fao.org/4/X0490E/x0490e0c.htm',
  reference_version text not null default 'FAO-56',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.soil_evaporation_reference_profiles enable row level security;
revoke all on table public.soil_evaporation_reference_profiles from anon;
revoke insert, update, delete, truncate, references, trigger on table public.soil_evaporation_reference_profiles from authenticated;
grant select on table public.soil_evaporation_reference_profiles to authenticated;

drop policy if exists "Authenticated users can read soil evaporation reference profiles" on public.soil_evaporation_reference_profiles;
create policy "Authenticated users can read soil evaporation reference profiles"
  on public.soil_evaporation_reference_profiles
  for select
  to authenticated
  using (true);

insert into public.soil_evaporation_reference_profiles
(texture_key, texture_label, rew_min_mm, rew_max_mm, tew_min_mm_at_ze_010, tew_max_mm_at_ze_010, updated_at)
values
('sand','Sand',2,7,6,12,now()),
('loamy_sand','Loamy sand',4,8,9,14,now()),
('sandy_loam','Sandy loam',6,10,15,20,now()),
('loam','Loam',8,10,16,22,now()),
('silt_loam','Silt loam',8,11,18,25,now()),
('silt','Silt',8,11,22,26,now()),
('silty_clay_loam','Silt clay loam',8,11,22,27,now()),
('silty_clay','Silty clay',8,12,22,28,now()),
('clay','Clay',8,12,22,29,now())
on conflict (texture_key) do update set
  texture_label = excluded.texture_label,
  rew_min_mm = excluded.rew_min_mm,
  rew_max_mm = excluded.rew_max_mm,
  tew_min_mm_at_ze_010 = excluded.tew_min_mm_at_ze_010,
  tew_max_mm_at_ze_010 = excluded.tew_max_mm_at_ze_010,
  updated_at = now();
