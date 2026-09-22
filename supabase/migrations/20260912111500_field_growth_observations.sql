create table public.field_growth_observations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  field_id uuid not null references public.fields(id) on delete cascade,
  season_id uuid not null references public.field_seasons(id) on delete cascade,
  observed_on date not null,
  stage text not null check (length(trim(stage)) between 2 and 80),
  notes text check (notes is null or length(notes) <= 500),
  created_at timestamptz not null default now(),
  constraint field_growth_observations_unique unique (season_id, observed_on, stage)
);

create index field_growth_observations_owner_field_idx
  on public.field_growth_observations (user_id, field_id, observed_on desc);

alter table public.field_growth_observations enable row level security;
grant select, insert, delete on public.field_growth_observations to authenticated;

create policy "Read own growth observations"
  on public.field_growth_observations for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Insert own growth observations for own season"
  on public.field_growth_observations for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.field_seasons s
      where s.id = season_id and s.field_id = field_id and s.user_id = (select auth.uid())
    )
  );

create policy "Delete own growth observations"
  on public.field_growth_observations for delete to authenticated
  using (user_id = (select auth.uid()));
