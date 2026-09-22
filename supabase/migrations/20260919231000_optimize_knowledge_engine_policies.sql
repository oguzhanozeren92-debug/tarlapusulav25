create index if not exists knowledge_documents_created_by_idx on public.knowledge_documents(created_by);
create index if not exists knowledge_documents_reviewed_by_idx on public.knowledge_documents(reviewed_by);
create index if not exists knowledge_claims_reviewed_by_idx on public.knowledge_claims(reviewed_by);
create index if not exists knowledge_relations_claim_id_idx on public.knowledge_relations(claim_id);
create index if not exists knowledge_relations_reviewed_by_idx on public.knowledge_relations(reviewed_by);

drop policy if exists knowledge_documents_admin_write on public.knowledge_documents;
drop policy if exists knowledge_documents_admin_insert on public.knowledge_documents;
drop policy if exists knowledge_documents_admin_update on public.knowledge_documents;
drop policy if exists knowledge_documents_admin_delete on public.knowledge_documents;
create policy knowledge_documents_admin_insert on public.knowledge_documents for insert to authenticated with check (public.is_admin());
create policy knowledge_documents_admin_update on public.knowledge_documents for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy knowledge_documents_admin_delete on public.knowledge_documents for delete to authenticated using (public.is_admin());

drop policy if exists knowledge_claims_admin_write on public.knowledge_claims;
drop policy if exists knowledge_claims_admin_insert on public.knowledge_claims;
drop policy if exists knowledge_claims_admin_update on public.knowledge_claims;
drop policy if exists knowledge_claims_admin_delete on public.knowledge_claims;
create policy knowledge_claims_admin_insert on public.knowledge_claims for insert to authenticated with check (public.is_admin());
create policy knowledge_claims_admin_update on public.knowledge_claims for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy knowledge_claims_admin_delete on public.knowledge_claims for delete to authenticated using (public.is_admin());

drop policy if exists knowledge_relations_admin_write on public.knowledge_relations;
drop policy if exists knowledge_relations_admin_insert on public.knowledge_relations;
drop policy if exists knowledge_relations_admin_update on public.knowledge_relations;
drop policy if exists knowledge_relations_admin_delete on public.knowledge_relations;
create policy knowledge_relations_admin_insert on public.knowledge_relations for insert to authenticated with check (public.is_admin());
create policy knowledge_relations_admin_update on public.knowledge_relations for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy knowledge_relations_admin_delete on public.knowledge_relations for delete to authenticated using (public.is_admin());
