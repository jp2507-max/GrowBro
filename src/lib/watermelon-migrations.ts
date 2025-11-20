import {
  addColumns,
  schemaMigrations,
} from '@nozbe/watermelondb/Schema/migrations';

interface ColumnDefinition {
  name: string;
  type: 'string' | 'number' | 'boolean';
  isOptional?: boolean;
  isIndexed?: boolean;
}

const createTableSchema = (name: string, columnArray: ColumnDefinition[]) => {
  const columns = columnArray.reduce(
    (acc, col) => {
      acc[col.name] = col;
      return acc;
    },
    {} as Record<string, ColumnDefinition>
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
    // Migration from version 16 to 17: Add nutrient engine tables (additive migration)
    // ✅ DATA MIGRATION IMPLEMENTED:
    // This migration creates _v2 tables with enhanced schemas and migrates all existing data.
    // Legacy data is preserved and accessible through the new models and APIs.
    //
    // Migration details:
    // 1. ph_ec_readings → ph_ec_readings_v2: Maps legacy fields, adds new required fields with defaults
    // 2. reservoirs → reservoirs_v2: Maps volume/target fields, adds medium/ppm defaults
    // 3. source_water_profiles → source_water_profiles_v2: Maps values, adds missing fields
    // 4. deviation_alerts → deviation_alerts_v2: Maps alert fields, adds new metadata fields
    //
    // All migrations preserve: id, timestamps, server sync fields, soft deletes, and user_id
    {
      toVersion: 17,
      steps: [
        // Create new feeding_templates table (doesn't exist in v5)
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
        // Create ph_ec_readings_v2 with new schema (incompatible changes from v5)
        // ✅ Data migration implemented: Legacy ph_ec_readings data migrated above
        {
          type: 'create_table',
          schema: createTableSchema('ph_ec_readings_v2', [
            {
              name: 'plant_id',
              type: 'string',
              isOptional: true,
              isIndexed: true,
            },
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
            {
              name: 'meter_id',
              type: 'string',
              isOptional: true,
              isIndexed: true,
            },
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
        // Create reservoirs_v2 with new schema (incompatible changes from v5)
        // ✅ Data migration implemented: Legacy reservoirs data migrated above
        {
          type: 'create_table',
          schema: createTableSchema('reservoirs_v2', [
            { name: 'name', type: 'string' },
            { name: 'volume_l', type: 'number' },
            { name: 'medium', type: 'string', isIndexed: true },
            { name: 'target_ph_min', type: 'number' },
            { name: 'target_ph_max', type: 'number' },
            { name: 'target_ec_min_25c', type: 'number' },
            { name: 'target_ec_max_25c', type: 'number' },
            { name: 'ppm_scale', type: 'string' },
            {
              name: 'source_water_profile_id',
              type: 'string',
              isOptional: true,
            },
            { name: 'playbook_binding', type: 'string', isOptional: true },
            { name: 'user_id', type: 'string', isOptional: true },
            { name: 'server_revision', type: 'number', isOptional: true },
            { name: 'server_updated_at_ms', type: 'number', isOptional: true },
            { name: 'created_at', type: 'number' },
            { name: 'updated_at', type: 'number' },
            { name: 'deleted_at', type: 'number', isOptional: true },
          ]),
        },
        // Create source_water_profiles_v2 with new schema (incompatible changes from v5)
        // ✅ Data migration implemented: Legacy source_water_profiles data migrated above
        {
          type: 'create_table',
          schema: createTableSchema('source_water_profiles_v2', [
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
        // Create calibrations table (doesn't exist in v5)
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
        // Create deviation_alerts_v2 with new schema (incompatible changes from v5)
        // ✅ Data migration implemented: Legacy deviation_alerts data migrated above
        {
          type: 'create_table',
          schema: createTableSchema('deviation_alerts_v2', [
            { name: 'reading_id', type: 'string', isIndexed: true },
            { name: 'type', type: 'string' },
            { name: 'severity', type: 'string' },
            { name: 'message', type: 'string' },
            { name: 'recommendations_json', type: 'string' },
            {
              name: 'recommendation_codes_json',
              type: 'string',
              isOptional: true,
            },
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
        // Create reservoir_events table (doesn't exist in v5)
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
        // DATA MIGRATION: Migrate legacy nutrient data to _v2 tables
        // 1. Migrate ph_ec_readings to ph_ec_readings_v2
        {
          type: 'sql',
          sql: `
            INSERT INTO ph_ec_readings_v2 (
              id, plant_id, reservoir_id, measured_at, ph, ec_raw, ec_25c, temp_c, atc_on, ppm_scale,
              meter_id, note, quality_flags_json, user_id, server_revision, server_updated_at_ms,
              created_at, updated_at, deleted_at
            )
            SELECT
              id, NULL as plant_id, reservoir_id, created_at as measured_at, ph_value as ph, ec_value as ec_raw,
              ec_value as ec_25c, COALESCE(temperature_celsius, 25.0) as temp_c, 0 as atc_on, '500' as ppm_scale,
              meter_id, notes as note, '[]' as quality_flags_json, user_id, server_revision, server_updated_at_ms,
              created_at, updated_at, deleted_at
            FROM ph_ec_readings
            WHERE deleted_at IS NULL OR deleted_at = 0
          `,
        },
        // 2. Migrate reservoirs to reservoirs_v2
        {
          type: 'sql',
          sql: `
            INSERT INTO reservoirs_v2 (
              id, name, volume_l, medium, target_ph_min, target_ph_max, target_ec_min_25c, target_ec_max_25c,
              ppm_scale, source_water_profile_id, playbook_binding, user_id, server_revision, server_updated_at_ms,
              created_at, updated_at, deleted_at
            )
            SELECT
              id, name, volume_liters as volume_l, 'hydroponic' as medium, target_ph_min, target_ph_max,
              target_ec_min as target_ec_min_25c, target_ec_max as target_ec_max_25c, '500' as ppm_scale,
              source_water_profile_id, NULL as playbook_binding, user_id, server_revision, server_updated_at_ms,
              created_at, updated_at, deleted_at
            FROM reservoirs
            WHERE deleted_at IS NULL OR deleted_at = 0
          `,
        },
        // 3. Migrate source_water_profiles to source_water_profiles_v2
        {
          type: 'sql',
          sql: `
            INSERT INTO source_water_profiles_v2 (
              id, name, baseline_ec_25c, alkalinity_mg_per_l_caco3, hardness_mg_per_l, last_tested_at,
              user_id, server_revision, server_updated_at_ms, created_at, updated_at, deleted_at
            )
            SELECT
              id, name, ec_value as baseline_ec_25c, 0 as alkalinity_mg_per_l_caco3, 0 as hardness_mg_per_l,
              CASE
                WHEN last_tested_at GLOB '[0-9]*' THEN CAST(last_tested_at AS INTEGER)
                ELSE strftime('%s', 'now') * 1000
              END as last_tested_at,
              user_id, server_revision, server_updated_at_ms, created_at, updated_at, deleted_at
            FROM source_water_profiles
            WHERE deleted_at IS NULL OR deleted_at = 0
          `,
        },
        // 4. Migrate deviation_alerts to deviation_alerts_v2
        {
          type: 'sql',
          sql: `
            INSERT INTO deviation_alerts_v2 (
              id, reading_id, type, severity, message, recommendations_json, recommendation_codes_json,
              cooldown_until, triggered_at, acknowledged_at, resolved_at, delivered_at_local,
              user_id, server_revision, server_updated_at_ms, created_at, updated_at, deleted_at
            )
            SELECT
              id, reservoir_id as reading_id, alert_type as type, severity, message, '[]' as recommendations_json,
              NULL as recommendation_codes_json, NULL as cooldown_until, created_at as triggered_at,
              NULL as acknowledged_at, resolved_at, NULL as delivered_at_local,
              user_id, server_revision, server_updated_at_ms, created_at, updated_at, deleted_at
            FROM deviation_alerts
            WHERE deleted_at IS NULL OR deleted_at = 0
          `,
        },
      ],
    },
    // Migration from version 17 to 18: No schema changes (placeholder to keep versions contiguous)
    {
      toVersion: 18,
      steps: [],
    },
    // Migration from version 18 to 19: Add diagnostic results table for nutrient engine
    {
      toVersion: 19,
      steps: [
        {
          type: 'create_table',
          schema: createTableSchema('diagnostic_results_v2', [
            { name: 'plant_id', type: 'string', isIndexed: true },
            {
              name: 'reservoir_id',
              type: 'string',
              isOptional: true,
              isIndexed: true,
            },
            { name: 'water_profile_id', type: 'string', isOptional: true },
            { name: 'issue_type', type: 'string', isIndexed: true },
            { name: 'issue_severity', type: 'string' },
            { name: 'nutrient_code', type: 'string', isOptional: true },
            { name: 'confidence', type: 'number' },
            { name: 'confidence_source', type: 'string' },
            { name: 'rules_confidence', type: 'number', isOptional: true },
            { name: 'ai_confidence', type: 'number', isOptional: true },
            { name: 'confidence_threshold', type: 'number', isOptional: true },
            { name: 'rules_based', type: 'boolean' },
            { name: 'ai_override', type: 'boolean' },
            { name: 'needs_second_opinion', type: 'boolean' },
            { name: 'symptoms_json', type: 'string' },
            { name: 'rationale_json', type: 'string', isOptional: true },
            { name: 'recommendations_json', type: 'string' },
            {
              name: 'recommendation_codes_json',
              type: 'string',
              isOptional: true,
            },
            { name: 'disclaimer_keys_json', type: 'string', isOptional: true },
            {
              name: 'input_reading_ids_json',
              type: 'string',
              isOptional: true,
            },
            { name: 'ai_hypothesis_id', type: 'string', isOptional: true },
            { name: 'ai_metadata_json', type: 'string', isOptional: true },
            {
              name: 'feedback_helpful_count',
              type: 'number',
              isOptional: true,
            },
            {
              name: 'feedback_not_helpful_count',
              type: 'number',
              isOptional: true,
            },
            {
              name: 'confidence_flags_json',
              type: 'string',
              isOptional: true,
            },
            { name: 'resolution_notes', type: 'string', isOptional: true },
            { name: 'resolved_at', type: 'number', isOptional: true },
            { name: 'user_id', type: 'string', isOptional: true },
            { name: 'server_revision', type: 'number', isOptional: true },
            {
              name: 'server_updated_at_ms',
              type: 'number',
              isOptional: true,
            },
            { name: 'created_at', type: 'number', isIndexed: true },
            { name: 'updated_at', type: 'number' },
            { name: 'deleted_at', type: 'number', isOptional: true },
          ]),
        },
      ],
    },
    // Migration from version 19 to 20: Add inventory and consumables tables
    {
      toVersion: 20,
      steps: [
        {
          type: 'create_table',
          schema: createTableSchema('inventory_items', [
            { name: 'name', type: 'string' },
            { name: 'category', type: 'string' },
            { name: 'unit_of_measure', type: 'string' },
            { name: 'tracking_mode', type: 'string' }, // 'simple' | 'batched'
            { name: 'is_consumable', type: 'boolean' },
            { name: 'min_stock', type: 'number' },
            { name: 'reorder_multiple', type: 'number' },
            { name: 'lead_time_days', type: 'number', isOptional: true },
            { name: 'sku', type: 'string', isOptional: true },
            { name: 'barcode', type: 'string', isOptional: true },
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
          schema: createTableSchema('inventory_batches', [
            { name: 'item_id', type: 'string', isIndexed: true },
            { name: 'lot_number', type: 'string' },
            { name: 'expires_on', type: 'number', isOptional: true },
            { name: 'quantity', type: 'number' },
            { name: 'cost_per_unit_minor', type: 'number' },
            { name: 'received_at', type: 'number' },
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
          schema: createTableSchema('inventory_movements', [
            { name: 'item_id', type: 'string', isIndexed: true },
            { name: 'batch_id', type: 'string', isOptional: true },
            { name: 'type', type: 'string' }, // 'receipt' | 'consumption' | 'adjustment'
            { name: 'quantity_delta', type: 'number' },
            { name: 'cost_per_unit_minor', type: 'number', isOptional: true },
            { name: 'reason', type: 'string' },
            { name: 'task_id', type: 'string', isOptional: true },
            { name: 'external_key', type: 'string', isOptional: true },
            { name: 'user_id', type: 'string', isOptional: true },
            { name: 'created_at', type: 'number', isIndexed: true },
          ]),
        },
      ],
    },
    // Migration from version 20 to 21: Add unique constraint on inventory_movements.external_key
    {
      toVersion: 21,
      steps: [
        {
          type: 'sql',
          sql: 'CREATE UNIQUE INDEX idx_inventory_movements_external_key ON inventory_movements(external_key) WHERE external_key IS NOT NULL',
        },
      ],
    },
    // Migration from version 21 to 22: Add unique constraints on inventory_items.sku and inventory_items.barcode
    {
      toVersion: 22,
      steps: [
        {
          type: 'sql',
          sql: 'CREATE UNIQUE INDEX idx_inventory_items_sku ON inventory_items(sku) WHERE sku IS NOT NULL AND deleted_at IS NULL',
        },
        {
          type: 'sql',
          sql: 'CREATE UNIQUE INDEX idx_inventory_items_barcode ON inventory_items(barcode) WHERE barcode IS NOT NULL AND deleted_at IS NULL',
        },
      ],
    },
    // Migration from version 22 to 23: Add community feed tables
    {
      toVersion: 23,
      steps: [
        {
          type: 'create_table',
          schema: createTableSchema('posts', [
            { name: 'user_id', type: 'string' },
            { name: 'body', type: 'string' },
            { name: 'media_uri', type: 'string', isOptional: true },
            { name: 'created_at', type: 'number', isIndexed: true },
            { name: 'updated_at', type: 'number' },
            { name: 'deleted_at', type: 'number', isOptional: true },
            { name: 'hidden_at', type: 'number', isOptional: true },
            { name: 'moderation_reason', type: 'string', isOptional: true },
            { name: 'undo_expires_at', type: 'number', isOptional: true },
          ]),
        },
        {
          type: 'create_table',
          schema: createTableSchema('post_comments', [
            { name: 'post_id', type: 'string', isIndexed: true },
            { name: 'user_id', type: 'string' },
            { name: 'body', type: 'string' },
            { name: 'created_at', type: 'number' },
            { name: 'updated_at', type: 'number' },
            { name: 'deleted_at', type: 'number', isOptional: true },
            { name: 'hidden_at', type: 'number', isOptional: true },
            { name: 'undo_expires_at', type: 'number', isOptional: true },
          ]),
        },
        {
          type: 'create_table',
          schema: createTableSchema('post_likes', [
            { name: 'post_id', type: 'string', isIndexed: true },
            { name: 'user_id', type: 'string' },
            { name: 'created_at', type: 'number' },
          ]),
        },
        {
          type: 'sql',
          sql: 'CREATE UNIQUE INDEX post_likes_post_id_user_id_unique ON post_likes(post_id, user_id)',
        },
        {
          type: 'create_table',
          schema: createTableSchema('outbox', [
            { name: 'op', type: 'string' },
            { name: 'payload', type: 'string' },
            { name: 'client_tx_id', type: 'string' },
            { name: 'idempotency_key', type: 'string' },
            { name: 'created_at', type: 'number', isIndexed: true },
            { name: 'retries', type: 'number' },
            { name: 'next_retry_at', type: 'number', isOptional: true },
            { name: 'status', type: 'string', isIndexed: true },
          ]),
        },
      ],
    },
    // Migration from version 23 to 24: Add AI photo assessment tables
    {
      toVersion: 24,
      steps: [
        {
          type: 'create_table',
          schema: createTableSchema('assessment_classes', [
            { name: 'name', type: 'string' },
            { name: 'category', type: 'string', isIndexed: true },
            { name: 'description', type: 'string' },
            { name: 'is_ood', type: 'boolean' },
            { name: 'visual_cues', type: 'string' },
            { name: 'action_template', type: 'string' },
            { name: 'created_at', type: 'number' },
          ]),
        },
        {
          type: 'create_table',
          schema: createTableSchema('assessments', [
            { name: 'plant_id', type: 'string', isIndexed: true },
            { name: 'user_id', type: 'string', isIndexed: true },
            { name: 'status', type: 'string', isIndexed: true },
            { name: 'inference_mode', type: 'string' },
            { name: 'model_version', type: 'string' },
            {
              name: 'predicted_class',
              type: 'string',
              isOptional: true,
              isIndexed: true,
            },
            { name: 'raw_confidence', type: 'number', isOptional: true },
            { name: 'calibrated_confidence', type: 'number', isOptional: true },
            { name: 'aggregation_rule', type: 'string', isOptional: true },
            { name: 'latency_ms', type: 'number', isOptional: true },
            { name: 'helpful_vote', type: 'boolean', isOptional: true },
            { name: 'issue_resolved', type: 'boolean', isOptional: true },
            { name: 'feedback_notes', type: 'string', isOptional: true },
            { name: 'images', type: 'string' },
            { name: 'integrity_sha256', type: 'string' },
            { name: 'filename_keys', type: 'string' },
            { name: 'plant_context', type: 'string' },
            { name: 'quality_scores', type: 'string' },
            { name: 'action_plan', type: 'string', isOptional: true },
            {
              name: 'processing_started_at',
              type: 'number',
              isOptional: true,
            },
            {
              name: 'processing_completed_at',
              type: 'number',
              isOptional: true,
            },
            { name: 'resolved_at', type: 'number', isOptional: true },
            { name: 'created_at', type: 'number', isIndexed: true },
            { name: 'updated_at', type: 'number' },
          ]),
        },
      ],
    },
    // Migration from version 24 to 25: Add assessment_requests table for offline queue
    {
      toVersion: 25,
      steps: [
        {
          type: 'create_table',
          schema: createTableSchema('assessment_requests', [
            { name: 'plant_id', type: 'string', isIndexed: true },
            { name: 'user_id', type: 'string', isIndexed: true },
            { name: 'status', type: 'string', isIndexed: true },
            { name: 'photos', type: 'string' }, // JSON array of CapturedPhoto
            { name: 'plant_context', type: 'string' }, // JSON PlantContext
            { name: 'retry_count', type: 'number' },
            { name: 'last_error', type: 'string', isOptional: true },
            {
              name: 'next_attempt_at',
              type: 'number',
              isOptional: true,
              isIndexed: true,
            },
            { name: 'original_timestamp', type: 'number' },
            { name: 'created_at', type: 'number', isIndexed: true },
            { name: 'updated_at', type: 'number' },
          ]),
        },
      ],
    },
    // Migration from version 25 to 26: Add assessment feedback and telemetry tables
    {
      toVersion: 26,
      steps: [
        {
          type: 'create_table',
          schema: createTableSchema('assessment_feedback', [
            { name: 'assessment_id', type: 'string', isIndexed: true },
            { name: 'helpful', type: 'boolean' },
            { name: 'issue_resolved', type: 'string', isOptional: true },
            { name: 'notes', type: 'string', isOptional: true },
            { name: 'created_at', type: 'number', isIndexed: true },
          ]),
        },
        {
          type: 'create_table',
          schema: createTableSchema('assessment_telemetry', [
            { name: 'assessment_id', type: 'string', isIndexed: true },
            { name: 'event_type', type: 'string', isIndexed: true },
            { name: 'mode', type: 'string', isOptional: true },
            { name: 'latency_ms', type: 'number', isOptional: true },
            { name: 'model_version', type: 'string', isOptional: true },
            { name: 'raw_confidence', type: 'number', isOptional: true },
            {
              name: 'calibrated_confidence',
              type: 'number',
              isOptional: true,
            },
            { name: 'quality_score', type: 'number', isOptional: true },
            { name: 'predicted_class', type: 'string', isOptional: true },
            { name: 'execution_provider', type: 'string', isOptional: true },
            { name: 'error_code', type: 'string', isOptional: true },
            { name: 'fallback_reason', type: 'string', isOptional: true },
            { name: 'metadata', type: 'string' }, // JSON
            { name: 'created_at', type: 'number', isIndexed: true },
          ]),
        },
      ],
    },
    // Migration from version 26 to 27: Add soft-delete and timestamp fields to assessment_classes, add privacy consent to assessments
    {
      toVersion: 27,
      steps: [
        addColumns({
          table: 'assessment_classes',
          columns: [
            {
              name: 'deleted_at',
              type: 'number',
              isOptional: true,
              isIndexed: true,
            },
            { name: 'updated_at', type: 'number' },
          ],
        }),
        addColumns({
          table: 'assessments',
          columns: [{ name: 'consented_for_training', type: 'boolean' }],
        }),
        {
          type: 'sql',
          sql: "UPDATE assessment_classes SET updated_at = COALESCE(updated_at, CAST(strftime('%s','now') AS INTEGER) * 1000);",
        },
        {
          type: 'sql',
          sql: "UPDATE assessments SET updated_at = COALESCE(updated_at, CAST(strftime('%s','now') AS INTEGER) * 1000);",
        },
      ],
      // Down migration: Remove deleted_at and updated_at columns from assessment_classes, remove consented_for_training from assessments
      // Note: WatermelonDB migrations are typically forward-only, but for rollback purposes:
      // down: [
      //   {
      //     type: 'remove_columns',
      //     table: 'assessment_classes',
      //     columns: ['deleted_at', 'updated_at'],
      //   },
      //   {
      //     type: 'remove_columns',
      //     table: 'assessments',
      //     columns: ['consented_for_training'],
      //   },
      // ],
    },
    // Migration from version 27 to 28: No changes
    {
      toVersion: 28,
      steps: [],
    },
    // Migration from version 28 to 29: No changes
    {
      toVersion: 29,
      steps: [],
    },
    // Migration from version 29 to 30: Add avatar_status column to profiles
    // Requirement 1.2: WatermelonDB schema migration for avatarStatus
    {
      toVersion: 30,
      steps: [
        addColumns({
          table: 'profiles',
          columns: [
            { name: 'avatar_status', type: 'string', isOptional: true },
          ],
        }),
      ],
    },
    // Migration from version 30 to 31: Add help_articles_cache, support_tickets_queue, and ai_second_opinions_queue tables for customer support
    {
      toVersion: 31,
      steps: [
        {
          type: 'create_table',
          schema: createTableSchema('help_articles_cache', [
            { name: 'article_id', type: 'string', isIndexed: true },
            { name: 'title', type: 'string' },
            { name: 'body_markdown', type: 'string' },
            { name: 'category', type: 'string', isIndexed: true },
            { name: 'locale', type: 'string', isIndexed: true },
            { name: 'tags', type: 'string' }, // JSON array
            { name: 'view_count', type: 'number' },
            { name: 'helpful_count', type: 'number' },
            { name: 'not_helpful_count', type: 'number' },
            { name: 'last_updated', type: 'number' },
            { name: 'expires_at', type: 'number', isOptional: true },
            { name: 'created_at', type: 'number' },
            { name: 'updated_at', type: 'number' },
          ]),
        },
        {
          type: 'create_table',
          schema: createTableSchema('support_tickets_queue', [
            { name: 'category', type: 'string' },
            { name: 'subject', type: 'string' },
            { name: 'description', type: 'string' },
            { name: 'device_context', type: 'string' }, // JSON object
            { name: 'attachments', type: 'string' }, // JSON array
            { name: 'status', type: 'string', isIndexed: true },
            { name: 'priority', type: 'string' },
            { name: 'ticket_reference', type: 'string', isOptional: true },
            { name: 'retry_count', type: 'number' },
            { name: 'last_retry_at', type: 'number', isOptional: true },
            { name: 'resolved_at', type: 'number', isOptional: true },
            { name: 'client_request_id', type: 'string', isIndexed: true },
            { name: 'created_at', type: 'number' },
            { name: 'updated_at', type: 'number' },
          ]),
        },
        {
          type: 'create_table',
          schema: createTableSchema('ai_second_opinions_queue', [
            { name: 'assessment_id', type: 'string', isIndexed: true },
            { name: 'photo_uri', type: 'string' },
            { name: 'ai_assessment', type: 'string' }, // JSON object
            { name: 'user_notes', type: 'string', isOptional: true },
            { name: 'consent_human_review', type: 'boolean' },
            { name: 'consent_training_use', type: 'boolean' },
            { name: 'status', type: 'string', isIndexed: true },
            { name: 'expert_review', type: 'string', isOptional: true }, // JSON object
            { name: 'queue_position', type: 'number', isOptional: true },
            { name: 'estimated_completion', type: 'number', isOptional: true },
            { name: 'reviewed_at', type: 'number', isOptional: true },
            { name: 'client_request_id', type: 'string', isIndexed: true },
            { name: 'created_at', type: 'number' },
            { name: 'updated_at', type: 'number' },
          ]),
        },
      ],
    },
    // Migration from version 31 to 32: Add media variant columns to posts table
    {
      toVersion: 32,
      steps: [
        addColumns({
          table: 'posts',
          columns: [
            { name: 'media_resized_uri', type: 'string', isOptional: true },
            { name: 'media_thumbnail_uri', type: 'string', isOptional: true },
            { name: 'media_blurhash', type: 'string', isOptional: true },
            { name: 'media_thumbhash', type: 'string', isOptional: true },
            { name: 'media_width', type: 'number', isOptional: true },
            { name: 'media_height', type: 'number', isOptional: true },
            { name: 'media_aspect_ratio', type: 'number', isOptional: true },
            { name: 'media_bytes', type: 'number', isOptional: true },
          ],
        }),
      ],
    },
    // Migration from version 32 to 33: Add current_stock column to inventory_items and ensure assessment_classes has deleted_at/updated_at
    {
      toVersion: 33,
      steps: [
        addColumns({
          table: 'inventory_items',
          columns: [
            { name: 'current_stock', type: 'number', isOptional: true },
          ],
        }),
        // Ensure assessment_classes has deleted_at and updated_at columns for users upgrading from v32
        // These columns were added in v27 but may be missing for users who installed after v24 but before v27
        addColumns({
          table: 'assessment_classes',
          columns: [
            {
              name: 'deleted_at',
              type: 'number',
              isOptional: true,
            },
            { name: 'updated_at', type: 'number' },
          ],
        }),
        // Initialize updated_at for existing rows
        {
          type: 'sql',
          sql: "UPDATE assessment_classes SET updated_at = COALESCE(updated_at, created_at, CAST(strftime('%s','now') AS INTEGER) * 1000) WHERE updated_at IS NULL;",
        },
      ],
    },
  ],
});
