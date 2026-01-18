create extension if not exists pg_cron;

alter table public.plants add column if not exists deleted_at timestamptz;

create index if not exists plants_deleted_at_idx on public.plants (deleted_at)
  where deleted_at is not null;

do $$
begin
  -- consistent upsert of the job
  perform cron.unschedule('purge_deleted_plants');
  perform cron.schedule(
    'purge_deleted_plants',
    '0 3 * * *',
    $cron$
      delete from public.plants
      where id in (
        select id from public.plants
        where deleted_at is not null
          and deleted_at < now() - interval '10 days'
        limit 1000
        for update skip locked
      );
    $cron$
  );
end $$;
