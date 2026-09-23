create table if not exists public.model_shadow_calibration_states (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  field_id uuid not null references public.fields(id) on delete cascade,
  season_key text not null check (length(btrim(season_key)) > 0),
  status text not null check (
    status in ('insufficient_evidence', 'observing', 'consistent', 'divergent', 'blocked')
  ),
  review_eligible boolean not null default false,
  required_clean_phenology_days integer not null default 3 check (required_clean_phenology_days >= 1),
  phenology_comparable_days integer not null default 0 check (phenology_comparable_days >= 0),
  phenology_clean_streak integer not null default 0 check (phenology_clean_streak >= 0),
  phenology_watch_days integer not null default 0 check (phenology_watch_days >= 0),
  phenology_high_days integer not null default 0 check (phenology_high_days >= 0),
  aquacrop_completed_days integer not null default 0 check (aquacrop_completed_days >= 0),
  required_aquacrop_evidence_days integer not null default 3 check (required_aquacrop_evidence_days >= 1),
  water_evidence_state text not null default 'none' check (
    water_evidence_state in ('none', 'observing', 'covered')
  ),
  latest_comparison_day date,
  latest_comparison_status text,
  latest_phenology_comparable boolean not null default false,
  latest_agronomic_severity text not null default 'none' check (
    latest_agronomic_severity in ('none', 'watch', 'high')
  ),
  last_divergence_day date,
  distinct_days integer not null default 0 check (distinct_days >= 0),
  evidence jsonb not null default '{}'::jsonb,
  production_authority boolean not null default false check (production_authority = false),
  user_visible boolean not null default false check (user_visible = false),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, field_id, season_key)
);

create index if not exists model_shadow_calibration_user_field_updated_idx
  on public.model_shadow_calibration_states (user_id, field_id, updated_at desc);

create index if not exists model_shadow_calibration_status_updated_idx
  on public.model_shadow_calibration_states (status, updated_at desc);

alter table public.model_shadow_calibration_states enable row level security;

revoke all on table public.model_shadow_calibration_states from anon, authenticated;

comment on table public.model_shadow_calibration_states is
  'Internal-only repeated-day calibration gate for model shadow evidence. Never grants production authority and is never farmer-facing.';

comment on column public.model_shadow_calibration_states.review_eligible is
  'Internal evidence-review eligibility only. It must never be interpreted as automatic model promotion or production authority.';

comment on column public.model_shadow_calibration_states.water_evidence_state is
  'AquaCrop evidence coverage tracked separately from PCSE/CropForge phenology agreement.';
