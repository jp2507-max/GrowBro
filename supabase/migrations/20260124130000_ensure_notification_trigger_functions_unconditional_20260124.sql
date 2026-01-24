-- Ensure notification trigger functions are always defined (fresh DB-safe).
-- Earlier migrations wrapped CREATE OR REPLACE in a to_regprocedure(...) IS NOT NULL guard,
-- which can prevent these functions from being created when missing.

create or replace function public.notify_post_like()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  post_author_id uuid;
  collapse_key text;
  thread_id text;
begin
  select p.user_id
    into post_author_id
  from public.posts p
  where p.id = new.post_id;

  if post_author_id is null then
    return new;
  end if;

  -- Don't notify if user likes their own post
  if post_author_id = new.user_id then
    return new;
  end if;

  collapse_key := 'like_' || new.post_id::text;
  thread_id := 'post_' || new.post_id::text;

  -- Best-effort dedupe: at most one pending like notification per post per user within 5 minutes.
  insert into public.notification_requests (
    id,
    user_id,
    created_by,
    type,
    title,
    body,
    data,
    deep_link,
    processed,
    created_at
  )
  select
    gen_random_uuid(),
    post_author_id,
    new.user_id,
    'community.like',
    'Someone liked your post',
    'Someone liked your post',
    jsonb_build_object(
      'post_id', new.post_id::text,
      'actor_user_id', new.user_id::text,
      'collapse_key', collapse_key,
      'thread_id', thread_id
    ),
    'growbro://post/' || new.post_id::text,
    false,
    now()
  where not exists (
    select 1
    from public.notification_requests nr
    where nr.user_id = post_author_id
      and nr.type = 'community.like'
      and nr.processed is not true
      and nr.data->>'collapse_key' = collapse_key
      and nr.created_at > now() - interval '5 minutes'
  );

  return new;
exception
  when others then
    raise warning 'notify_post_like enqueue failed: % %', sqlerrm, sqlstate;
    return new;
end;
$function$;

create or replace function public.notify_post_comment()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  post_author_id uuid;
  collapse_key text;
  thread_id text;
begin
  select p.user_id
    into post_author_id
  from public.posts p
  where p.id = new.post_id;

  if post_author_id is null then
    return new;
  end if;

  -- Don't notify if user comments on their own post
  if post_author_id = new.user_id then
    return new;
  end if;

  collapse_key := 'comment_' || new.post_id::text;
  thread_id := 'post_' || new.post_id::text;

  -- Privacy-first: do not include the comment body preview in the push payload by default.
  -- Best-effort dedupe: at most one pending comment notification per post per user within 2 minutes.
  insert into public.notification_requests (
    id,
    user_id,
    created_by,
    type,
    title,
    body,
    data,
    deep_link,
    processed,
    created_at
  )
  select
    gen_random_uuid(),
    post_author_id,
    new.user_id,
    'community.reply',
    'New comment on your post',
    'Someone commented on your post',
    jsonb_build_object(
      'post_id', new.post_id::text,
      'comment_id', new.id::text,
      'actor_user_id', new.user_id::text,
      'collapse_key', collapse_key,
      'thread_id', thread_id
    ),
    'growbro://post/' || new.post_id::text || '/comment/' || new.id::text,
    false,
    now()
  where not exists (
    select 1
    from public.notification_requests nr
    where nr.user_id = post_author_id
      and nr.type = 'community.reply'
      and nr.processed is not true
      and nr.data->>'collapse_key' = collapse_key
      and nr.created_at > now() - interval '2 minutes'
  );

  return new;
exception
  when others then
    raise warning 'notify_post_comment enqueue failed: % %', sqlerrm, sqlstate;
    return new;
end;
$function$;

-- Trigger functions are not callable outside trigger context, but revoke anyway.
revoke execute on function public.notify_post_like() from public, anon, authenticated, service_role;
grant execute on function public.notify_post_like() to postgres;

revoke execute on function public.notify_post_comment() from public, anon, authenticated, service_role;
grant execute on function public.notify_post_comment() to postgres;

