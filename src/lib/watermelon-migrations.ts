import { schemaMigrations } from '@nozbe/watermelondb/Schema/migrations';

const createTableSchema = (name: string, columnArray: any[]) => {
  const columns = columnArray.reduce(
    (acc, col) => {
      acc[col.name] = col;
      return acc;
    },
    {} as Record<string, any>
  );
  return { name, columns, columnArray };
};

export const migrations = schemaMigrations({
  migrations: [
    // Migration from version 10 to 11: Add AI adjustment tables
    {
      toVersion: 11,
      steps: [
        {
          type: 'create_table',
          schema: createTableSchema('adjustment_suggestions', [
            { name: 'plant_id', type: 'string', isIndexed: true },
            { name: 'playbook_id', type: 'string', isOptional: true },
            { name: 'suggestion_type', type: 'string' },
            { name: 'root_cause', type: 'string' },
            { name: 'reasoning', type: 'string' },
            { name: 'affected_tasks', type: 'string' },
            { name: 'confidence', type: 'number' },
            { name: 'status', type: 'string' },
            { name: 'accepted_tasks', type: 'string', isOptional: true },
            { name: 'helpfulness_vote', type: 'string', isOptional: true },
            { name: 'expires_at', type: 'number', isIndexed: true },
            { name: 'created_at', type: 'number' },
            { name: 'updated_at', type: 'number' },
          ]),
        },
        {
          type: 'create_table',
          schema: createTableSchema('adjustment_cooldowns', [
            { name: 'plant_id', type: 'string', isIndexed: true },
            { name: 'root_cause', type: 'string', isIndexed: true },
            { name: 'cooldown_until', type: 'number', isIndexed: true },
            { name: 'created_at', type: 'number' },
          ]),
        },
        {
          type: 'create_table',
          schema: createTableSchema('plant_adjustment_preferences', [
            { name: 'plant_id', type: 'string', isIndexed: true },
            { name: 'never_suggest', type: 'boolean' },
            { name: 'created_at', type: 'number' },
            { name: 'updated_at', type: 'number' },
          ]),
        },
      ],
    },
  ],
});
