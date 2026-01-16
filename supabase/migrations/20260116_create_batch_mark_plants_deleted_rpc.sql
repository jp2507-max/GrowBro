-- RPC function to batch mark plants as deleted
-- Used by plants-sync.ts to efficiently push soft deletions to the cloud
create or replace function public.batch_mark_plants_deleted(updates jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  update_record jsonb;
begin
  -- Iterate through the JSON array of updates
  for update_record in select * from jsonb_array_elements(updates)
  loop
    -- Only update existing plants that belong to the specified user
    -- This prevents creating new rows and avoids NOT NULL constraint violations
    update public.plants
    set
      deleted_at = (update_record->>'deleted_at')::timestamptz,
      updated_at = (update_record->>'updated_at')::timestamptz
    where
      id = (update_record->>'id')::uuid
      and user_id = (update_record->>'user_id')::uuid;
  end loop;
end;
$$;

-- Grant execute permission to authenticated users
grant execute on function public.batch_mark_plants_deleted(jsonb) to authenticated;
