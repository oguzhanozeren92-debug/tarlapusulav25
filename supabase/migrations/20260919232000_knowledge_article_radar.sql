create table if not exists public.knowledge_article_candidates (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'openalex',
  provider_id text not null,
  title text not null,
  doi text,
  publication_date date,
  publication_year integer,
  work_type text,
  language text,
  authors jsonb not null default '[]'::jsonb,
  source_name text,
  cited_by_count integer not null default 0,
  topics text[] not null default '{}'::text[],
  is_oa boolean not null default false,
  oa_status text,
  oa_url text,
  pdf_url text,
  license text,
  status text not null default 'candidate' check (status in ('candidate','ignored','imported')),
  search_query text,
  document_id uuid references public.knowledge_documents(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  discovered_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  unique(provider, provider_id)
);

create index if not exists knowledge_article_candidates_status_idx on public.knowledge_article_candidates(status, discovered_at desc);
create index if not exists knowledge_article_candidates_publication_idx on public.knowledge_article_candidates(publication_year desc nulls last);
create index if not exists knowledge_article_candidates_document_idx on public.knowledge_article_candidates(document_id);
create index if not exists knowledge_article_candidates_reviewed_by_idx on public.knowledge_article_candidates(reviewed_by);

alter table public.knowledge_article_candidates enable row level security;

drop policy if exists knowledge_article_candidates_admin_select on public.knowledge_article_candidates;
drop policy if exists knowledge_article_candidates_admin_insert on public.knowledge_article_candidates;
drop policy if exists knowledge_article_candidates_admin_update on public.knowledge_article_candidates;
drop policy if exists knowledge_article_candidates_admin_delete on public.knowledge_article_candidates;
create policy knowledge_article_candidates_admin_select on public.knowledge_article_candidates for select to authenticated using (public.is_admin());
create policy knowledge_article_candidates_admin_insert on public.knowledge_article_candidates for insert to authenticated with check (public.is_admin());
create policy knowledge_article_candidates_admin_update on public.knowledge_article_candidates for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy knowledge_article_candidates_admin_delete on public.knowledge_article_candidates for delete to authenticated using (public.is_admin());
