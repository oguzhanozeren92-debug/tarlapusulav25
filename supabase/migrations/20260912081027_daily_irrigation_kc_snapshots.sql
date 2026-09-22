-- Save only the Kc calculated on a day when a signed-in user opens the
-- irrigation/crop-water-use flow. This is not historical backfill.
create table if not exists public.field_irrigation_kc_snapshots (
  user_id uuid not null references auth.users(id) on delete cascade,
  field_id uuid not null references public.fields(id) on delete cascade,
  snapshot_date date not null default ((now() at time zone 'UTC')::date),
  kc numeric(5, 3) not null check (kc >= 0 and kc <= 3),
  crop_name text not null,
  phenology_stage text not null,
  stage_label text,
  coefficient_confidence text not null check (coefficient_confidence in ('low', 'medium', 'high')),
  source_label text not null,
  calculated_at timestamptz not null default now(),
  primary key (user_id, field_id, snapshot_date)
);

alter table public.field_irrigation_kc_snapshots enable row level security;
revoke all on public.field_irrigation_kc_snapshots from public, anon, authenticated;
grant select, insert, update on public.field_irrigation_kc_snapshots to authenticated;

drop policy if exists "Read own field Kc snapshots" on public.field_irrigation_kc_snapshots;
create policy "Read own field Kc snapshots"
on public.field_irrigation_kc_snapshots for select to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.fields as f
    where f.id = field_id and f.user_id = (select auth.uid())
  )
);

drop policy if exists "Insert own field Kc snapshots" on public.field_irrigation_kc_snapshots;
create policy "Insert own field Kc snapshots"
on public.field_irrigation_kc_snapshots for insert to authenticated
with check (
  user_id = (select auth.uid())
  and snapshot_date = (now() at time zone 'UTC')::date
  and exists (
    select 1 from public.fields as f
    where f.id = field_id and f.user_id = (select auth.uid())
  )
);

drop policy if exists "Update today's own field Kc snapshot" on public.field_irrigation_kc_snapshots;
create policy "Update today's own field Kc snapshot"
on public.field_irrigation_kc_snapshots for update to authenticated
using (
  user_id = (select auth.uid())
  and snapshot_date = (now() at time zone 'UTC')::date
  and exists (
    select 1 from public.fields as f
    where f.id = field_id and f.user_id = (select auth.uid())
  )
)
with check (
  user_id = (select auth.uid())
  and snapshot_date = (now() at time zone 'UTC')::date
  and exists (
    select 1 from public.fields as f
    where f.id = field_id and f.user_id = (select auth.uid())
  )
);
