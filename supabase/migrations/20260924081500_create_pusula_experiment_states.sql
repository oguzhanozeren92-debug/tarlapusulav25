create table if not exists public.pusula_experiment_states (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  field_id uuid not null references public.fields(id) on delete cascade,
  season_key text not null check (length(btrim(season_key)) > 0),
  status text not null check (
    status in (
      'waiting_calibration',
      'waiting_ground_truth',
      'observing',
      'field_supported',
      'field_conflict',
      'mixed',
      'blocked'
    )
  ),
  calibration_review_eligible boolean not null default false,
  review_ready boolean not null default false,
  field_observation_days integer not null default 0 check (field_observation_days >= 0),
  comparable_observation_days integer not null default 0 check (comparable_observation_days >= 0),
  ambiguous_observation_days integer not null default 0 check (ambiguous_observation_days >= 0),
  pcse_field_state text not null default 'insufficient' check (
    pcse_field_state in ('insufficient', 'supportive', 'mixed', 'divergent')
  ),
  pcse_evaluated_days integer not null default 0 check (pcse_evaluated_days >= 0),
  pcse_supported_days integer not null default 0 check (pcse_supported_days >= 0),
  pcse_divergent_days integer not null default 0 check (pcse_divergent_days >= 0),
  cropforge_field_state text not null default 'insufficient' check (
    cropforge_field_state in ('insufficient', 'supportive', 'mixed', 'divergent')
  ),
  cropforge_evaluated_days integer not null default 0 check (cropforge_evaluated_days >= 0),
  cropforge_supported_days integer not null default 0 check (cropforge_supported_days >= 0),
  cropforge_divergent_days integer not null default 0 check (cropforge_divergent_days >= 0),
  satellite_ndvi_days integer not null default 0 check (satellite_ndvi_days >= 0),
  field_photo_count integer not null default 0 check (field_photo_count >= 0),
  georeferenced_photo_count integer not null default 0 check (georeferenced_photo_count >= 0),
  latest_field_observation_day date,
  evidence jsonb not null default '{}'::jsonb,
  production_authority boolean not null default false check (production_authority = false),
  user_visible boolean not null default false check (user_visible = false),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, field_id, season_key)
);

create index if not exists pusula_experiment_user_field_updated_idx
  on public.pusula_experiment_states (user_id, field_id, updated_at desc);

create index if not exists pusula_experiment_status_updated_idx
  on public.pusula_experiment_states (status, updated_at desc);

create index if not exists pusula_experiment_review_ready_idx
  on public.pusula_experiment_states (review_ready, updated_at desc)
  where review_ready = true;

alter table public.pusula_experiment_states enable row level security;

revoke all on table public.pusula_experiment_states from anon, authenticated;

comment on table public.pusula_experiment_states is
  'Internal-only Pusula Experiment evidence gate. Compares review-eligible model shadows with manual field-stage observations while keeping satellite and photo evidence separate. Never grants production authority.';

comment on column public.pusula_experiment_states.review_ready is
  'Human/internal review readiness only. It is not a model promotion, winner selection, score, or production authorization.';

comment on column public.pusula_experiment_states.pcse_field_state is
  'Independent PCSE-versus-manual-field-observation evidence state. Never compared as a ranking against CropForge.';

comment on column public.pusula_experiment_states.cropforge_field_state is
  'Independent CropForge-versus-manual-field-observation evidence state. Never compared as a ranking against PCSE.';

comment on column public.pusula_experiment_states.satellite_ndvi_days is
  'Count of dated Sentinel/Copernicus NDVI evidence days. NDVI is not treated as direct phenology ground truth.';
