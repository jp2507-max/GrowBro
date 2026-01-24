-- Reduce pg_net churn: only call Edge Functions when there is work to do.

create or replace function public.process_notification_requests()
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  request_id bigint;
begin
  if not exists (
    select 1
    from public.notification_requests
    where processed is not true
  ) then
    return;
  end if;

  select net.http_post(
    url := 'https://mgbekkpswaizzthgefbc.supabase.co/functions/v1/process-notification-requests',
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

create or replace function public.poll_expo_push_receipts()
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  request_id bigint;
begin
  if not exists (
    select 1
    from public.push_notification_queue
    where status = 'sent'
      and provider_message_name is not null
  ) then
    return;
  end if;

  select net.http_post(
    url := 'https://mgbekkpswaizzthgefbc.supabase.co/functions/v1/poll-push-receipts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('supabase.service_role_key', true)
    ),
    body := '{}'::jsonb
  ) into request_id;

  raise log 'Receipt polling request submitted: %', request_id;
exception
  when others then
    raise warning 'Error polling receipts: % %', sqlerrm, sqlstate;
end;
$function$;

