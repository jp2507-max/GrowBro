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
    // Migration from version 12 to 13: Add harvest workflow tables
    {
      toVersion: 13,
      steps: [
        {
          type: 'create_table',
          schema: createTableSchema('harvests', [
            { name: 'plant_id', type: 'string', isIndexed: true },
            { name: 'user_id', type: 'string', isOptional: true },
            { name: 'stage', type: 'string', isIndexed: true },
            { name: 'wet_weight_g', type: 'number', isOptional: true },
            { name: 'dry_weight_g', type: 'number', isOptional: true },
            { name: 'trimmings_weight_g', type: 'number', isOptional: true },
            { name: 'notes', type: 'string' },
            { name: 'stage_started_at', type: 'number' },
            { name: 'stage_completed_at', type: 'number', isOptional: true },
            { name: 'photos', type: 'string' },
            { name: 'server_revision', type: 'number', isOptional: true },
            { name: 'server_updated_at_ms', type: 'number', isOptional: true },
            { name: 'conflict_seen', type: 'boolean' },
            { name: 'created_at', type: 'number' },
            { name: 'updated_at', type: 'number' },
            { name: 'deleted_at', type: 'number', isOptional: true },
          ]),
        },
        {
          type: 'create_table',
          schema: createTableSchema('inventory', [
            { name: 'plant_id', type: 'string', isIndexed: true },
            { name: 'harvest_id', type: 'string', isIndexed: true },
            { name: 'user_id', type: 'string', isOptional: true },
            { name: 'final_weight_g', type: 'number' },
            { name: 'harvest_date', type: 'string' },
            { name: 'total_duration_days', type: 'number' },
            { name: 'server_revision', type: 'number', isOptional: true },
            { name: 'server_updated_at_ms', type: 'number', isOptional: true },
            { name: 'created_at', type: 'number' },
            { name: 'updated_at', type: 'number' },
            { name: 'deleted_at', type: 'number', isOptional: true },
          ]),
        },
      ],
    },
    // Migration from version 13 to 14: Add harvest audit table
    {
      toVersion: 14,
      steps: [
        {
          type: 'create_table',
          schema: createTableSchema('harvest_audits', [
            { name: 'harvest_id', type: 'string', isIndexed: true },
            { name: 'user_id', type: 'string', isOptional: true },
            { name: 'action', type: 'string' },
            { name: 'status', type: 'string' },
            { name: 'from_stage', type: 'string', isOptional: true },
            { name: 'to_stage', type: 'string', isOptional: true },
            { name: 'reason', type: 'string' },
            { name: 'performed_at', type: 'number' },
            { name: 'metadata', type: 'string' }, // JSON
            { name: 'server_revision', type: 'number' },
            { name: 'server_updated_at_ms', type: 'number' },
            { name: 'created_at', type: 'number' },
            { name: 'updated_at', type: 'number' },
            { name: 'deleted_at', type: 'number', isOptional: true },
          ]),
        },
      ],
    },
    // Migration from version 14 to 15: Add harvest photo fields to image_upload_queue
    {
      toVersion: 15,
      steps: [
        addColumns({
          table: 'image_upload_queue',
          columns: [
            { name: 'harvest_id', type: 'string', isOptional: true },
            { name: 'variant', type: 'string', isOptional: true }, // original | resized | thumbnail
            { name: 'hash', type: 'string', isOptional: true },
            { name: 'extension', type: 'string', isOptional: true },
          ],
        }),
      ],
    },
    // Migration from version 15 to 16: Add notification tracking to harvests
    {
      toVersion: 16,
      steps: [
        addColumns({
          table: 'harvests',
          columns: [
            { name: 'notification_id', type: 'string', isOptional: true },
            {
              name: 'overdue_notification_id',
              type: 'string',
              isOptional: true,
            },
          ],
        }),
      ],
    },
    // Migration from version 16 to 17: Add nutrient engine tables
    {
      toVersion: 17,
      steps: [
        {
          type: 'create_table',
          schema: createTableSchema('feeding_templates', [
            { name: 'name', type: 'string' },
            { name: 'medium', type: 'string' },
            { name: 'phases_json', type: 'string' },
            { name: 'target_ranges_json', type: 'string' },
            { name: 'is_custom', type: 'boolean' },
            { name: 'user_id', type: 'string', isOptional: true },
            { name: 'server_revision', type: 'number', isOptional: true },
            { name: 'server_updated_at_ms', type: 'number', isOptional: true },
            { name: 'created_at', type: 'number' },
            { name: 'updated_at', type: 'number' },
            { name: 'deleted_at', type: 'number', isOptional: true },
          ]),
        },
        {
          type: 'create_table',
          schema: createTableSchema('ph_ec_readings', [
            { name: 'plant_id', type: 'string', isOptional: true, isIndexed: true },
            {
              name: 'reservoir_id',
              type: 'string',
              isOptional: true,
              isIndexed: true,
            },
            { name: 'measured_at', type: 'number', isIndexed: true },
            { name: 'ph', type: 'number' },
            { name: 'ec_raw', type: 'number' },
            { name: 'ec_25c', type: 'number' },
            { name: 'temp_c', type: 'number' },
            { name: 'atc_on', type: 'boolean' },
            { name: 'ppm_scale', type: 'string' },
            { name: 'meter_id', type: 'string', isOptional: true, isIndexed: true },
            { name: 'note', type: 'string', isOptional: true },
            { name: 'quality_flags_json', type: 'string', isOptional: true },
            { name: 'user_id', type: 'string', isOptional: true },
            { name: 'server_revision', type: 'number', isOptional: true },
            { name: 'server_updated_at_ms', type: 'number', isOptional: true },
            { name: 'created_at', type: 'number', isIndexed: true },
            { name: 'updated_at', type: 'number' },
            { name: 'deleted_at', type: 'number', isOptional: true },
          ]),
        },
        {
          type: 'create_table',
          schema: createTableSchema('reservoirs', [
            { name: 'name', type: 'string' },
            { name: 'volume_l', type: 'number' },
            { name: 'medium', type: 'string', isIndexed: true },
            { name: 'target_ph_min', type: 'number' },
            { name: 'target_ph_max', type: 'number' },
            { name: 'target_ec_min_25c', type: 'number' },
            { name: 'target_ec_max_25c', type: 'number' },
            { name: 'ppm_scale', type: 'string' },
            { name: 'source_water_profile_id', type: 'string', isOptional: true },
            { name: 'playbook_binding', type: 'string', isOptional: true },
            { name: 'user_id', type: 'string', isOptional: true },
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
            { name: 'baseline_ec_25c', type: 'number' },
            { name: 'alkalinity_mg_per_l_caco3', type: 'number' },
            { name: 'hardness_mg_per_l', type: 'number' },
            { name: 'last_tested_at', type: 'number' },
            { name: 'user_id', type: 'string', isOptional: true },
            { name: 'server_revision', type: 'number', isOptional: true },
            { name: 'server_updated_at_ms', type: 'number', isOptional: true },
            { name: 'created_at', type: 'number' },
            { name: 'updated_at', type: 'number' },
            { name: 'deleted_at', type: 'number', isOptional: true },
          ]),
        },
        {
          type: 'create_table',
          schema: createTableSchema('calibrations', [
            { name: 'meter_id', type: 'string', isIndexed: true },
            { name: 'type', type: 'string' },
            { name: 'points_json', type: 'string' },
            { name: 'slope', type: 'number' },
            { name: 'offset', type: 'number' },
            { name: 'temp_c', type: 'number' },
            { name: 'method', type: 'string', isOptional: true },
            { name: 'valid_days', type: 'number', isOptional: true },
            { name: 'performed_at', type: 'number' },
            { name: 'expires_at', type: 'number' },
            { name: 'is_valid', type: 'boolean' },
            { name: 'user_id', type: 'string', isOptional: true },
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
            { name: 'reading_id', type: 'string', isIndexed: true },
            { name: 'type', type: 'string' },
            { name: 'severity', type: 'string' },
            { name: 'message', type: 'string' },
            { name: 'recommendations_json', type: 'string' },
            { name: 'recommendation_codes_json', type: 'string', isOptional: true },
            { name: 'cooldown_until', type: 'number', isOptional: true },
            { name: 'triggered_at', type: 'number', isIndexed: true },
            { name: 'acknowledged_at', type: 'number', isOptional: true },
            { name: 'resolved_at', type: 'number', isOptional: true },
            { name: 'delivered_at_local', type: 'number', isOptional: true },
            { name: 'user_id', type: 'string', isOptional: true },
            { name: 'server_revision', type: 'number', isOptional: true },
            { name: 'server_updated_at_ms', type: 'number', isOptional: true },
            { name: 'created_at', type: 'number' },
            { name: 'updated_at', type: 'number' },
            { name: 'deleted_at', type: 'number', isOptional: true },
          ]),
        },
        {
          type: 'create_table',
          schema: createTableSchema('reservoir_events', [
            { name: 'reservoir_id', type: 'string', isIndexed: true },
            { name: 'kind', type: 'string' },
            { name: 'delta_ec_25c', type: 'number', isOptional: true },
            { name: 'delta_ph', type: 'number', isOptional: true },
            { name: 'note', type: 'string', isOptional: true },
            { name: 'user_id', type: 'string', isOptional: true },
            { name: 'server_revision', type: 'number', isOptional: true },
            { name: 'server_updated_at_ms', type: 'number', isOptional: true },
            { name: 'created_at', type: 'number', isIndexed: true },
            { name: 'updated_at', type: 'number' },
            { name: 'deleted_at', type: 'number', isOptional: true },
          ]),
        },
      ],
    },
  ],
});
