-- Fix pg_cron -> pg_net -> Edge Function auth:
-- - Supabase does not expose a built-in GUC for the service role key in this project.
-- - Read the service role JWT from Supabase Vault instead.
--
-- Required manual step (Dashboard): add Vault secret named 'supabase_service_role_key'
-- containing your project's service role key (JWT).

do $$
begin
  -- Helper to fetch the service role JWT from Vault.
  -- SECURITY DEFINER and execution restricted to postgres because it returns a secret.
  execute $sql$
    create or replace function public._get_service_role_jwt_from_vault()
    returns text
    language sql
    security definer
    set search_path to ''
    as $function$
      select ds.decrypted_secret
      from vault.decrypted_secrets ds
      where ds.name = 'supabase_service_role_key'
      order by ds.created_at desc
      limit 1;
    $function$;
  $sql$;

  execute 'revoke execute on function public._get_service_role_jwt_from_vault() from public, anon, authenticated, service_role';
  execute 'grant execute on function public._get_service_role_jwt_from_vault() to postgres';
exception
  when undefined_table then
    -- Vault extension might be disabled; do not break migrations.
    raise warning 'Vault not available; cannot create _get_service_role_jwt_from_vault()';
end$$;

do $$
declare
  v_jwt text;
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
        v_jwt text;
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

        v_jwt := public._get_service_role_jwt_from_vault();
        if v_jwt is null or v_jwt = '' then
          raise warning 'process_notification_requests: missing Vault secret supabase_service_role_key';
          return;
        end if;

        select net.http_post(
          url := 'https://mgbekkpswaizzthgefbc.supabase.co/functions/v1/process-notification-requests',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_jwt
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

  if to_regprocedure('public.poll_expo_push_receipts()') is not null then
    execute $sql$
      create or replace function public.poll_expo_push_receipts()
      returns void
      language plpgsql
      security definer
      set search_path to ''
      as $function$
      declare
        request_id bigint;
        v_jwt text;
      begin
        if not exists (
          select 1
          from public.push_notification_queue
          where status = 'sent'
            and provider_message_name is not null
        ) then
          return;
        end if;

        v_jwt := public._get_service_role_jwt_from_vault();
        if v_jwt is null or v_jwt = '' then
          raise warning 'poll_expo_push_receipts: missing Vault secret supabase_service_role_key';
          return;
        end if;

        select net.http_post(
          url := 'https://mgbekkpswaizzthgefbc.supabase.co/functions/v1/poll-push-receipts',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_jwt
          ),
          body := '{}'::jsonb
        ) into request_id;

        raise log 'Receipt polling request submitted: %', request_id;
      exception
        when others then
          raise warning 'Error polling receipts: % %', sqlerrm, sqlstate;
      end;
      $function$;
    $sql$;
  end if;
end$$;

