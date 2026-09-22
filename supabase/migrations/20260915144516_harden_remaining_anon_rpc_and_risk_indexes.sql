revoke execute on function public.tp_assign_field_sort_order() from public, anon;
revoke execute on function public.tp_complete_action_task(uuid) from public, anon;
revoke execute on function public.tp_refresh_action_tasks(uuid) from public, anon;
revoke execute on function public.tp_reorder_fields(uuid[]) from public, anon;

create index if not exists field_map_layer_cache_field_id_idx
  on public.field_map_layer_cache(field_id);

create index if not exists field_risk_notification_state_field_id_idx
  on public.field_risk_notification_state(field_id);

drop policy if exists "Users can view own risk notification state"
  on public.field_risk_notification_state;

create policy "Users can view own risk notification state"
  on public.field_risk_notification_state
  for select
  to authenticated
  using ((select auth.uid()) = user_id);
