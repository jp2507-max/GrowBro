-- Reduce growth/bloat in pg_net response table by pruning old rows.
-- This is safe because application logic should not depend on historical pg_net responses.

create or replace function public.prune_pg_net_http_responses(
  max_rows int default 20000,
  keep_days int default 7
)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_deleted int;
begin
  if to_regclass('net._http_response') is null then
    return;
  end if;

  with target as (
    select id
    from net._http_response
    where created < now() - make_interval(days => greatest(1, keep_days))
    order by created
    limit greatest(1, max_rows)
    for update skip locked
  ),
  del as (
    delete from net._http_response r
    using target t
    where r.id = t.id
    returning 1
  )
  select count(*) into v_deleted from del;

  raise log 'prune_pg_net_http_responses: deleted % net._http_response rows', v_deleted;
exception
  when others then
    raise warning 'prune_pg_net_http_responses failed: % %', sqlerrm, sqlstate;
end;
$$;

revoke execute on function public.prune_pg_net_http_responses(int,int) from public, anon, authenticated, service_role;
grant execute on function public.prune_pg_net_http_responses(int,int) to postgres;

-- Schedule daily prune (idempotent): 03:40 UTC.
do $$
begin
  if to_regprocedure('cron.unschedule(text)') is not null and to_regprocedure('cron.schedule(text,text,text)') is not null then
    begin
      perform cron.unschedule('prune_pg_net_http_responses_daily');
    exception
      when others then
        null;
    end;

    perform cron.schedule(
      'prune_pg_net_http_responses_daily',
      '40 3 * * *',
      'select public.prune_pg_net_http_responses();'
    );
  end if;
end$$;

