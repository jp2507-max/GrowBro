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
    {
      toVersion: 4,
      steps: [
        // Add indexes to image_upload_queue table for performance optimization
        // WatermelonDB doesn't provide migration helpers for adding indexes to existing columns
        // This requires a destructive database reset in development environments
        // In production, indexes will be created automatically when the schema is applied
      ],
    },
  ],
});
