create table if not exists public.crop_water_reference_profiles (
  crop_key text primary key,
  display_name text not null,
  crop_subtype text null,
  crop_subtype_label text null,
  kcb_initial numeric(6,3) not null check (kcb_initial >= 0 and kcb_initial <= 3),
  kcb_mid numeric(6,3) not null check (kcb_mid >= 0 and kcb_mid <= 3),
  kcb_end numeric(6,3) not null check (kcb_end >= 0 and kcb_end <= 3),
  root_depth_min_m numeric(6,3) not null check (root_depth_min_m > 0 and root_depth_min_m <= 10),
  root_depth_max_m numeric(6,3) not null check (root_depth_max_m >= root_depth_min_m and root_depth_max_m <= 10),
  depletion_fraction_p numeric(5,3) not null check (depletion_fraction_p > 0 and depletion_fraction_p < 1),
  ground_cover_assumption text null,
  kcb_source_label text not null,
  kcb_source_url text not null,
  root_source_label text not null,
  root_source_url text not null,
  reference_version text not null default 'FAO-56',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.crop_water_reference_profiles enable row level security;

revoke all on table public.crop_water_reference_profiles from anon;
revoke insert, update, delete, truncate, references, trigger on table public.crop_water_reference_profiles from authenticated;
grant select on table public.crop_water_reference_profiles to authenticated;

drop policy if exists "Authenticated users can read crop water reference profiles" on public.crop_water_reference_profiles;
create policy "Authenticated users can read crop water reference profiles"
  on public.crop_water_reference_profiles
  for select
  to authenticated
  using (true);

insert into public.crop_water_reference_profiles (
  crop_key, display_name, crop_subtype, crop_subtype_label,
  kcb_initial, kcb_mid, kcb_end,
  root_depth_min_m, root_depth_max_m, depletion_fraction_p,
  ground_cover_assumption,
  kcb_source_label, kcb_source_url,
  root_source_label, root_source_url,
  reference_version, updated_at
) values
  ('pistachio','Antep Fıstığı',null,null,0.20,1.05,0.40,1.00,1.50,0.40,'no ground cover','FAO-56 Table 17 — Pistachios, no ground cover','https://www.fao.org/4/X0490E/x0490e0c.htm','FAO-56 Table 22 — Pistachios','https://www.fao.org/4/x0490e/x0490e0e.htm','FAO-56',now()),
  ('almond','Badem',null,null,0.20,0.85,0.60,1.00,2.00,0.40,'no ground cover','FAO-56 Table 17 — Almonds, no ground cover','https://www.fao.org/4/X0490E/x0490e0c.htm','FAO-56 Table 22 — Almonds','https://www.fao.org/4/x0490e/x0490e0e.htm','FAO-56',now()),
  ('cherry','Kiraz',null,null,0.35,0.90,0.65,1.00,2.00,0.50,'no ground cover, killing frost','FAO-56 Table 17 — Apples, Cherries, Pears; no ground cover, killing frost','https://www.fao.org/4/X0490E/x0490e0c.htm','FAO-56 Table 22 — Apples, Cherries, Pears','https://www.fao.org/4/x0490e/x0490e0e.htm','FAO-56',now()),
  ('walnut','Ceviz',null,null,0.40,1.05,0.60,1.70,2.40,0.50,null,'FAO-56 Table 17 — Walnut Orchard','https://www.fao.org/4/X0490E/x0490e0c.htm','FAO-56 Table 22 — Walnut Orchard','https://www.fao.org/4/x0490e/x0490e0e.htm','FAO-56',now()),
  ('grape_table','Üzüm','table','Sofralık',0.15,0.80,0.40,1.00,2.00,0.35,null,'FAO-56 Table 17 — Grapes, Table or Raisin','https://www.fao.org/4/X0490E/x0490e0c.htm','FAO-56 Table 22 — Grapes, Table or Raisin','https://www.fao.org/4/x0490e/x0490e0e.htm','FAO-56',now()),
  ('grape_wine','Üzüm','wine','Şaraplık',0.15,0.65,0.40,1.00,2.00,0.45,null,'FAO-56 Table 17 — Grapes, Wine','https://www.fao.org/4/X0490E/x0490e0c.htm','FAO-56 Table 22 — Grapes, Wine','https://www.fao.org/4/x0490e/x0490e0e.htm','FAO-56',now())
on conflict (crop_key) do update set
  display_name = excluded.display_name,
  crop_subtype = excluded.crop_subtype,
  crop_subtype_label = excluded.crop_subtype_label,
  kcb_initial = excluded.kcb_initial,
  kcb_mid = excluded.kcb_mid,
  kcb_end = excluded.kcb_end,
  root_depth_min_m = excluded.root_depth_min_m,
  root_depth_max_m = excluded.root_depth_max_m,
  depletion_fraction_p = excluded.depletion_fraction_p,
  ground_cover_assumption = excluded.ground_cover_assumption,
  kcb_source_label = excluded.kcb_source_label,
  kcb_source_url = excluded.kcb_source_url,
  root_source_label = excluded.root_source_label,
  root_source_url = excluded.root_source_url,
  reference_version = excluded.reference_version,
  updated_at = now();
