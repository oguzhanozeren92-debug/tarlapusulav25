do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.field_seasons'::regclass
      and conname = 'field_seasons_id_field_id_key'
  ) then
    alter table public.field_seasons
      add constraint field_seasons_id_field_id_key unique (id, field_id);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.field_growth_observations'::regclass
      and conname = 'field_growth_observations_season_field_fkey'
  ) then
    alter table public.field_growth_observations
      add constraint field_growth_observations_season_field_fkey
      foreign key (season_id, field_id)
      references public.field_seasons (id, field_id)
      on delete cascade;
  end if;
end
$$;

drop policy if exists "Insert own growth observations for own season"
  on public.field_growth_observations;

create policy "Insert own growth observations for own season"
  on public.field_growth_observations
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.field_seasons s
      where s.id = field_growth_observations.season_id
        and s.field_id = field_growth_observations.field_id
        and s.user_id = (select auth.uid())
    )
  );
