create table if not exists public.official_verification_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  field_id uuid null,
  job_id uuid null references public.ai_image_analysis_jobs(id) on delete cascade,
  domain text not null,
  source text not null,
  status text not null,
  source_url text null,
  source_reachable boolean null,
  crop text null,
  issue text null,
  blocked_recommendations jsonb not null default '[]'::jsonb,
  verification jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists official_verification_events_user_created_idx
  on public.official_verification_events(user_id, created_at desc);

create index if not exists official_verification_events_job_idx
  on public.official_verification_events(job_id);

alter table public.official_verification_events enable row level security;

drop policy if exists "Users can read own official verification events"
  on public.official_verification_events;

create policy "Users can read own official verification events"
  on public.official_verification_events
  for select
  to authenticated
  using (auth.uid() = user_id);

revoke insert, update, delete on public.official_verification_events from anon, authenticated;
grant select on public.official_verification_events to authenticated;
