-- TarlaPusula content engine daily scheduler
-- Fan out one HTTP worker request per due source so a slow source cannot
-- block the remaining daily content scan.

create or replace function public.invoke_content_engine_scan_fanout(
  p_max_sources integer default 20,
  p_max_items integer default 2
)
returns integer
language plpgsql
security definer
set search_path to 'public', 'private', 'net', 'pg_temp'
as $$
declare
  scheduler_secret text;
  source_row record;
  request_id bigint;
  queued_count integer := 0;
begin
  select secret into scheduler_secret
  from private.scheduler_secrets
  where name = 'content_engine_daily';

  if scheduler_secret is null or scheduler_secret = '' then
    raise exception 'content engine scheduler secret is missing';
  end if;

  for source_row in
    select id
    from public.content_sources
    where active = true
      and source_type <> 'image_library'
      and (
        last_scanned_at is null
        or last_scanned_at <= now() - make_interval(hours => scan_frequency_hours)
      )
    order by trust_score desc, last_scanned_at nulls first
    limit greatest(1, least(coalesce(p_max_sources, 20), 40))
  loop
    select net.http_post(
      url := 'https://xwyfidtktauxivsosmex.supabase.co/functions/v1/content-engine-scan',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-token', scheduler_secret
      ),
      body := jsonb_build_object(
        'sourceId', source_row.id,
        'maxSources', 1,
        'maxItemsPerSource', greatest(1, least(coalesce(p_max_items, 2), 4))
      ),
      timeout_milliseconds := 120000
    ) into request_id;

    queued_count := queued_count + 1;
  end loop;

  return queued_count;
end;
$$;

revoke all on function public.invoke_content_engine_scan_fanout(integer, integer) from public;
revoke all on function public.invoke_content_engine_scan_fanout(integer, integer) from anon;
revoke all on function public.invoke_content_engine_scan_fanout(integer, integer) from authenticated;
grant execute on function public.invoke_content_engine_scan_fanout(integer, integer) to service_role;

select cron.unschedule('tarlapusula-content-engine-daily');
select cron.schedule(
  'tarlapusula-content-engine-daily',
  '15 3 * * *',
  'select public.invoke_content_engine_scan_fanout(20, 2);'
);
