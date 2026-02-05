-- Queue-first push notification pipeline:
-- - DB triggers enqueue rows into public.notification_requests
-- - pg_cron invokes public.process_notification_requests()/public.poll_expo_push_receipts()
--   which call Edge Functions using the Supabase service role JWT

do $$
begin
  if to_regprocedure('public.notify_post_like()') is not null then
    execute $sql$
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
    $sql$;
  end if;

  if to_regprocedure('public.notify_post_comment()') is not null then
    execute $sql$
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
    $sql$;
  end if;
end$$;

-- Indexes to keep queue processing and dedupe fast.
do $$
begin
  if to_regclass('public.notification_requests') is not null then
    execute 'create index if not exists notification_requests_unprocessed_created_at_idx on public.notification_requests (created_at) where processed is not true';
    execute 'create index if not exists notification_requests_unprocessed_dedupe_idx on public.notification_requests (user_id, type, (data->>''collapse_key''), created_at) where processed is not true';
  end if;
end$$;

-- Ensure service_role can process and mark rows as processed when RLS is FORCEd.
do $$
begin
  if to_regclass('public.notification_requests') is not null then
    execute 'alter table public.notification_requests enable row level security';
    execute 'alter table public.notification_requests force row level security';

    if not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'notification_requests'
        and policyname = 'notification_requests_insert_postgres_or_service_role'
    ) then
      execute $sql$
        create policy "notification_requests_insert_postgres_or_service_role"
        on public.notification_requests
        for insert
        to public
        with check (
          current_user = 'postgres'
          or (select auth.role()) = 'service_role'
        )
      $sql$;
    end if;

    if not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'notification_requests'
        and policyname = 'notification_requests_update_service_role'
    ) then
      execute $sql$
        create policy "notification_requests_update_service_role"
        on public.notification_requests
        for update
        to public
        using ((select auth.role()) = 'service_role')
        with check ((select auth.role()) = 'service_role')
      $sql$;
    end if;
  end if;

  if to_regclass('public.push_notification_queue') is not null then
    execute 'alter table public.push_notification_queue enable row level security';
    execute 'alter table public.push_notification_queue force row level security';

    if not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'push_notification_queue'
        and policyname = 'push_notification_queue_insert_service_role'
    ) then
      execute $sql$
        create policy "push_notification_queue_insert_service_role"
        on public.push_notification_queue
        for insert
        to public
        with check ((select auth.role()) = 'service_role')
      $sql$;
    end if;

    if not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'push_notification_queue'
        and policyname = 'push_notification_queue_update_service_role'
    ) then
      execute $sql$
        create policy "push_notification_queue_update_service_role"
        on public.push_notification_queue
        for update
        to public
        using ((select auth.role()) = 'service_role')
        with check ((select auth.role()) = 'service_role')
      $sql$;
    end if;
  end if;
end$$;

