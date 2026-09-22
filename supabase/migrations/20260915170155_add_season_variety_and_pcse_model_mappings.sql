alter table public.field_seasons
  add column if not exists variety_name text null;

create table if not exists public.pcse_crop_reference_mappings (
  crop_name text primary key,
  crop_aliases text[] not null default '{}'::text[],
  wofost_crop_key text not null,
  model_family text not null default 'WOFOST',
  model_version text not null default '7.2',
  source_label text not null,
  source_url text not null,
  verified boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pcse_variety_mappings (
  id uuid primary key default gen_random_uuid(),
  crop_name text not null references public.pcse_crop_reference_mappings(crop_name) on update cascade on delete cascade,
  local_variety_name text not null,
  normalized_local_variety_name text not null,
  wofost_crop_key text not null,
  wofost_variety_key text not null,
  model_family text not null default 'WOFOST',
  model_version text not null default '7.2',
  source_label text not null,
  source_url text not null,
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (crop_name, normalized_local_variety_name, model_version)
);

alter table public.pcse_crop_reference_mappings enable row level security;
alter table public.pcse_variety_mappings enable row level security;

revoke all on public.pcse_crop_reference_mappings from anon;
revoke all on public.pcse_variety_mappings from anon;
revoke insert, update, delete, truncate, references, trigger on public.pcse_crop_reference_mappings from authenticated;
revoke insert, update, delete, truncate, references, trigger on public.pcse_variety_mappings from authenticated;
grant select on public.pcse_crop_reference_mappings to authenticated;
grant select on public.pcse_variety_mappings to authenticated;
grant all on public.pcse_crop_reference_mappings to service_role;
grant all on public.pcse_variety_mappings to service_role;

drop policy if exists "Authenticated users can read PCSE crop mappings" on public.pcse_crop_reference_mappings;
create policy "Authenticated users can read PCSE crop mappings"
  on public.pcse_crop_reference_mappings
  for select to authenticated
  using (true);

drop policy if exists "Authenticated users can read PCSE variety mappings" on public.pcse_variety_mappings;
create policy "Authenticated users can read PCSE variety mappings"
  on public.pcse_variety_mappings
  for select to authenticated
  using (verified = true);

insert into public.pcse_crop_reference_mappings (
  crop_name, crop_aliases, wofost_crop_key, source_label, source_url, verified, updated_at
) values
  ('Arpa', array['arpa']::text[], 'barley', 'WOFOST crop parameters 7.2', 'https://github.com/ajwdewit/WOFOST_crop_parameters/tree/wofost72', true, now()),
  ('Ayçiçeği', array['ayçiçeği','aycicegi']::text[], 'sunflower', 'WOFOST crop parameters 7.2', 'https://github.com/ajwdewit/WOFOST_crop_parameters/tree/wofost72', true, now()),
  ('Bakla', array['bakla']::text[], 'fababean', 'WOFOST crop parameters 7.2', 'https://github.com/ajwdewit/WOFOST_crop_parameters/tree/wofost72', true, now()),
  ('Buğday', array['buğday','bugday']::text[], 'wheat', 'WOFOST crop parameters 7.2', 'https://github.com/ajwdewit/WOFOST_crop_parameters/tree/wofost72', true, now()),
  ('Çukurova Pamuğu', array['çukurova pamuğu','cukurova pamugu']::text[], 'cotton', 'WOFOST crop parameters 7.2', 'https://github.com/ajwdewit/WOFOST_crop_parameters/tree/wofost72', true, now()),
  ('Darı', array['darı','dari']::text[], 'millet', 'WOFOST crop parameters 7.2', 'https://github.com/ajwdewit/WOFOST_crop_parameters/tree/wofost72', true, now()),
  ('Kolza (Kanola)', array['kolza (kanola)','kolza','kanola']::text[], 'rapeseed', 'WOFOST crop parameters 7.2', 'https://github.com/ajwdewit/WOFOST_crop_parameters/tree/wofost72', true, now()),
  ('Mısır', array['mısır','misir']::text[], 'maize', 'WOFOST crop parameters 7.2', 'https://github.com/ajwdewit/WOFOST_crop_parameters/tree/wofost72', true, now()),
  ('Nohut', array['nohut']::text[], 'chickpea', 'WOFOST crop parameters 7.2', 'https://github.com/ajwdewit/WOFOST_crop_parameters/tree/wofost72', true, now()),
  ('Pamuk', array['pamuk']::text[], 'cotton', 'WOFOST crop parameters 7.2', 'https://github.com/ajwdewit/WOFOST_crop_parameters/tree/wofost72', true, now()),
  ('Patates', array['patates']::text[], 'potato', 'WOFOST crop parameters 7.2', 'https://github.com/ajwdewit/WOFOST_crop_parameters/tree/wofost72', true, now()),
  ('Pancar', array['pancar']::text[], 'sugarbeet', 'WOFOST crop parameters 7.2', 'https://github.com/ajwdewit/WOFOST_crop_parameters/tree/wofost72', true, now()),
  ('Şeker Pancarı', array['şeker pancarı','seker pancari']::text[], 'sugarbeet', 'WOFOST crop parameters 7.2', 'https://github.com/ajwdewit/WOFOST_crop_parameters/tree/wofost72', true, now()),
  ('Soya Fasulyesi', array['soya fasulyesi','soya']::text[], 'soybean', 'WOFOST crop parameters 7.2', 'https://github.com/ajwdewit/WOFOST_crop_parameters/tree/wofost72', true, now()),
  ('Sorgum', array['sorgum']::text[], 'sorghum', 'WOFOST crop parameters 7.2', 'https://github.com/ajwdewit/WOFOST_crop_parameters/tree/wofost72', true, now()),
  ('Tatlı Patates', array['tatlı patates','tatli patates']::text[], 'sweetpotato', 'WOFOST crop parameters 7.2', 'https://github.com/ajwdewit/WOFOST_crop_parameters/tree/wofost72', true, now()),
  ('Tütün', array['tütün','tutun']::text[], 'tobacco', 'WOFOST crop parameters 7.2', 'https://github.com/ajwdewit/WOFOST_crop_parameters/tree/wofost72', true, now()),
  ('Yer Fıstığı', array['yer fıstığı','yer fistigi']::text[], 'groundnut', 'WOFOST crop parameters 7.2', 'https://github.com/ajwdewit/WOFOST_crop_parameters/tree/wofost72', true, now())
on conflict (crop_name) do update set
  crop_aliases = excluded.crop_aliases,
  wofost_crop_key = excluded.wofost_crop_key,
  source_label = excluded.source_label,
  source_url = excluded.source_url,
  verified = excluded.verified,
  updated_at = now();
