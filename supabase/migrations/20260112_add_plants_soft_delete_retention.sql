alter table public.plants add column if not exists deleted_at timestamptz;

create index if not exists plants_deleted_at_idx on public.plants (deleted_at);

do $$
begin
  if not exists (select 1 from cron.job where jobname = 'purge_deleted_plants') then
    perform cron.schedule(
      'purge_deleted_plants',
      '0 3 * * *',
      $cron$delete from public.plants where deleted_at is not null and deleted_at < now() - interval '10 days';$cron$
    );
  end if;
end $$;
