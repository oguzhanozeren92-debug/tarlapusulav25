alter table public.field_growth_observations
  alter column season_id drop not null;

create unique index if not exists field_growth_observations_field_date_stage_no_season_uidx
  on public.field_growth_observations (field_id, observed_on, stage)
  where season_id is null;

drop policy if exists "Insert own growth observations for own season"
  on public.field_growth_observations;

create policy "Insert own growth observations with valid field context"
  on public.field_growth_observations
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.fields f
      where f.id = field_growth_observations.field_id
        and f.user_id = (select auth.uid())
        and (
          (
            field_growth_observations.season_id is null
            and coalesce(f.crop_cycle, 'annual') = 'perennial'
          )
          or (
            field_growth_observations.season_id is not null
            and exists (
              select 1
              from public.field_seasons s
              where s.id = field_growth_observations.season_id
                and s.field_id = field_growth_observations.field_id
                and s.user_id = (select auth.uid())
            )
          )
        )
    )
  );
