-- Improve notification request processing reliability:
-- - Claim marks rows in-flight (claimed_at/claim_id) but NOT processed
-- - Worker ACKs (processed=true) only after send attempt success/non-retryable/terminal failure
-- - Reclaim rows if worker crashes (claimed_at older than 5 minutes)
-- - Add retry scheduling via next_attempt_at and attempt_count

do $$
begin
  if to_regclass('public.notification_requests') is not null then
    execute 'alter table public.notification_requests add column if not exists claim_id uuid';
    execute 'alter table public.notification_requests add column if not exists claimed_at timestamptz';
    execute 'alter table public.notification_requests add column if not exists attempt_count int not null default 0';
    execute 'alter table public.notification_requests add column if not exists last_attempt_at timestamptz';
    execute 'alter table public.notification_requests add column if not exists next_attempt_at timestamptz';
    execute 'alter table public.notification_requests add column if not exists last_error text';

    execute 'create index if not exists notification_requests_claimable_idx on public.notification_requests (next_attempt_at, claimed_at, created_at) where processed is not true';
  end if;
end$$;

-- Replace claim_notification_requests(): claim rows without marking them processed.
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
            and (nr.next_attempt_at is null or nr.next_attempt_at <= now())
            and (nr.claimed_at is null or nr.claimed_at < now() - interval '5 minutes')
          order by nr.created_at
          limit greatest(1, batch_size)
          for update skip locked
        ),
        updated as (
          update public.notification_requests nr
          set claimed_at = now(),
              claim_id = gen_random_uuid(),
              attempt_count = coalesce(nr.attempt_count, 0) + 1,
              last_attempt_at = now()
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

-- Reduce pg_net churn: only call worker when there is claimable work.
-- Note: This migration modifies an existing function. The service_key validation
-- is added by migration 20260124161500_h_fix_notification_auth_header.sql.
do $$
begin
  if to_regprocedure('public.process_notification_requests()') is not null then
    execute $sql$
      create or replace function public.process_notification_requests()
      returns void
      language plpgsql
      security definer
      set search_path to ''
      as $function$
      declare
        request_id bigint;
        api_url text;
      begin
        if not exists (
          select 1
          from public.notification_requests
          where processed is not true
            and (next_attempt_at is null or next_attempt_at <= now())
            and (claimed_at is null or claimed_at < now() - interval '5 minutes')
        ) then
          return;
        end if;

        api_url := public.get_config('supabase_api_url');
        if api_url is null or api_url = '' then
          raise warning 'process_notification_requests: supabase_api_url is not configured in app_config table';
          return;
        end if;

        select net.http_post(
          url := api_url || '/functions/v1/process-notification-requests',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('supabase.service_role_key', true)
          ),
          body := '{}'::jsonb
        ) into request_id;

        raise log 'Notification request processing submitted: %', request_id;
      exception
        when others then
          raise warning 'Error processing notification requests: % %', sqlerrm, sqlstate;
      end;
      $function$;
    $sql$;
  end if;
end$$;

