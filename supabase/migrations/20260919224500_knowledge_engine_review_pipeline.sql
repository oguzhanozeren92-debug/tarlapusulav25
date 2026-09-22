create table if not exists public.knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  source_name text not null default '',
  source_url text,
  storage_bucket text not null default 'knowledge-documents',
  storage_path text not null,
  mime_type text not null default 'application/pdf',
  file_size bigint,
  language text not null default 'tr',
  status text not null default 'queued' check (status in ('queued','processing','review','approved','rejected','failed')),
  extraction_model text,
  page_count integer check (page_count is null or page_count > 0),
  metadata jsonb not null default '{}'::jsonb,
  error_message text,
  created_by uuid references auth.users(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create unique index if not exists knowledge_documents_storage_path_uidx on public.knowledge_documents(storage_bucket, storage_path);
create index if not exists knowledge_documents_status_idx on public.knowledge_documents(status, created_at desc);

create table if not exists public.knowledge_claims (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.knowledge_documents(id) on delete cascade,
  claim_text text not null,
  summary_tr text not null default '',
  crop text,
  topics text[] not null default '{}'::text[],
  tags text[] not null default '{}'::text[],
  source_page integer check (source_page is null or source_page > 0),
  evidence_excerpt text,
  extraction_confidence text not null default 'preliminary' check (extraction_confidence in ('strong','medium','preliminary')),
  status text not null default 'candidate' check (status in ('candidate','approved','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz
);

create index if not exists knowledge_claims_document_idx on public.knowledge_claims(document_id, status);
create index if not exists knowledge_claims_status_idx on public.knowledge_claims(status, created_at desc);
create index if not exists knowledge_claims_topics_gin on public.knowledge_claims using gin(topics);
create index if not exists knowledge_claims_tags_gin on public.knowledge_claims using gin(tags);

create table if not exists public.knowledge_relations (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.knowledge_documents(id) on delete cascade,
  claim_id uuid references public.knowledge_claims(id) on delete cascade,
  subject_type text not null,
  subject_name text not null,
  relation text not null,
  object_type text not null,
  object_name text not null,
  source_page integer check (source_page is null or source_page > 0),
  status text not null default 'candidate' check (status in ('candidate','approved','rejected')),
  created_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz
);

create index if not exists knowledge_relations_document_idx on public.knowledge_relations(document_id, status);
create index if not exists knowledge_relations_subject_idx on public.knowledge_relations(lower(subject_name), relation);
create index if not exists knowledge_relations_object_idx on public.knowledge_relations(lower(object_name), relation);

alter table public.knowledge_documents enable row level security;
alter table public.knowledge_claims enable row level security;
alter table public.knowledge_relations enable row level security;

drop policy if exists knowledge_documents_read on public.knowledge_documents;
create policy knowledge_documents_read on public.knowledge_documents for select to authenticated using (status = 'approved' or public.is_admin());
drop policy if exists knowledge_documents_admin_write on public.knowledge_documents;
create policy knowledge_documents_admin_write on public.knowledge_documents for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists knowledge_claims_read on public.knowledge_claims;
create policy knowledge_claims_read on public.knowledge_claims for select to authenticated using (
  public.is_admin() or (
    status = 'approved' and exists (
      select 1 from public.knowledge_documents d where d.id = document_id and d.status = 'approved'
    )
  )
);
drop policy if exists knowledge_claims_admin_write on public.knowledge_claims;
create policy knowledge_claims_admin_write on public.knowledge_claims for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists knowledge_relations_read on public.knowledge_relations;
create policy knowledge_relations_read on public.knowledge_relations for select to authenticated using (
  public.is_admin() or (
    status = 'approved' and exists (
      select 1 from public.knowledge_documents d where d.id = document_id and d.status = 'approved'
    )
  )
);
drop policy if exists knowledge_relations_admin_write on public.knowledge_relations;
create policy knowledge_relations_admin_write on public.knowledge_relations for all to authenticated using (public.is_admin()) with check (public.is_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('knowledge-documents', 'knowledge-documents', false, 12582912, array['application/pdf'])
on conflict (id) do update
set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists knowledge_documents_storage_read on storage.objects;
create policy knowledge_documents_storage_read on storage.objects for select to authenticated using (bucket_id = 'knowledge-documents' and public.is_admin());
drop policy if exists knowledge_documents_storage_insert on storage.objects;
create policy knowledge_documents_storage_insert on storage.objects for insert to authenticated with check (bucket_id = 'knowledge-documents' and public.is_admin());
drop policy if exists knowledge_documents_storage_update on storage.objects;
create policy knowledge_documents_storage_update on storage.objects for update to authenticated using (bucket_id = 'knowledge-documents' and public.is_admin()) with check (bucket_id = 'knowledge-documents' and public.is_admin());
drop policy if exists knowledge_documents_storage_delete on storage.objects;
create policy knowledge_documents_storage_delete on storage.objects for delete to authenticated using (bucket_id = 'knowledge-documents' and public.is_admin());

create or replace function public.retrieve_knowledge(
  p_query text default '',
  p_crop text default null,
  p_topics text[] default '{}'::text[],
  p_limit integer default 8
)
returns table (
  claim_id uuid,
  claim_text text,
  summary_tr text,
  crop text,
  topics text[],
  tags text[],
  source_page integer,
  source_name text,
  source_url text,
  document_title text,
  document_id uuid,
  approved_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.claim_text, c.summary_tr, c.crop, c.topics, c.tags, c.source_page,
         d.source_name, d.source_url, d.title, d.id, c.reviewed_at
  from public.knowledge_claims c
  join public.knowledge_documents d on d.id = c.document_id
  where c.status = 'approved' and d.status = 'approved'
    and (
      nullif(trim(coalesce(p_query, '')), '') is null
      or lower(c.claim_text) like '%' || lower(trim(p_query)) || '%'
      or lower(c.summary_tr) like '%' || lower(trim(p_query)) || '%'
      or exists (select 1 from unnest(c.topics || c.tags) value where lower(value) like '%' || lower(trim(p_query)) || '%')
    )
    and (
      nullif(trim(coalesce(p_crop, '')), '') is null
      or lower(coalesce(c.crop, '')) = lower(trim(p_crop))
      or exists (select 1 from unnest(c.tags) value where lower(value) = lower(trim(p_crop)))
    )
    and (
      coalesce(cardinality(p_topics), 0) = 0
      or c.topics && p_topics
      or c.tags && p_topics
    )
  order by c.reviewed_at desc nulls last, c.created_at desc
  limit greatest(1, least(coalesce(p_limit, 8), 20));
$$;

revoke all on function public.retrieve_knowledge(text, text, text[], integer) from public;
grant execute on function public.retrieve_knowledge(text, text, text[], integer) to authenticated;
