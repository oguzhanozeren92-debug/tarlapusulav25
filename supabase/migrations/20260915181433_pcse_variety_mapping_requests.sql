create table if not exists public.pcse_variety_mapping_requests (
  id uuid primary key default gen_random_uuid(),
  crop_name text not null,
  local_variety_name text not null,
  normalized_local_variety_name text not null,
  wofost_crop_key text not null,
  model_family text not null default 'WOFOST',
  model_version text not null default '7.2',
  status text not null default 'pending' check (status in ('pending','mapped','ignored')),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (crop_name, normalized_local_variety_name, model_version)
);

alter table public.pcse_variety_mapping_requests enable row level security;

revoke all on table public.pcse_variety_mapping_requests from public, anon, authenticated;
grant all on table public.pcse_variety_mapping_requests to service_role;

create index if not exists pcse_variety_mapping_requests_status_last_seen_idx
  on public.pcse_variety_mapping_requests (status, last_seen_at desc);
