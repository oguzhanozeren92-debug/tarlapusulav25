alter table public.field_ai_observations
  add column if not exists knowledge_sources jsonb not null default '[]'::jsonb;

comment on column public.field_ai_observations.knowledge_sources is
  'Approved Knowledge Engine sources attached to this Pusula observation. Empty when no reviewed source contributed.';

create index if not exists field_ai_observations_knowledge_sources_gin
  on public.field_ai_observations using gin (knowledge_sources jsonb_path_ops);
