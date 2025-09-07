import {
  addColumns,
  schemaMigrations,
} from '@nozbe/watermelondb/Schema/migrations';

export const migrations = schemaMigrations({
  migrations: [
    {
      toVersion: 2,
      steps: [
        addColumns({
          table: 'occurrence_overrides',
          columns: [{ name: 'deleted_at', type: 'number', isOptional: true }],
        }),
      ],
    },
    {
      toVersion: 3,
      steps: [
        // Create image_upload_queue table
        // WatermelonDB migration helper doesn't have createTable, so bumping version requires full reset for new table in prod.
        // For dev/staging, we accept destructive reset when schema changes. In production, include a custom migration or gate table usage.
      ],
    },
  ],
});
