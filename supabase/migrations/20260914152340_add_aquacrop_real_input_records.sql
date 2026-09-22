create table if not exists public.field_water_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  field_id uuid not null references public.fields(id) on delete cascade,
  measured_at timestamptz not null default now(),
  volumetric_water_content numeric not null check (volumetric_water_content >= 0 and volumetric_water_content <= 1),
  depth_from_cm numeric not null default 0 check (depth_from_cm >= 0),
  depth_to_cm numeric not null check (depth_to_cm > depth_from_cm and depth_to_cm <= 300),
  source text not null check (source in ('sensor','laboratory','manual_verified')),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists field_water_measurements_field_measured_idx
  on public.field_water_measurements(field_id, measured_at desc);
create index if not exists field_water_measurements_user_field_idx
  on public.field_water_measurements(user_id, field_id);

alter table public.field_water_measurements enable row level security;

drop policy if exists "Users can view own field water measurements" on public.field_water_measurements;
create policy "Users can view own field water measurements"
on public.field_water_measurements for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own field water measurements" on public.field_water_measurements;
create policy "Users can insert own field water measurements"
on public.field_water_measurements for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.fields f
    where f.id = field_water_measurements.field_id
      and f.user_id = (select auth.uid())
  )
);

drop policy if exists "Users can update own field water measurements" on public.field_water_measurements;
create policy "Users can update own field water measurements"
on public.field_water_measurements for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own field water measurements" on public.field_water_measurements;
create policy "Users can delete own field water measurements"
on public.field_water_measurements for delete
to authenticated
using ((select auth.uid()) = user_id);

create table if not exists public.field_aquacrop_management (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  field_id uuid not null references public.fields(id) on delete cascade,
  mode text not null check (mode in ('rainfed','recorded_schedule','manual_schedule','soil_moisture_target')),
  settings jsonb not null default '{}'::jsonb,
  source text not null default 'user_verified' check (source in ('user_verified','recorded_operations')),
  verified_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, field_id)
);

create index if not exists field_aquacrop_management_field_idx
  on public.field_aquacrop_management(field_id);

alter table public.field_aquacrop_management enable row level security;

drop policy if exists "Users can view own AquaCrop management" on public.field_aquacrop_management;
create policy "Users can view own AquaCrop management"
on public.field_aquacrop_management for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own AquaCrop management" on public.field_aquacrop_management;
create policy "Users can insert own AquaCrop management"
on public.field_aquacrop_management for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.fields f
    where f.id = field_aquacrop_management.field_id
      and f.user_id = (select auth.uid())
  )
);

drop policy if exists "Users can update own AquaCrop management" on public.field_aquacrop_management;
create policy "Users can update own AquaCrop management"
on public.field_aquacrop_management for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own AquaCrop management" on public.field_aquacrop_management;
create policy "Users can delete own AquaCrop management"
on public.field_aquacrop_management for delete
to authenticated
using ((select auth.uid()) = user_id);
