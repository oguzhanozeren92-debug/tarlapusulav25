create table if not exists public.field_pcse_parameter_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  field_id uuid not null references public.fields(id) on delete cascade,
  parameter_kind text not null check (parameter_kind in ('crop_parameters','soil_parameters','site_parameters','agromanagement')),
  parameters jsonb not null check (jsonb_typeof(parameters) = 'object' and parameters <> '{}'::jsonb),
  source text not null check (source in ('user_verified','laboratory','official_dataset','pcse_upstream')),
  source_reference text,
  verified_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, field_id, parameter_kind)
);

create index if not exists field_pcse_parameter_sets_field_kind_idx
  on public.field_pcse_parameter_sets(field_id, parameter_kind);

alter table public.field_pcse_parameter_sets enable row level security;

revoke all on public.field_pcse_parameter_sets from anon;
grant select, insert, update, delete on public.field_pcse_parameter_sets to authenticated;
grant all on public.field_pcse_parameter_sets to service_role;

drop policy if exists "Users can view own PCSE parameter sets" on public.field_pcse_parameter_sets;
create policy "Users can view own PCSE parameter sets"
on public.field_pcse_parameter_sets for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own PCSE parameter sets" on public.field_pcse_parameter_sets;
create policy "Users can insert own PCSE parameter sets"
on public.field_pcse_parameter_sets for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.fields f
    where f.id = field_pcse_parameter_sets.field_id
      and f.user_id = (select auth.uid())
  )
);

drop policy if exists "Users can update own PCSE parameter sets" on public.field_pcse_parameter_sets;
create policy "Users can update own PCSE parameter sets"
on public.field_pcse_parameter_sets for update
to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.fields f
    where f.id = field_pcse_parameter_sets.field_id
      and f.user_id = (select auth.uid())
  )
);

drop policy if exists "Users can delete own PCSE parameter sets" on public.field_pcse_parameter_sets;
create policy "Users can delete own PCSE parameter sets"
on public.field_pcse_parameter_sets for delete
to authenticated
using ((select auth.uid()) = user_id);
