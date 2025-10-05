import {
  addColumns,
  schemaMigrations,
} from '@nozbe/watermelondb/Schema/migrations';

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
    // Migration from version 1 to 2: Add soft delete support
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
    // Migration from version 2 to 3: Add image upload queue
    {
      toVersion: 3,
      steps: [
        {
          type: 'create_table',
          schema: createTableSchema('image_upload_queue', [
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
          ]),
        },
      ],
    },
    // Migration from version 3 to 4: No changes
    {
      toVersion: 4,
      steps: [],
    },
    // Migration from version 4 to 5: Add Nutrient Engine tables
    {
      toVersion: 5,
      steps: [
        {
          type: 'create_table',
          schema: createTableSchema('ph_ec_readings', [
            { name: 'reservoir_id', type: 'string', isIndexed: true },
            { name: 'ph_value', type: 'number' },
            { name: 'ec_value', type: 'number' },
            { name: 'temperature_celsius', type: 'number', isOptional: true },
            { name: 'meter_id', type: 'string', isOptional: true },
            { name: 'notes', type: 'string', isOptional: true },
            { name: 'server_revision', type: 'number', isOptional: true },
            { name: 'server_updated_at_ms', type: 'number', isOptional: true },
            { name: 'created_at', type: 'number' },
            { name: 'updated_at', type: 'number' },
            { name: 'deleted_at', type: 'number', isOptional: true },
          ]),
        },
        {
          type: 'create_table',
          schema: createTableSchema('deviation_alerts', [
            { name: 'reservoir_id', type: 'string', isIndexed: true },
            { name: 'alert_type', type: 'string' },
            { name: 'severity', type: 'string' },
            { name: 'message', type: 'string' },
            { name: 'resolved_at', type: 'number', isOptional: true },
            { name: 'server_revision', type: 'number', isOptional: true },
            { name: 'server_updated_at_ms', type: 'number', isOptional: true },
            { name: 'created_at', type: 'number' },
            { name: 'updated_at', type: 'number' },
            { name: 'deleted_at', type: 'number', isOptional: true },
          ]),
        },
        {
          type: 'create_table',
          schema: createTableSchema('reservoirs', [
            { name: 'name', type: 'string' },
            { name: 'volume_liters', type: 'number' },
            { name: 'current_ph', type: 'number', isOptional: true },
            { name: 'current_ec', type: 'number', isOptional: true },
            { name: 'target_ph_min', type: 'number', isOptional: true },
            { name: 'target_ph_max', type: 'number', isOptional: true },
            { name: 'target_ec_min', type: 'number', isOptional: true },
            { name: 'target_ec_max', type: 'number', isOptional: true },
            {
              name: 'source_water_profile_id',
              type: 'string',
              isOptional: true,
            },
            { name: 'server_revision', type: 'number', isOptional: true },
            { name: 'server_updated_at_ms', type: 'number', isOptional: true },
            { name: 'created_at', type: 'number' },
            { name: 'updated_at', type: 'number' },
            { name: 'deleted_at', type: 'number', isOptional: true },
          ]),
        },
        {
          type: 'create_table',
          schema: createTableSchema('source_water_profiles', [
            { name: 'name', type: 'string' },
            { name: 'ph_value', type: 'number' },
            { name: 'ec_value', type: 'number' },
            { name: 'last_tested_at', type: 'string' },
            { name: 'notes', type: 'string', isOptional: true },
            { name: 'server_revision', type: 'number', isOptional: true },
            { name: 'server_updated_at_ms', type: 'number', isOptional: true },
            { name: 'created_at', type: 'number' },
            { name: 'updated_at', type: 'number' },
            { name: 'deleted_at', type: 'number', isOptional: true },
          ]),
        },
        {
          type: 'create_table',
          schema: createTableSchema('meters', [
            { name: 'name', type: 'string' },
            { name: 'type', type: 'string' },
            { name: 'model', type: 'string', isOptional: true },
            { name: 'calibration_due_at', type: 'number', isOptional: true },
            { name: 'last_calibration_at', type: 'number', isOptional: true },
            { name: 'server_revision', type: 'number', isOptional: true },
            { name: 'server_updated_at_ms', type: 'number', isOptional: true },
            { name: 'created_at', type: 'number' },
            { name: 'updated_at', type: 'number' },
            { name: 'deleted_at', type: 'number', isOptional: true },
          ]),
        },
        {
          type: 'create_table',
          schema: createTableSchema('meter_calibrations', [
            { name: 'meter_id', type: 'string', isIndexed: true },
            { name: 'calibration_type', type: 'string' },
            { name: 'expected_value', type: 'number' },
            { name: 'measured_value', type: 'number' },
            { name: 'calibration_offset', type: 'number' },
            { name: 'notes', type: 'string', isOptional: true },
            { name: 'server_revision', type: 'number', isOptional: true },
            { name: 'server_updated_at_ms', type: 'number', isOptional: true },
            { name: 'created_at', type: 'number' },
            { name: 'updated_at', type: 'number' },
            { name: 'deleted_at', type: 'number', isOptional: true },
          ]),
        },
        {
          type: 'create_table',
          schema: createTableSchema('feeding_schedules', [
            { name: 'reservoir_id', type: 'string', isIndexed: true },
            { name: 'name', type: 'string' },
            { name: 'description', type: 'string', isOptional: true },
            { name: 'feed_type', type: 'string' },
            { name: 'amount_ml', type: 'number' },
            { name: 'frequency_hours', type: 'number' },
            { name: 'is_active', type: 'boolean' },
            { name: 'last_executed_at', type: 'number', isOptional: true },
            { name: 'next_scheduled_at', type: 'number', isOptional: true },
            { name: 'server_revision', type: 'number', isOptional: true },
            { name: 'server_updated_at_ms', type: 'number', isOptional: true },
            { name: 'created_at', type: 'number' },
            { name: 'updated_at', type: 'number' },
            { name: 'deleted_at', type: 'number', isOptional: true },
          ]),
        },
        {
          type: 'create_table',
          schema: createTableSchema('feeding_events', [
            { name: 'feeding_schedule_id', type: 'string', isIndexed: true },
            { name: 'executed_at', type: 'number' },
            { name: 'actual_amount_ml', type: 'number' },
            { name: 'notes', type: 'string', isOptional: true },
            { name: 'server_revision', type: 'number', isOptional: true },
            { name: 'server_updated_at_ms', type: 'number', isOptional: true },
            { name: 'created_at', type: 'number' },
            { name: 'updated_at', type: 'number' },
            { name: 'deleted_at', type: 'number', isOptional: true },
          ]),
        },
        {
          type: 'create_table',
          schema: createTableSchema('correction_playbooks', [
            { name: 'name', type: 'string' },
            { name: 'description', type: 'string', isOptional: true },
            { name: 'trigger_condition', type: 'string' },
            { name: 'correction_steps', type: 'string' },
            {
              name: 'estimated_duration_hours',
              type: 'number',
              isOptional: true,
            },
            { name: 'is_active', type: 'boolean' },
            { name: 'server_revision', type: 'number', isOptional: true },
            { name: 'server_updated_at_ms', type: 'number', isOptional: true },
            { name: 'created_at', type: 'number' },
            { name: 'updated_at', type: 'number' },
            { name: 'deleted_at', type: 'number', isOptional: true },
          ]),
        },
      ],
    },
    // Migration from version 5 to 6: Add server sync columns
    {
      toVersion: 6,
      steps: [
        addColumns({
          table: 'series',
          columns: [
            { name: 'server_revision', type: 'number', isOptional: true },
            { name: 'server_updated_at_ms', type: 'number', isOptional: true },
          ],
        }),
        addColumns({
          table: 'tasks',
          columns: [
            { name: 'server_revision', type: 'number', isOptional: true },
            { name: 'server_updated_at_ms', type: 'number', isOptional: true },
          ],
        }),
        addColumns({
          table: 'occurrence_overrides',
          columns: [
            { name: 'server_revision', type: 'number', isOptional: true },
            { name: 'server_updated_at_ms', type: 'number', isOptional: true },
          ],
        }),
      ],
    },
    // Migration from version 6 to 7: No changes
    {
      toVersion: 7,
      steps: [],
    },
    // Migration from version 7 to 8: No changes
    {
      toVersion: 8,
      steps: [],
    },
    // Migration from version 8 to 9: No changes
    {
      toVersion: 9,
      steps: [],
    },
    // Migration from version 9 to 10: No changes
    {
      toVersion: 10,
      steps: [],
    },
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
    // Migration from version 11 to 12: Add user_id columns for RLS support
    {
      toVersion: 12,
      steps: [
        addColumns({
          table: 'series',
          columns: [{ name: 'user_id', type: 'string', isOptional: true }],
        }),
        addColumns({
          table: 'tasks',
          columns: [{ name: 'user_id', type: 'string', isOptional: true }],
        }),
        addColumns({
          table: 'occurrence_overrides',
          columns: [{ name: 'user_id', type: 'string', isOptional: true }],
        }),
        addColumns({
          table: 'ph_ec_readings',
          columns: [{ name: 'user_id', type: 'string', isOptional: true }],
        }),
      ],
    },
  ],
});
