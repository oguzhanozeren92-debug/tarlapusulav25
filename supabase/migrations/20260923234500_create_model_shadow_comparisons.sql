create table if not exists public.model_shadow_comparisons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  field_id uuid not null references public.fields(id) on delete cascade,
  comparison_day date not null,
  season_key text not null default 'unknown',
  comparison_as_of date,
  status text not null check (status in ('complete', 'partial', 'blocked', 'failed')),
  severity text not null check (severity in ('none', 'watch', 'high')),
  fingerprint text not null,
  engines jsonb not null default '{}'::jsonb,
  normalized jsonb not null default '{}'::jsonb,
  divergences jsonb not null default '[]'::jsonb,
  production_authority boolean not null default false check (production_authority = false),
  user_visible boolean not null default false check (user_visible = false),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, field_id, comparison_day)
);

create index if not exists model_shadow_comparisons_user_field_updated_idx
  on public.model_shadow_comparisons (user_id, field_id, updated_at desc);

create index if not exists model_shadow_comparisons_severity_updated_idx
  on public.model_shadow_comparisons (severity, updated_at desc);

alter table public.model_shadow_comparisons enable row level security;

revoke all on table public.model_shadow_comparisons from anon, authenticated;

comment on table public.model_shadow_comparisons is
  'Internal-only PCSE/AquaCrop/CropForge shadow comparison snapshots. Never production authority or farmer-facing output.';

comment on column public.model_shadow_comparisons.divergences is
  'Scope-aware internal discrepancy flags. Missing/non-comparable metrics must not be coerced into disagreements.';
