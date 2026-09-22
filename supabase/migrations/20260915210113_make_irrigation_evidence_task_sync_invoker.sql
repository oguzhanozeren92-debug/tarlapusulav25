alter function public.tp_sync_irrigation_evidence_tasks(uuid) security invoker;

revoke all on function public.tp_sync_irrigation_evidence_tasks(uuid) from public;
revoke all on function public.tp_sync_irrigation_evidence_tasks(uuid) from anon;
grant execute on function public.tp_sync_irrigation_evidence_tasks(uuid) to authenticated;
