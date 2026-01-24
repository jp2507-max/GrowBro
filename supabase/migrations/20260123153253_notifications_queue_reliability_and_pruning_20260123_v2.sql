-- Security: prevent clients from invoking cron/http helper functions.
-- These functions run as SECURITY DEFINER and call Edge Functions with a service role JWT.

do $$
begin
  if to_regprocedure('public.process_notification_requests()') is not null then
    execute 'revoke execute on function public.process_notification_requests() from public, anon, authenticated, service_role';
    execute 'grant execute on function public.process_notification_requests() to postgres';
  end if;

  if to_regprocedure('public.poll_expo_push_receipts()') is not null then
    execute 'revoke execute on function public.poll_expo_push_receipts() from public, anon, authenticated, service_role';
    execute 'grant execute on function public.poll_expo_push_receipts() to postgres';
  end if;

  -- Trigger functions are not callable outside trigger context, but revoke anyway.
  if to_regprocedure('public.notify_post_like()') is not null then
    execute 'revoke execute on function public.notify_post_like() from public, anon, authenticated, service_role';
    execute 'grant execute on function public.notify_post_like() to postgres';
  end if;

  if to_regprocedure('public.notify_post_comment()') is not null then
    execute 'revoke execute on function public.notify_post_comment() from public, anon, authenticated, service_role';
    execute 'grant execute on function public.notify_post_comment() to postgres';
  end if;
end$$;

-- Queue reliability: atomically claim pending notification_requests using SKIP LOCKED.
-- Called by Edge Function (service_role) via RPC.
do $$
begin
  if to_regclass('public.notification_requests') is not null then
    execute $sql$
      create or replace function public.claim_notification_requests(batch_size int default 100)
      returns setof public.notification_requests
      language plpgsql
      set search_path to ''
      as $function$
      begin
        return query
        with picked as (
          select nr.id
          from public.notification_requests nr
          where nr.processed is not true
          order by nr.created_at
          limit greatest(1, batch_size)
          for update skip locked
        ),
        updated as (
          update public.notification_requests nr
          set processed = true,
              processed_at = now()
          from picked p
          where nr.id = p.id
          returning nr.*
        )
        select * from updated;
      end;
      $function$;
    $sql$;

    execute 'revoke execute on function public.claim_notification_requests(int) from public, anon, authenticated';
    execute 'grant execute on function public.claim_notification_requests(int) to service_role';
  end if;
end$$;

-- Retention: prune processed notification_requests and old push_notification_queue rows.
do $$
begin
  execute $sql$
    create or replace function public.prune_notification_tables(max_rows int default 5000)
    returns void
    language plpgsql
    security definer
    set search_path to ''
    as $function$
    declare
      v_deleted int;
    begin
      if to_regclass('public.notification_requests') is not null then
        with target as (
          select id
          from public.notification_requests
          where processed is true
            and created_at < now() - interval '30 days'
          order by created_at
          limit greatest(1, max_rows)
          for update skip locked
        ),
        del as (
          delete from public.notification_requests nr
          using target t
          where nr.id = t.id
          returning 1
        )
        select count(*) into v_deleted from del;
        raise log 'prune_notification_tables: deleted % notification_requests', v_deleted;
      end if;

      if to_regclass('public.push_notification_queue') is not null then
        with target as (
          select id
          from public.push_notification_queue
          where status in ('delivered','failed')
            and created_at < now() - interval '30 days'
          order by created_at
          limit greatest(1, max_rows)
          for update skip locked
        ),
        del as (
          delete from public.push_notification_queue q
          using target t
          where q.id = t.id
          returning 1
        )
        select count(*) into v_deleted from del;
        raise log 'prune_notification_tables: deleted % push_notification_queue rows', v_deleted;
      end if;
    exception
      when others then
        raise warning 'prune_notification_tables failed: % %', sqlerrm, sqlstate;
    end;
    $function$;
  $sql$;

  execute 'revoke execute on function public.prune_notification_tables(int) from public, anon, authenticated, service_role';
  execute 'grant execute on function public.prune_notification_tables(int) to postgres';
end$$;

-- Schedule daily prune (idempotent): 03:30 UTC.
do $$
begin
  if to_regprocedure('cron.unschedule(text)') is not null and to_regprocedure('cron.schedule(text,text,text)') is not null then
    begin
      perform cron.unschedule('prune_notification_tables_daily');
    exception
      when others then
        null;
    end;

    perform cron.schedule(
      'prune_notification_tables_daily',
      '30 3 * * *',
      'select public.prune_notification_tables();'
    );
  end if;
end$$;

