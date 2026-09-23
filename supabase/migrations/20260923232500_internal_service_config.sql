create table if not exists public.internal_service_config (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table public.internal_service_config enable row level security;
revoke all on table public.internal_service_config from anon, authenticated;
grant select on table public.internal_service_config to service_role;

comment on table public.internal_service_config is
  'Service-role-only runtime configuration. Values are provisioned outside source control; no client policies.';
