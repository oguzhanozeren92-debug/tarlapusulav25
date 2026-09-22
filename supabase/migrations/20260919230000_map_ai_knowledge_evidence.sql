alter table public.map_ai_analyses
  add column if not exists knowledge_sources jsonb not null default '[]'::jsonb;

comment on column public.map_ai_analyses.knowledge_sources is
  'Server-validated approved Knowledge Engine sources used by Pusula AI; never model-invented citations.';
