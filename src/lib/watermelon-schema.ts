import { appSchema, tableSchema } from '@nozbe/watermelondb';

export const schema = appSchema({
  version: 5,
  tables: [
    tableSchema({
      name: 'series',
      columns: [
        { name: 'title', type: 'string' },
        { name: 'description', type: 'string', isOptional: true },
        { name: 'dtstart_local', type: 'string' },
        { name: 'dtstart_utc', type: 'string' },
        { name: 'timezone', type: 'string' },
        { name: 'rrule', type: 'string' },
        { name: 'until_utc', type: 'string', isOptional: true },
        { name: 'count', type: 'number', isOptional: true },
        { name: 'plant_id', type: 'string', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),
    tableSchema({
      name: 'occurrence_overrides',
      columns: [
        { name: 'series_id', type: 'string' },
        { name: 'occurrence_local_date', type: 'string' },
        { name: 'due_at_local', type: 'string', isOptional: true },
        { name: 'due_at_utc', type: 'string', isOptional: true },
        { name: 'reminder_at_local', type: 'string', isOptional: true },
        { name: 'reminder_at_utc', type: 'string', isOptional: true },
        { name: 'status', type: 'string', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),
    tableSchema({
      name: 'tasks',
      columns: [
        { name: 'series_id', type: 'string', isOptional: true },
        { name: 'title', type: 'string' },
        { name: 'description', type: 'string', isOptional: true },
        { name: 'due_at_local', type: 'string' },
        { name: 'due_at_utc', type: 'string' },
        { name: 'timezone', type: 'string' },
        { name: 'reminder_at_local', type: 'string', isOptional: true },
        { name: 'reminder_at_utc', type: 'string', isOptional: true },
        { name: 'plant_id', type: 'string', isOptional: true },
        { name: 'status', type: 'string' },
        { name: 'completed_at', type: 'number', isOptional: true },
        { name: 'metadata', type: 'string' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),
    tableSchema({
      name: 'notification_queue',
      columns: [
        { name: 'task_id', type: 'string' },
        { name: 'notification_id', type: 'string' },
        { name: 'scheduled_for_local', type: 'string' },
        { name: 'scheduled_for_utc', type: 'string' },
        { name: 'timezone', type: 'string' },
        { name: 'status', type: 'string' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'image_upload_queue',
      columns: [
        { name: 'local_uri', type: 'string' },
        { name: 'remote_path', type: 'string', isOptional: true },
        { name: 'task_id', type: 'string', isOptional: true },
        { name: 'plant_id', type: 'string', isOptional: true },
        { name: 'filename', type: 'string', isOptional: true },
        { name: 'mime_type', type: 'string', isOptional: true },
        { name: 'status', type: 'string', isIndexed: true }, // pending | uploading | completed | failed
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
    }),
    // Nutrient Engine Tables
    tableSchema({
      name: 'ph_ec_readings',
      columns: [
        { name: 'plant_id', type: 'string', isOptional: true },
        { name: 'reservoir_id', type: 'string', isOptional: true },
        { name: 'measured_at', type: 'number', isIndexed: true },
        { name: 'ph', type: 'number', isOptional: true },
        { name: 'ec_raw', type: 'number', isOptional: true },
        { name: 'ec_25c', type: 'number', isOptional: true },
        { name: 'temp_c', type: 'number', isOptional: true },
        { name: 'atc_on', type: 'boolean' },
        { name: 'ppm_scale', type: 'string' },
        { name: 'meter_id', type: 'string', isOptional: true, isIndexed: true },
        { name: 'note', type: 'string', isOptional: true },
        { name: 'quality_flags', type: 'string', isOptional: true }, // JSON array of flags
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),
    tableSchema({
      name: 'deviation_alerts',
      columns: [
        { name: 'plant_id', type: 'string', isOptional: true },
        { name: 'reservoir_id', type: 'string', isOptional: true },
        { name: 'alert_type', type: 'string' }, // Avoid indexing low-cardinality enum
        { name: 'severity', type: 'string' }, // Avoid indexing low-cardinality enum
        { name: 'title', type: 'string' },
        { name: 'message', type: 'string' },
        {
          name: 'measurement_id',
          type: 'string',
          isOptional: true,
          isIndexed: true,
        },
        { name: 'correction_playbook_id', type: 'string', isOptional: true },
        { name: 'triggered_at', type: 'number', isIndexed: true },
        { name: 'delivered_at_local', type: 'number', isOptional: true },
        { name: 'synced_at', type: 'number', isOptional: true },
        { name: 'delivery_attempts', type: 'number' },
        { name: 'acknowledged_at', type: 'number', isOptional: true },
        { name: 'resolved_at', type: 'number', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),
    tableSchema({
      name: 'reservoirs',
      columns: [
        { name: 'name', type: 'string' },
        { name: 'volume_l', type: 'number', isOptional: true },
        { name: 'medium', type: 'string' }, // Avoid indexing low-cardinality enum
        { name: 'target_ph_min', type: 'number' },
        { name: 'target_ph_max', type: 'number' },
        { name: 'target_ec_min_25c', type: 'number' },
        { name: 'target_ec_max_25c', type: 'number' },
        { name: 'ppm_scale', type: 'string' },
        { name: 'source_water_profile_id', type: 'string', isOptional: true },
        { name: 'playbook_binding', type: 'string', isOptional: true }, // JSON
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),
    tableSchema({
      name: 'source_water_profiles',
      columns: [
        { name: 'name', type: 'string' },
        { name: 'baseline_ec_25c', type: 'number' },
        { name: 'alkalinity_mg_per_l_caco3', type: 'number', isOptional: true },
        { name: 'hardness_mg_per_l', type: 'number', isOptional: true },
        { name: 'last_tested_at', type: 'string', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),
    tableSchema({
      name: 'meters',
      columns: [
        { name: 'name', type: 'string' },
        { name: 'type', type: 'string' }, // Avoid indexing low-cardinality enum
        { name: 'manufacturer', type: 'string', isOptional: true },
        { name: 'model', type: 'string', isOptional: true },
        { name: 'serial_number', type: 'string', isOptional: true },
        { name: 'last_calibration_at', type: 'string', isOptional: true },
        { name: 'calibration_due_at', type: 'string', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),
    tableSchema({
      name: 'meter_calibrations',
      columns: [
        { name: 'meter_id', type: 'string', isIndexed: true },
        { name: 'type', type: 'string' }, // Avoid indexing low-cardinality enum
        { name: 'calibration_points', type: 'string' }, // JSON array
        { name: 'slope', type: 'number', isOptional: true },
        { name: 'offset', type: 'number', isOptional: true },
        { name: 'temp_c', type: 'number', isOptional: true },
        { name: 'performed_at', type: 'number' },
        { name: 'performed_by', type: 'string', isOptional: true },
        { name: 'notes', type: 'string', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),
    tableSchema({
      name: 'feeding_schedules',
      columns: [
        { name: 'name', type: 'string' },
        { name: 'description', type: 'string', isOptional: true },
        { name: 'medium', type: 'string' }, // Avoid indexing low-cardinality enum
        { name: 'plant_stage', type: 'string' }, // Avoid indexing low-cardinality enum
        { name: 'strain_id', type: 'string', isOptional: true },
        { name: 'reservoir_id', type: 'string', isOptional: true },
        { name: 'schedule_data', type: 'string' }, // JSON with rrule and nutrients
        { name: 'is_template', type: 'boolean' },
        { name: 'is_active', type: 'boolean' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),
    tableSchema({
      name: 'feeding_events',
      columns: [
        { name: 'schedule_id', type: 'string', isOptional: true },
        { name: 'reservoir_id', type: 'string', isOptional: true },
        { name: 'plant_id', type: 'string', isOptional: true },
        { name: 'fed_at', type: 'number', isIndexed: true },
        { name: 'nutrients_applied', type: 'string' }, // JSON
        { name: 'ph_adjusted', type: 'number', isOptional: true },
        { name: 'ec_measured_25c', type: 'number', isOptional: true },
        { name: 'volume_added_l', type: 'number', isOptional: true },
        { name: 'notes', type: 'string', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),
    tableSchema({
      name: 'correction_playbooks',
      columns: [
        { name: 'name', type: 'string' },
        { name: 'description', type: 'string', isOptional: true },
        { name: 'problem_type', type: 'string' },
        { name: 'medium', type: 'string' }, // Avoid indexing low-cardinality enum
        { name: 'severity', type: 'string' }, // Avoid indexing low-cardinality enum
        { name: 'correction_steps', type: 'string' }, // JSON array
        { name: 'expected_outcome', type: 'string' },
        { name: 'time_to_effect_hours', type: 'number', isOptional: true },
        { name: 'is_offline_available', type: 'boolean' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),
  ],
});
