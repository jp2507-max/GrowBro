import { appSchema as createSchema, tableSchema } from '@nozbe/watermelondb';

export const appSchema = createSchema({
  version: 16,
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
        { name: 'user_id', type: 'string', isOptional: true },
        { name: 'server_revision', type: 'number', isOptional: true },
        { name: 'server_updated_at_ms', type: 'number', isOptional: true },
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
        { name: 'user_id', type: 'string', isOptional: true },
        { name: 'server_revision', type: 'number', isOptional: true },
        { name: 'server_updated_at_ms', type: 'number', isOptional: true },
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
        { name: 'playbook_id', type: 'string', isOptional: true },
        { name: 'origin_step_id', type: 'string', isOptional: true },
        { name: 'phase_index', type: 'number', isOptional: true },
        { name: 'notification_id', type: 'string', isOptional: true },
        { name: 'user_id', type: 'string', isOptional: true },
        { name: 'server_revision', type: 'number', isOptional: true },
        { name: 'server_updated_at_ms', type: 'number', isOptional: true },
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
      name: 'notifications',
      columns: [
        { name: 'type', type: 'string', isIndexed: true },
        { name: 'title', type: 'string' },
        { name: 'body', type: 'string' },
        { name: 'data', type: 'string' },
        { name: 'deep_link', type: 'string', isOptional: true },
        { name: 'read_at', type: 'number', isOptional: true, isIndexed: true },
        { name: 'created_at', type: 'number', isIndexed: true },
        {
          name: 'expires_at',
          type: 'number',
          isOptional: true,
          isIndexed: true,
        },
        {
          name: 'message_id',
          type: 'string',
          isOptional: true,
          isIndexed: true,
        },
        {
          name: 'archived_at',
          type: 'number',
          isOptional: true,
          isIndexed: true,
        },
        {
          name: 'deleted_at',
          type: 'number',
          isOptional: true,
          isIndexed: true,
        },
      ],
    }),
    tableSchema({
      name: 'notification_preferences',
      columns: [
        // Uniqueness by user_id is enforced at the application level via findOrCreate/upsert methods
        { name: 'user_id', type: 'string', isIndexed: true },
        { name: 'community_interactions', type: 'boolean' },
        { name: 'community_likes', type: 'boolean' },
        { name: 'cultivation_reminders', type: 'boolean' },
        { name: 'system_updates', type: 'boolean' },
        { name: 'quiet_hours_enabled', type: 'boolean' },
        { name: 'quiet_hours_start', type: 'string', isOptional: true },
        { name: 'quiet_hours_end', type: 'string', isOptional: true },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'device_tokens',
      columns: [
        { name: 'token', type: 'string', isIndexed: true },
        { name: 'platform', type: 'string' },
        { name: 'user_id', type: 'string', isIndexed: true },
        { name: 'created_at', type: 'number' },
        { name: 'last_used_at', type: 'number' },
        { name: 'is_active', type: 'boolean', isIndexed: true },
      ],
    }),
    tableSchema({
      name: 'image_upload_queue',
      columns: [
        { name: 'local_uri', type: 'string' },
        { name: 'remote_path', type: 'string', isOptional: true },
        { name: 'task_id', type: 'string', isOptional: true },
        { name: 'plant_id', type: 'string', isOptional: true },
        { name: 'harvest_id', type: 'string', isOptional: true },
        { name: 'variant', type: 'string', isOptional: true },
        { name: 'hash', type: 'string', isOptional: true },
        { name: 'extension', type: 'string', isOptional: true },
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
        { name: 'user_id', type: 'string', isOptional: true },
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
    // Strains Browser Tables
    tableSchema({
      name: 'favorites',
      columns: [
        { name: 'strain_id', type: 'string', isIndexed: true },
        { name: 'user_id', type: 'string', isOptional: true, isIndexed: true },
        { name: 'added_at', type: 'number', isIndexed: true },
        { name: 'snapshot', type: 'string' },
        { name: 'synced_at', type: 'number', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),
    tableSchema({
      name: 'cached_strains',
      columns: [
        { name: 'query_hash', type: 'string', isIndexed: true },
        { name: 'page_number', type: 'number', isIndexed: true },
        { name: 'strains_data', type: 'string' },
        { name: 'cached_at', type: 'number' },
        { name: 'expires_at', type: 'number', isIndexed: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    // Guided Grow Playbooks Tables
    tableSchema({
      name: 'playbooks',
      columns: [
        { name: 'name', type: 'string' },
        { name: 'setup', type: 'string' }, // auto_indoor | auto_outdoor | photo_indoor | photo_outdoor
        { name: 'locale', type: 'string' },
        { name: 'phase_order', type: 'string' }, // JSON array of phases
        { name: 'steps', type: 'string' }, // JSON array of PlaybookStep
        { name: 'metadata', type: 'string' }, // JSON PlaybookMetadata
        { name: 'is_template', type: 'boolean' },
        { name: 'is_community', type: 'boolean' },
        { name: 'author_handle', type: 'string', isOptional: true },
        { name: 'license', type: 'string', isOptional: true },
        { name: 'server_revision', type: 'number', isOptional: true },
        { name: 'server_updated_at_ms', type: 'number', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),
    tableSchema({
      name: 'playbook_applications',
      columns: [
        { name: 'playbook_id', type: 'string', isIndexed: true },
        { name: 'plant_id', type: 'string', isIndexed: true },
        { name: 'applied_at', type: 'number', isIndexed: true },
        { name: 'task_count', type: 'number' },
        { name: 'duration_ms', type: 'number' },
        { name: 'job_id', type: 'string' },
        {
          name: 'idempotency_key',
          type: 'string',
          isOptional: true,
          isIndexed: true,
        },
        { name: 'status', type: 'string' }, // pending | completed | failed
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'undo_descriptors',
      columns: [
        { name: 'operation_type', type: 'string' },
        { name: 'affected_task_ids', type: 'string' }, // JSON array
        { name: 'prior_field_values', type: 'string' }, // JSON object
        { name: 'timestamp', type: 'number', isIndexed: true },
        { name: 'expires_at', type: 'number', isIndexed: true },
        { name: 'created_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'outbox_notification_actions',
      columns: [
        { name: 'action_type', type: 'string' },
        { name: 'payload', type: 'string' }, // JSON object
        {
          name: 'business_key',
          type: 'string',
          isOptional: true,
          isIndexed: true,
        },
        { name: 'ttl', type: 'number' },
        { name: 'expires_at', type: 'number', isIndexed: true },
        { name: 'next_attempt_at', type: 'number', isIndexed: true },
        { name: 'attempted_count', type: 'number' },
        { name: 'status', type: 'string', isIndexed: true },
        { name: 'last_error', type: 'string', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'ai_suggestions',
      columns: [
        { name: 'plant_id', type: 'string', isIndexed: true },
        { name: 'suggestion_type', type: 'string' },
        { name: 'reasoning', type: 'string' },
        { name: 'affected_tasks', type: 'string' }, // JSON array
        { name: 'confidence', type: 'number' },
        {
          name: 'cooldown_until',
          type: 'number',
          isOptional: true,
          isIndexed: true,
        },
        { name: 'expires_at', type: 'number', isIndexed: true },
        { name: 'status', type: 'string' }, // pending | accepted | declined
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'trichome_assessments',
      columns: [
        { name: 'plant_id', type: 'string', isIndexed: true },
        { name: 'assessment_date', type: 'string' },
        { name: 'clear_percent', type: 'number', isOptional: true },
        { name: 'milky_percent', type: 'number', isOptional: true },
        { name: 'amber_percent', type: 'number', isOptional: true },
        { name: 'photos', type: 'string', isOptional: true }, // JSON array of URIs
        { name: 'notes', type: 'string', isOptional: true },
        { name: 'harvest_window_suggestion', type: 'string', isOptional: true }, // JSON object
        { name: 'created_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'adjustment_suggestions',
      columns: [
        { name: 'plant_id', type: 'string', isIndexed: true },
        { name: 'playbook_id', type: 'string', isOptional: true },
        { name: 'suggestion_type', type: 'string' },
        { name: 'root_cause', type: 'string' },
        { name: 'reasoning', type: 'string' },
        { name: 'affected_tasks', type: 'string' }, // JSON array of task adjustments
        { name: 'confidence', type: 'number' },
        { name: 'status', type: 'string' }, // pending | accepted | declined | expired
        { name: 'accepted_tasks', type: 'string', isOptional: true }, // JSON array of accepted task IDs
        { name: 'helpfulness_vote', type: 'string', isOptional: true }, // helpful | not_helpful
        { name: 'expires_at', type: 'number', isIndexed: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'adjustment_cooldowns',
      columns: [
        { name: 'plant_id', type: 'string', isIndexed: true },
        { name: 'root_cause', type: 'string', isIndexed: true },
        { name: 'cooldown_until', type: 'number', isIndexed: true },
        { name: 'created_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'plant_adjustment_preferences',
      columns: [
        { name: 'plant_id', type: 'string', isIndexed: true },
        { name: 'never_suggest', type: 'boolean' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'harvests',
      columns: [
        { name: 'plant_id', type: 'string', isIndexed: true },
        { name: 'user_id', type: 'string', isOptional: true },
        { name: 'stage', type: 'string', isIndexed: true },
        { name: 'wet_weight_g', type: 'number', isOptional: true },
        { name: 'dry_weight_g', type: 'number', isOptional: true },
        { name: 'trimmings_weight_g', type: 'number', isOptional: true },
        { name: 'notes', type: 'string' },
        { name: 'stage_started_at', type: 'number' },
        { name: 'stage_completed_at', type: 'number', isOptional: true },
        { name: 'photos', type: 'string' }, // JSON array of photo URIs
        { name: 'notification_id', type: 'string', isOptional: true }, // Target duration notification
        { name: 'overdue_notification_id', type: 'string', isOptional: true }, // Max duration reminder
        { name: 'server_revision', type: 'number', isOptional: true },
        { name: 'server_updated_at_ms', type: 'number', isOptional: true },
        { name: 'conflict_seen', type: 'boolean' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),
    tableSchema({
      name: 'inventory',
      columns: [
        { name: 'plant_id', type: 'string', isIndexed: true },
        { name: 'harvest_id', type: 'string', isIndexed: true },
        { name: 'user_id', type: 'string', isOptional: true },
        { name: 'final_weight_g', type: 'number' },
        { name: 'harvest_date', type: 'string' }, // ISO date string
        { name: 'total_duration_days', type: 'number' },
        { name: 'server_revision', type: 'number', isOptional: true },
        { name: 'server_updated_at_ms', type: 'number', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),
    tableSchema({
      name: 'harvest_audits',
      columns: [
        { name: 'harvest_id', type: 'string', isIndexed: true },
        { name: 'user_id', type: 'string', isOptional: true },
        { name: 'action', type: 'string' },
        { name: 'status', type: 'string' },
        { name: 'from_stage', type: 'string', isOptional: true },
        { name: 'to_stage', type: 'string', isOptional: true },
        { name: 'reason', type: 'string' },
        { name: 'performed_at', type: 'number' },
        { name: 'metadata', type: 'string' }, // JSON
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
        { name: 'server_revision', type: 'number' },
        { name: 'server_updated_at_ms', type: 'number' },
      ],
    }),
  ],
});

// Backwards compatibility export
export const schema = appSchema;
