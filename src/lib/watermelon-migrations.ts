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
        addColumns({
          table: 'series',
          columns: [{ name: 'deleted_at', type: 'number', isOptional: true }],
        }),
      ],
    },
    {
      toVersion: 3,
      steps: [
        {
          type: 'create_table',
          schema: {
            name: 'image_upload_queue',
            columns: {
              local_uri: { name: 'local_uri', type: 'string' },
              remote_path: {
                name: 'remote_path',
                type: 'string',
                isOptional: true,
              },
              task_id: { name: 'task_id', type: 'string', isOptional: true },
              plant_id: { name: 'plant_id', type: 'string', isOptional: true },
              filename: { name: 'filename', type: 'string', isOptional: true },
              mime_type: {
                name: 'mime_type',
                type: 'string',
                isOptional: true,
              },
              status: { name: 'status', type: 'string', isIndexed: true },
              retry_count: {
                name: 'retry_count',
                type: 'number',
                isOptional: true,
              },
              last_error: {
                name: 'last_error',
                type: 'string',
                isOptional: true,
              },
              next_attempt_at: {
                name: 'next_attempt_at',
                type: 'number',
                isOptional: true,
                isIndexed: true,
              },
              created_at: { name: 'created_at', type: 'number' },
              updated_at: { name: 'updated_at', type: 'number' },
            },
            columnArray: [
              { name: 'local_uri', type: 'string' },
              { name: 'remote_path', type: 'string', isOptional: true },
              { name: 'task_id', type: 'string', isOptional: true },
              { name: 'plant_id', type: 'string', isOptional: true },
              { name: 'filename', type: 'string', isOptional: true },
              { name: 'mime_type', type: 'string', isOptional: true },
              { name: 'status', type: 'string', isIndexed: true },
              { name: 'retry_count', type: 'number', isOptional: true },
              { name: 'last_error', type: 'string', isOptional: true },
              {
                name: 'next_attempt_at',
                type: 'number',
                isOptional: true,
                isIndexed: true,
              },
              { name: 'created_at', type: 'number' },
              { name: 'updated_at', type: 'number' },
            ],
          },
        },
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
