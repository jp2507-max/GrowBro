-- Migration: Fix function_search_path_mutable security warnings
-- Sets search_path = '' for all affected functions to prevent search path injection attacks

-- privacy schema
ALTER FUNCTION privacy.set_updated_at() SET search_path = '';

-- public schema - trigger functions (no arguments)
ALTER FUNCTION public.check_comment_moderation_fields() SET search_path = '';
ALTER FUNCTION public.check_post_moderation_fields() SET search_path = '';
ALTER FUNCTION public.cleanup_expired_age_tokens() SET search_path = '';
ALTER FUNCTION public.cleanup_expired_geo_location_cache() SET search_path = '';
ALTER FUNCTION public.cleanup_expired_rate_limits() SET search_path = '';
ALTER FUNCTION public.cleanup_expired_tombstones() SET search_path = '';
ALTER FUNCTION public.cleanup_old_audit_logs() SET search_path = '';
ALTER FUNCTION public.cleanup_old_security_email_logs() SET search_path = '';
ALTER FUNCTION public.create_next_audit_partition() SET search_path = '';
ALTER FUNCTION public.decrement_like_count() SET search_path = '';
ALTER FUNCTION public.increment_like_count() SET search_path = '';
ALTER FUNCTION public.is_moderator() SET search_path = '';
ALTER FUNCTION public.ph_ec_readings_set_helpers() SET search_path = '';
ALTER FUNCTION public.poll_expo_push_receipts() SET search_path = '';
ALTER FUNCTION public.prevent_audit_modification() SET search_path = '';
ALTER FUNCTION public.prevent_hidden_at_changes() SET search_path = '';
ALTER FUNCTION public.prevent_moderation_field_changes() SET search_path = '';
ALTER FUNCTION public.prevent_non_moderator_moderation_updates() SET search_path = '';
ALTER FUNCTION public.process_notification_requests() SET search_path = '';
-- run_monthly_partition_maintenance() handled in 20251223140500_fix_partition_maintenance_schema_qualify.sql
-- (requires schema-qualified calls to helper functions before setting search_path = '')
ALTER FUNCTION public.set_audit_retention() SET search_path = '';
ALTER FUNCTION public.set_audit_signature() SET search_path = '';
ALTER FUNCTION public.set_updated_at() SET search_path = '';
ALTER FUNCTION public.update_account_deletion_requests_updated_at() SET search_path = '';
ALTER FUNCTION public.update_appeals_updated_at() SET search_path = '';
ALTER FUNCTION public.update_bug_reports_updated_at() SET search_path = '';
ALTER FUNCTION public.update_comment_count() SET search_path = '';
ALTER FUNCTION public.update_content_reports_updated_at() SET search_path = '';
ALTER FUNCTION public.update_favorites_updated_at() SET search_path = '';
ALTER FUNCTION public.update_geo_restriction_appeals_updated_at() SET search_path = '';
ALTER FUNCTION public.update_geo_restriction_rules_updated_at() SET search_path = '';
ALTER FUNCTION public.update_geo_restrictions_updated_at() SET search_path = '';
ALTER FUNCTION public.update_help_articles_updated_at() SET search_path = '';
ALTER FUNCTION public.update_model_metadata_updated_at() SET search_path = '';
ALTER FUNCTION public.update_moderation_claims_updated_at() SET search_path = '';
ALTER FUNCTION public.update_moderation_decisions_updated_at() SET search_path = '';
ALTER FUNCTION public.update_notification_delivery_log_updated_at() SET search_path = '';
ALTER FUNCTION public.update_notification_preferences_last_updated() SET search_path = '';
ALTER FUNCTION public.update_ods_bodies_updated_at() SET search_path = '';
ALTER FUNCTION public.update_ods_escalations_updated_at() SET search_path = '';
ALTER FUNCTION public.update_partition_manifests_updated_at() SET search_path = '';
ALTER FUNCTION public.update_profiles_updated_at() SET search_path = '';
ALTER FUNCTION public.update_push_notification_queue_updated_at() SET search_path = '';
ALTER FUNCTION public.update_push_tokens_updated_at() SET search_path = '';
ALTER FUNCTION public.update_repeat_offender_records_updated_at() SET search_path = '';
ALTER FUNCTION public.update_sla_alerts_updated_at() SET search_path = '';
ALTER FUNCTION public.update_sla_incidents_updated_at() SET search_path = '';
ALTER FUNCTION public.update_sor_export_queue_updated_at() SET search_path = '';
ALTER FUNCTION public.update_statements_of_reasons_updated_at() SET search_path = '';
ALTER FUNCTION public.update_strain_cache_updated_at() SET search_path = '';
ALTER FUNCTION public.update_template_rating_average() SET search_path = '';
ALTER FUNCTION public.update_trusted_flaggers_updated_at() SET search_path = '';
ALTER FUNCTION public.update_updated_at_column() SET search_path = '';
ALTER FUNCTION public.update_users_updated_at() SET search_path = '';

-- Functions with arguments (using exact signatures)
ALTER FUNCTION public.apply_sync_push(bigint, jsonb, text) SET search_path = '';
ALTER FUNCTION public.calculate_retention_date(text, timestamptz) SET search_path = '';
ALTER FUNCTION public.cancel_deletion_request(uuid) SET search_path = '';
ALTER FUNCTION public.check_age_gating_access(uuid, text, text) SET search_path = '';
ALTER FUNCTION public.check_content_geo_availability(uuid, jsonb) SET search_path = '';
ALTER FUNCTION public.check_delivery_rate_threshold(numeric) SET search_path = '';
ALTER FUNCTION public.check_pending_deletion(uuid) SET search_path = '';
ALTER FUNCTION public.check_sor_delivery_compliance(uuid) SET search_path = '';
ALTER FUNCTION public.drop_expired_partition(text, boolean) SET search_path = '';
ALTER FUNCTION public.generate_audit_signature(text, uuid, text, text, jsonb, timestamptz) SET search_path = '';
ALTER FUNCTION public.generate_partition_checksum(text) SET search_path = '';
ALTER FUNCTION public.get_delivery_rate(text, integer) SET search_path = '';
ALTER FUNCTION public.get_expired_partitions(text, integer) SET search_path = '';
ALTER FUNCTION public.get_or_create_profile(uuid, text) SET search_path = '';
ALTER FUNCTION public.get_retention_expiry_date(text, timestamptz) SET search_path = '';
ALTER FUNCTION public.get_unacknowledged_alerts(uuid) SET search_path = '';
ALTER FUNCTION public.has_pending_deletion_request(uuid) SET search_path = '';
ALTER FUNCTION public.increment_rate_limit(uuid, text, integer, integer, integer) SET search_path = '';
ALTER FUNCTION public.increment_template_adoption(uuid) SET search_path = '';
ALTER FUNCTION public.is_claim_active(timestamptz) SET search_path = '';
ALTER FUNCTION public.is_under_legal_hold(text, uuid) SET search_path = '';
ALTER FUNCTION public.is_user_age_verified(uuid) SET search_path = '';
ALTER FUNCTION public.log_auth_event(uuid, text, inet, text, jsonb) SET search_path = '';
ALTER FUNCTION public.perform_sync_pull(bigint) SET search_path = '';
ALTER FUNCTION public.perform_sync_pull_v2(bigint, jsonb, integer) SET search_path = '';
ALTER FUNCTION public.search_help_articles(text, text, text, integer) SET search_path = '';
ALTER FUNCTION public.sync_pull_tasks_v2(timestamptz, integer, timestamptz, text, timestamptz, text) SET search_path = '';
ALTER FUNCTION public.upsert_push_token(uuid, text, text, timestamptz) SET search_path = '';
ALTER FUNCTION public.verify_audit_signature(uuid) SET search_path = '';

-- Functions with multiple overloads
ALTER FUNCTION public.digest(bytea, text) SET search_path = '';
ALTER FUNCTION public.digest(text, text) SET search_path = '';
ALTER FUNCTION public.execute_moderation_action(uuid, uuid) SET search_path = '';
ALTER FUNCTION public.execute_moderation_action(uuid, text, text, text, uuid, text, integer, timestamptz, text[], uuid) SET search_path = '';
ALTER FUNCTION public.seal_audit_partition(text) SET search_path = '';
ALTER FUNCTION public.seal_audit_partition(text, text) SET search_path = '';
ALTER FUNCTION public.soft_delete_comment(uuid) SET search_path = '';
ALTER FUNCTION public.soft_delete_comment(uuid, uuid) SET search_path = '';
