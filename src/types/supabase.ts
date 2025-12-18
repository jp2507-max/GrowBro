export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '13.0.4';
  };
  public: {
    Tables: {
      account_deletion_requests: {
        Row: {
          completed_at: string | null;
          id: string;
          policy_version: string;
          reason: string | null;
          request_id: string;
          requested_at: string;
          scheduled_for: string;
          status: string;
          user_id: string;
        };
        Insert: {
          completed_at?: string | null;
          id?: string;
          policy_version: string;
          reason?: string | null;
          request_id: string;
          requested_at?: string;
          scheduled_for: string;
          status?: string;
          user_id: string;
        };
        Update: {
          completed_at?: string | null;
          id?: string;
          policy_version?: string;
          reason?: string | null;
          request_id?: string;
          requested_at?: string;
          scheduled_for?: string;
          status?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      action_executions: {
        Row: {
          action: string;
          content_id: string;
          decision_id: string;
          duration_days: number | null;
          executed_at: string;
          executed_by: string;
          expires_at: string | null;
          id: string;
          idempotency_key: string | null;
          reason_code: string;
          territorial_scope: string[] | null;
          user_id: string;
        };
        Insert: {
          action: string;
          content_id: string;
          decision_id: string;
          duration_days?: number | null;
          executed_at?: string;
          executed_by: string;
          expires_at?: string | null;
          id?: string;
          idempotency_key?: string | null;
          reason_code: string;
          territorial_scope?: string[] | null;
          user_id: string;
        };
        Update: {
          action?: string;
          content_id?: string;
          decision_id?: string;
          duration_days?: number | null;
          executed_at?: string;
          executed_by?: string;
          expires_at?: string | null;
          id?: string;
          idempotency_key?: string | null;
          reason_code?: string;
          territorial_scope?: string[] | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'action_executions_decision_id_fkey';
            columns: ['decision_id'];
            isOneToOne: true;
            referencedRelation: 'mod_sor_submission_trail';
            referencedColumns: ['decision_id'];
          },
          {
            foreignKeyName: 'action_executions_decision_id_fkey';
            columns: ['decision_id'];
            isOneToOne: true;
            referencedRelation: 'moderation_decisions';
            referencedColumns: ['id'];
          },
        ];
      };
      age_verification_audit: {
        Row: {
          access_granted: boolean | null;
          consent_given: boolean | null;
          content_id: string | null;
          content_type: string | null;
          created_at: string;
          event_type: string;
          failure_reason: string | null;
          id: string;
          ip_address: unknown;
          legal_basis: string;
          result: string | null;
          retention_period: string;
          suspicious_signals: Json | null;
          token_id: string | null;
          user_agent: string | null;
          user_id: string | null;
          verification_method: string | null;
        };
        Insert: {
          access_granted?: boolean | null;
          consent_given?: boolean | null;
          content_id?: string | null;
          content_type?: string | null;
          created_at?: string;
          event_type: string;
          failure_reason?: string | null;
          id?: string;
          ip_address?: unknown;
          legal_basis?: string;
          result?: string | null;
          retention_period?: string;
          suspicious_signals?: Json | null;
          token_id?: string | null;
          user_agent?: string | null;
          user_id?: string | null;
          verification_method?: string | null;
        };
        Update: {
          access_granted?: boolean | null;
          consent_given?: boolean | null;
          content_id?: string | null;
          content_type?: string | null;
          created_at?: string;
          event_type?: string;
          failure_reason?: string | null;
          id?: string;
          ip_address?: unknown;
          legal_basis?: string;
          result?: string | null;
          retention_period?: string;
          suspicious_signals?: Json | null;
          token_id?: string | null;
          user_agent?: string | null;
          user_id?: string | null;
          verification_method?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'age_verification_audit_token_id_fkey';
            columns: ['token_id'];
            isOneToOne: false;
            referencedRelation: 'age_verification_tokens';
            referencedColumns: ['id'];
          },
        ];
      };
      age_verification_tokens: {
        Row: {
          age_attribute_verified: boolean;
          assurance_level: string | null;
          created_at: string;
          expires_at: string;
          id: string;
          issued_at: string;
          max_uses: number;
          revocation_reason: string | null;
          revoked_at: string | null;
          token_hash: string;
          updated_at: string;
          use_count: number;
          used_at: string | null;
          user_id: string;
          verification_method: string;
          verification_provider: string | null;
        };
        Insert: {
          age_attribute_verified?: boolean;
          assurance_level?: string | null;
          created_at?: string;
          expires_at: string;
          id?: string;
          issued_at?: string;
          max_uses?: number;
          revocation_reason?: string | null;
          revoked_at?: string | null;
          token_hash: string;
          updated_at?: string;
          use_count?: number;
          used_at?: string | null;
          user_id: string;
          verification_method: string;
          verification_provider?: string | null;
        };
        Update: {
          age_attribute_verified?: boolean;
          assurance_level?: string | null;
          created_at?: string;
          expires_at?: string;
          id?: string;
          issued_at?: string;
          max_uses?: number;
          revocation_reason?: string | null;
          revoked_at?: string | null;
          token_hash?: string;
          updated_at?: string;
          use_count?: number;
          used_at?: string | null;
          user_id?: string;
          verification_method?: string;
          verification_provider?: string | null;
        };
        Relationships: [];
      };
      appeals: {
        Row: {
          appeal_type: string;
          counter_arguments: string;
          created_at: string;
          deadline: string;
          decision: string | null;
          decision_reasoning: string | null;
          deleted_at: string | null;
          id: string;
          ods_body_name: string | null;
          ods_escalation_id: string | null;
          ods_resolved_at: string | null;
          ods_submitted_at: string | null;
          original_decision_id: string;
          resolved_at: string | null;
          reviewer_id: string | null;
          status: string;
          submitted_at: string;
          supporting_evidence: string[] | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          appeal_type: string;
          counter_arguments: string;
          created_at?: string;
          deadline: string;
          decision?: string | null;
          decision_reasoning?: string | null;
          deleted_at?: string | null;
          id?: string;
          ods_body_name?: string | null;
          ods_escalation_id?: string | null;
          ods_resolved_at?: string | null;
          ods_submitted_at?: string | null;
          original_decision_id: string;
          resolved_at?: string | null;
          reviewer_id?: string | null;
          status?: string;
          submitted_at?: string;
          supporting_evidence?: string[] | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          appeal_type?: string;
          counter_arguments?: string;
          created_at?: string;
          deadline?: string;
          decision?: string | null;
          decision_reasoning?: string | null;
          deleted_at?: string | null;
          id?: string;
          ods_body_name?: string | null;
          ods_escalation_id?: string | null;
          ods_resolved_at?: string | null;
          ods_submitted_at?: string | null;
          original_decision_id?: string;
          resolved_at?: string | null;
          reviewer_id?: string | null;
          status?: string;
          submitted_at?: string;
          supporting_evidence?: string[] | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'appeals_original_decision_id_fkey';
            columns: ['original_decision_id'];
            isOneToOne: false;
            referencedRelation: 'mod_sor_submission_trail';
            referencedColumns: ['decision_id'];
          },
          {
            foreignKeyName: 'appeals_original_decision_id_fkey';
            columns: ['original_decision_id'];
            isOneToOne: false;
            referencedRelation: 'moderation_decisions';
            referencedColumns: ['id'];
          },
        ];
      };
      audit_events: {
        Row: {
          action: string;
          actor_id: string;
          actor_type: string;
          created_at: string;
          event_type: string;
          id: string;
          metadata: Json;
          pii_tagged: boolean;
          retention_until: string;
          signature: string;
          target_id: string;
          target_type: string;
          timestamp: string;
        };
        Insert: {
          action: string;
          actor_id: string;
          actor_type: string;
          created_at?: string;
          event_type: string;
          id?: string;
          metadata?: Json;
          pii_tagged?: boolean;
          retention_until: string;
          signature: string;
          target_id: string;
          target_type: string;
          timestamp?: string;
        };
        Update: {
          action?: string;
          actor_id?: string;
          actor_type?: string;
          created_at?: string;
          event_type?: string;
          id?: string;
          metadata?: Json;
          pii_tagged?: boolean;
          retention_until?: string;
          signature?: string;
          target_id?: string;
          target_type?: string;
          timestamp?: string;
        };
        Relationships: [];
      };
      audit_events_202510: {
        Row: {
          action: string;
          actor_id: string;
          actor_type: string;
          created_at: string;
          event_type: string;
          id: string;
          metadata: Json;
          pii_tagged: boolean;
          retention_until: string;
          signature: string;
          target_id: string;
          target_type: string;
          timestamp: string;
        };
        Insert: {
          action: string;
          actor_id: string;
          actor_type: string;
          created_at?: string;
          event_type: string;
          id?: string;
          metadata?: Json;
          pii_tagged?: boolean;
          retention_until: string;
          signature: string;
          target_id: string;
          target_type: string;
          timestamp?: string;
        };
        Update: {
          action?: string;
          actor_id?: string;
          actor_type?: string;
          created_at?: string;
          event_type?: string;
          id?: string;
          metadata?: Json;
          pii_tagged?: boolean;
          retention_until?: string;
          signature?: string;
          target_id?: string;
          target_type?: string;
          timestamp?: string;
        };
        Relationships: [];
      };
      audit_events_202511: {
        Row: {
          action: string;
          actor_id: string;
          actor_type: string;
          created_at: string;
          event_type: string;
          id: string;
          metadata: Json;
          pii_tagged: boolean;
          retention_until: string;
          signature: string;
          target_id: string;
          target_type: string;
          timestamp: string;
        };
        Insert: {
          action: string;
          actor_id: string;
          actor_type: string;
          created_at?: string;
          event_type: string;
          id?: string;
          metadata?: Json;
          pii_tagged?: boolean;
          retention_until: string;
          signature: string;
          target_id: string;
          target_type: string;
          timestamp?: string;
        };
        Update: {
          action?: string;
          actor_id?: string;
          actor_type?: string;
          created_at?: string;
          event_type?: string;
          id?: string;
          metadata?: Json;
          pii_tagged?: boolean;
          retention_until?: string;
          signature?: string;
          target_id?: string;
          target_type?: string;
          timestamp?: string;
        };
        Relationships: [];
      };
      audit_events_202512: {
        Row: {
          action: string;
          actor_id: string;
          actor_type: string;
          created_at: string;
          event_type: string;
          id: string;
          metadata: Json;
          pii_tagged: boolean;
          retention_until: string;
          signature: string;
          target_id: string;
          target_type: string;
          timestamp: string;
        };
        Insert: {
          action: string;
          actor_id: string;
          actor_type: string;
          created_at?: string;
          event_type: string;
          id?: string;
          metadata?: Json;
          pii_tagged?: boolean;
          retention_until: string;
          signature: string;
          target_id: string;
          target_type: string;
          timestamp?: string;
        };
        Update: {
          action?: string;
          actor_id?: string;
          actor_type?: string;
          created_at?: string;
          event_type?: string;
          id?: string;
          metadata?: Json;
          pii_tagged?: boolean;
          retention_until?: string;
          signature?: string;
          target_id?: string;
          target_type?: string;
          timestamp?: string;
        };
        Relationships: [];
      };
      audit_events_202601: {
        Row: {
          action: string;
          actor_id: string;
          actor_type: string;
          created_at: string;
          event_type: string;
          id: string;
          metadata: Json;
          pii_tagged: boolean;
          retention_until: string;
          signature: string;
          target_id: string;
          target_type: string;
          timestamp: string;
        };
        Insert: {
          action: string;
          actor_id: string;
          actor_type: string;
          created_at?: string;
          event_type: string;
          id?: string;
          metadata?: Json;
          pii_tagged?: boolean;
          retention_until: string;
          signature: string;
          target_id: string;
          target_type: string;
          timestamp?: string;
        };
        Update: {
          action?: string;
          actor_id?: string;
          actor_type?: string;
          created_at?: string;
          event_type?: string;
          id?: string;
          metadata?: Json;
          pii_tagged?: boolean;
          retention_until?: string;
          signature?: string;
          target_id?: string;
          target_type?: string;
          timestamp?: string;
        };
        Relationships: [];
      };
      audit_events_202602: {
        Row: {
          action: string;
          actor_id: string;
          actor_type: string;
          created_at: string;
          event_type: string;
          id: string;
          metadata: Json;
          pii_tagged: boolean;
          retention_until: string;
          signature: string;
          target_id: string;
          target_type: string;
          timestamp: string;
        };
        Insert: {
          action: string;
          actor_id: string;
          actor_type: string;
          created_at?: string;
          event_type: string;
          id?: string;
          metadata?: Json;
          pii_tagged?: boolean;
          retention_until: string;
          signature: string;
          target_id: string;
          target_type: string;
          timestamp?: string;
        };
        Update: {
          action?: string;
          actor_id?: string;
          actor_type?: string;
          created_at?: string;
          event_type?: string;
          id?: string;
          metadata?: Json;
          pii_tagged?: boolean;
          retention_until?: string;
          signature?: string;
          target_id?: string;
          target_type?: string;
          timestamp?: string;
        };
        Relationships: [];
      };
      audit_events_202603: {
        Row: {
          action: string;
          actor_id: string;
          actor_type: string;
          created_at: string;
          event_type: string;
          id: string;
          metadata: Json;
          pii_tagged: boolean;
          retention_until: string;
          signature: string;
          target_id: string;
          target_type: string;
          timestamp: string;
        };
        Insert: {
          action: string;
          actor_id: string;
          actor_type: string;
          created_at?: string;
          event_type: string;
          id?: string;
          metadata?: Json;
          pii_tagged?: boolean;
          retention_until: string;
          signature: string;
          target_id: string;
          target_type: string;
          timestamp?: string;
        };
        Update: {
          action?: string;
          actor_id?: string;
          actor_type?: string;
          created_at?: string;
          event_type?: string;
          id?: string;
          metadata?: Json;
          pii_tagged?: boolean;
          retention_until?: string;
          signature?: string;
          target_id?: string;
          target_type?: string;
          timestamp?: string;
        };
        Relationships: [];
      };
      audit_events_202604: {
        Row: {
          action: string;
          actor_id: string;
          actor_type: string;
          created_at: string;
          event_type: string;
          id: string;
          metadata: Json;
          pii_tagged: boolean;
          retention_until: string;
          signature: string;
          target_id: string;
          target_type: string;
          timestamp: string;
        };
        Insert: {
          action: string;
          actor_id: string;
          actor_type: string;
          created_at?: string;
          event_type: string;
          id?: string;
          metadata?: Json;
          pii_tagged?: boolean;
          retention_until: string;
          signature: string;
          target_id: string;
          target_type: string;
          timestamp?: string;
        };
        Update: {
          action?: string;
          actor_id?: string;
          actor_type?: string;
          created_at?: string;
          event_type?: string;
          id?: string;
          metadata?: Json;
          pii_tagged?: boolean;
          retention_until?: string;
          signature?: string;
          target_id?: string;
          target_type?: string;
          timestamp?: string;
        };
        Relationships: [];
      };
      audit_logs: {
        Row: {
          app_version: string | null;
          created_at: string;
          event_type: string;
          id: string;
          payload: Json | null;
          policy_version: string | null;
          user_id: string | null;
        };
        Insert: {
          app_version?: string | null;
          created_at?: string;
          event_type: string;
          id?: string;
          payload?: Json | null;
          policy_version?: string | null;
          user_id?: string | null;
        };
        Update: {
          app_version?: string | null;
          created_at?: string;
          event_type?: string;
          id?: string;
          payload?: Json | null;
          policy_version?: string | null;
          user_id?: string | null;
        };
        Relationships: [];
      };
      auth_audit_log: {
        Row: {
          created_at: string;
          event_type: string;
          id: string;
          ip_address: unknown;
          metadata: Json | null;
          user_agent: string | null;
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          event_type: string;
          id?: string;
          ip_address?: unknown;
          metadata?: Json | null;
          user_agent?: string | null;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          event_type?: string;
          id?: string;
          ip_address?: unknown;
          metadata?: Json | null;
          user_agent?: string | null;
          user_id?: string | null;
        };
        Relationships: [];
      };
      auth_lockouts: {
        Row: {
          created_at: string;
          email_hash: string;
          failed_attempts: number;
          id: string;
          locked_until: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          email_hash: string;
          failed_attempts?: number;
          id?: string;
          locked_until?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          email_hash?: string;
          failed_attempts?: number;
          id?: string;
          locked_until?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      bug_reports: {
        Row: {
          category: string;
          created_at: string;
          description: string;
          diagnostics: Json;
          id: string;
          screenshot_url: string | null;
          sentry_event_id: string | null;
          status: string;
          ticket_id: string;
          title: string;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          category: string;
          created_at?: string;
          description: string;
          diagnostics: Json;
          id?: string;
          screenshot_url?: string | null;
          sentry_event_id?: string | null;
          status?: string;
          ticket_id: string;
          title: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          category?: string;
          created_at?: string;
          description?: string;
          diagnostics?: Json;
          id?: string;
          screenshot_url?: string | null;
          sentry_event_id?: string | null;
          status?: string;
          ticket_id?: string;
          title?: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      calibrations: {
        Row: {
          cal_offset: number;
          created_at: string;
          deleted_at: string | null;
          expires_at: string;
          id: string;
          is_valid: boolean;
          meter_id: string;
          method: string | null;
          performed_at: string;
          points_json: Json;
          server_revision: number | null;
          server_updated_at_ms: number | null;
          slope: number;
          temp_c: number;
          type: string;
          updated_at: string;
          user_id: string | null;
          valid_days: number | null;
        };
        Insert: {
          cal_offset: number;
          created_at?: string;
          deleted_at?: string | null;
          expires_at: string;
          id?: string;
          is_valid?: boolean;
          meter_id: string;
          method?: string | null;
          performed_at: string;
          points_json?: Json;
          server_revision?: number | null;
          server_updated_at_ms?: number | null;
          slope: number;
          temp_c: number;
          type: string;
          updated_at?: string;
          user_id?: string | null;
          valid_days?: number | null;
        };
        Update: {
          cal_offset?: number;
          created_at?: string;
          deleted_at?: string | null;
          expires_at?: string;
          id?: string;
          is_valid?: boolean;
          meter_id?: string;
          method?: string | null;
          performed_at?: string;
          points_json?: Json;
          server_revision?: number | null;
          server_updated_at_ms?: number | null;
          slope?: number;
          temp_c?: number;
          type?: string;
          updated_at?: string;
          user_id?: string | null;
          valid_days?: number | null;
        };
        Relationships: [];
      };
      community_playbook_templates: {
        Row: {
          adoption_count: number;
          author_handle: string;
          author_id: string;
          created_at: string;
          deleted_at: string | null;
          description: string | null;
          id: string;
          license: string;
          locale: string;
          name: string;
          phase_order: Json;
          rating_average: number | null;
          rating_count: number;
          setup: string;
          steps: Json;
          task_count: number | null;
          total_weeks: number | null;
          updated_at: string;
        };
        Insert: {
          adoption_count?: number;
          author_handle: string;
          author_id: string;
          created_at?: string;
          deleted_at?: string | null;
          description?: string | null;
          id?: string;
          license?: string;
          locale?: string;
          name: string;
          phase_order?: Json;
          rating_average?: number | null;
          rating_count?: number;
          setup: string;
          steps: Json;
          task_count?: number | null;
          total_weeks?: number | null;
          updated_at?: string;
        };
        Update: {
          adoption_count?: number;
          author_handle?: string;
          author_id?: string;
          created_at?: string;
          deleted_at?: string | null;
          description?: string | null;
          id?: string;
          license?: string;
          locale?: string;
          name?: string;
          phase_order?: Json;
          rating_average?: number | null;
          rating_count?: number;
          setup?: string;
          steps?: Json;
          task_count?: number | null;
          total_weeks?: number | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      consent_records: {
        Row: {
          consent_date: string;
          consent_given: boolean;
          id: string;
          legal_basis: string;
          metadata: Json | null;
          purpose: string;
          user_id: string;
          version: string;
          withdrawn_date: string | null;
        };
        Insert: {
          consent_date?: string;
          consent_given: boolean;
          id?: string;
          legal_basis: string;
          metadata?: Json | null;
          purpose: string;
          user_id: string;
          version: string;
          withdrawn_date?: string | null;
        };
        Update: {
          consent_date?: string;
          consent_given?: boolean;
          id?: string;
          legal_basis?: string;
          metadata?: Json | null;
          purpose?: string;
          user_id?: string;
          version?: string;
          withdrawn_date?: string | null;
        };
        Relationships: [];
      };
      content_age_restrictions: {
        Row: {
          content_id: string;
          content_type: string;
          created_at: string;
          flagged_by_author: boolean;
          flagged_by_moderator: boolean;
          flagged_by_system: boolean;
          id: string;
          is_age_restricted: boolean;
          keywords_detected: string[] | null;
          min_age: number;
          moderator_id: string | null;
          restriction_reason: string | null;
          updated_at: string;
        };
        Insert: {
          content_id: string;
          content_type: string;
          created_at?: string;
          flagged_by_author?: boolean;
          flagged_by_moderator?: boolean;
          flagged_by_system?: boolean;
          id?: string;
          is_age_restricted?: boolean;
          keywords_detected?: string[] | null;
          min_age?: number;
          moderator_id?: string | null;
          restriction_reason?: string | null;
          updated_at?: string;
        };
        Update: {
          content_id?: string;
          content_type?: string;
          created_at?: string;
          flagged_by_author?: boolean;
          flagged_by_moderator?: boolean;
          flagged_by_system?: boolean;
          id?: string;
          is_age_restricted?: boolean;
          keywords_detected?: string[] | null;
          min_age?: number;
          moderator_id?: string | null;
          restriction_reason?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      content_geo_blocks: {
        Row: {
          content_id: string;
          created_at: string;
          id: string;
          reason_code: string;
          territory_code: string;
        };
        Insert: {
          content_id: string;
          created_at?: string;
          id?: string;
          reason_code: string;
          territory_code: string;
        };
        Update: {
          content_id?: string;
          created_at?: string;
          id?: string;
          reason_code?: string;
          territory_code?: string;
        };
        Relationships: [];
      };
      content_reports: {
        Row: {
          content_hash: string;
          content_id: string;
          content_locator: string;
          content_snapshot_id: string | null;
          content_type: string;
          created_at: string;
          deleted_at: string | null;
          duplicate_of_report_id: string | null;
          evidence_urls: string[] | null;
          explanation: string;
          good_faith_declaration: boolean;
          id: string;
          jurisdiction: string | null;
          legal_reference: string | null;
          priority: number;
          report_type: string;
          reporter_contact: Json;
          reporter_id: string;
          sla_deadline: string;
          status: string;
          trusted_flagger: boolean;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          content_hash: string;
          content_id: string;
          content_locator: string;
          content_snapshot_id?: string | null;
          content_type: string;
          created_at?: string;
          deleted_at?: string | null;
          duplicate_of_report_id?: string | null;
          evidence_urls?: string[] | null;
          explanation: string;
          good_faith_declaration: boolean;
          id?: string;
          jurisdiction?: string | null;
          legal_reference?: string | null;
          priority?: number;
          report_type: string;
          reporter_contact: Json;
          reporter_id: string;
          sla_deadline: string;
          status?: string;
          trusted_flagger?: boolean;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          content_hash?: string;
          content_id?: string;
          content_locator?: string;
          content_snapshot_id?: string | null;
          content_type?: string;
          created_at?: string;
          deleted_at?: string | null;
          duplicate_of_report_id?: string | null;
          evidence_urls?: string[] | null;
          explanation?: string;
          good_faith_declaration?: boolean;
          id?: string;
          jurisdiction?: string | null;
          legal_reference?: string | null;
          priority?: number;
          report_type?: string;
          reporter_contact?: Json;
          reporter_id?: string;
          sla_deadline?: string;
          status?: string;
          trusted_flagger?: boolean;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'content_reports_duplicate_of_report_id_fkey';
            columns: ['duplicate_of_report_id'];
            isOneToOne: false;
            referencedRelation: 'content_reports';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_content_reports_snapshot';
            columns: ['content_snapshot_id'];
            isOneToOne: false;
            referencedRelation: 'content_snapshots';
            referencedColumns: ['id'];
          },
        ];
      };
      content_snapshots: {
        Row: {
          captured_at: string;
          captured_by_report_id: string | null;
          content_id: string;
          content_type: string;
          created_at: string;
          id: string;
          snapshot_data: Json;
          snapshot_hash: string;
          storage_path: string | null;
        };
        Insert: {
          captured_at?: string;
          captured_by_report_id?: string | null;
          content_id: string;
          content_type: string;
          created_at?: string;
          id?: string;
          snapshot_data: Json;
          snapshot_hash: string;
          storage_path?: string | null;
        };
        Update: {
          captured_at?: string;
          captured_by_report_id?: string | null;
          content_id?: string;
          content_type?: string;
          created_at?: string;
          id?: string;
          snapshot_data?: Json;
          snapshot_hash?: string;
          storage_path?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'content_snapshots_captured_by_report_id_fkey';
            columns: ['captured_by_report_id'];
            isOneToOne: false;
            referencedRelation: 'content_reports';
            referencedColumns: ['id'];
          },
        ];
      };
      data_deletion_records: {
        Row: {
          deleted_at: string;
          deleted_by: string;
          deletion_type: string;
          id: string;
          metadata: Json | null;
          reason: string;
          retention_policy: string;
          target_id: string;
          target_type: string;
          tombstone_until: string | null;
        };
        Insert: {
          deleted_at?: string;
          deleted_by: string;
          deletion_type: string;
          id?: string;
          metadata?: Json | null;
          reason: string;
          retention_policy: string;
          target_id: string;
          target_type: string;
          tombstone_until?: string | null;
        };
        Update: {
          deleted_at?: string;
          deleted_by?: string;
          deletion_type?: string;
          id?: string;
          metadata?: Json | null;
          reason?: string;
          retention_policy?: string;
          target_id?: string;
          target_type?: string;
          tombstone_until?: string | null;
        };
        Relationships: [];
      };
      data_subject_requests: {
        Row: {
          completed_at: string | null;
          export_url: string | null;
          id: string;
          metadata: Json | null;
          rejection_reason: string | null;
          request_type: string;
          requested_at: string;
          status: string;
          user_id: string;
          verification_token: string;
        };
        Insert: {
          completed_at?: string | null;
          export_url?: string | null;
          id?: string;
          metadata?: Json | null;
          rejection_reason?: string | null;
          request_type: string;
          requested_at?: string;
          status: string;
          user_id: string;
          verification_token: string;
        };
        Update: {
          completed_at?: string | null;
          export_url?: string | null;
          id?: string;
          metadata?: Json | null;
          rejection_reason?: string | null;
          request_type?: string;
          requested_at?: string;
          status?: string;
          user_id?: string;
          verification_token?: string;
        };
        Relationships: [];
      };
      deviation_alerts_v2: {
        Row: {
          acknowledged_at: string | null;
          cooldown_until: string | null;
          created_at: string;
          deleted_at: string | null;
          delivered_at_local: string | null;
          id: string;
          message: string;
          reading_id: string;
          recommendation_codes_json: Json | null;
          recommendations_json: Json;
          resolved_at: string | null;
          server_revision: number | null;
          server_updated_at_ms: number | null;
          severity: string;
          triggered_at: string;
          type: string;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          acknowledged_at?: string | null;
          cooldown_until?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          delivered_at_local?: string | null;
          id?: string;
          message: string;
          reading_id: string;
          recommendation_codes_json?: Json | null;
          recommendations_json?: Json;
          resolved_at?: string | null;
          server_revision?: number | null;
          server_updated_at_ms?: number | null;
          severity: string;
          triggered_at: string;
          type: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          acknowledged_at?: string | null;
          cooldown_until?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          delivered_at_local?: string | null;
          id?: string;
          message?: string;
          reading_id?: string;
          recommendation_codes_json?: Json | null;
          recommendations_json?: Json;
          resolved_at?: string | null;
          server_revision?: number | null;
          server_updated_at_ms?: number | null;
          severity?: string;
          triggered_at?: string;
          type?: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      diagnostic_results_v2: {
        Row: {
          ai_confidence: number | null;
          ai_hypothesis_id: string | null;
          ai_metadata_json: Json | null;
          ai_override: boolean;
          confidence: number;
          confidence_flags_json: Json | null;
          confidence_source: string;
          confidence_threshold: number | null;
          created_at: string;
          deleted_at: string | null;
          disclaimer_keys_json: Json | null;
          feedback_helpful_count: number | null;
          feedback_not_helpful_count: number | null;
          id: string;
          input_reading_ids_json: Json | null;
          issue_severity: string;
          issue_type: string;
          needs_second_opinion: boolean;
          nutrient_code: string | null;
          plant_id: string;
          rationale_json: Json | null;
          recommendation_codes_json: Json | null;
          recommendations_json: Json;
          reservoir_id: string | null;
          resolution_notes: string | null;
          resolved_at: string | null;
          rules_based: boolean;
          rules_confidence: number | null;
          server_revision: number | null;
          server_updated_at_ms: number | null;
          symptoms_json: Json;
          updated_at: string;
          user_id: string | null;
          water_profile_id: string | null;
        };
        Insert: {
          ai_confidence?: number | null;
          ai_hypothesis_id?: string | null;
          ai_metadata_json?: Json | null;
          ai_override?: boolean;
          confidence: number;
          confidence_flags_json?: Json | null;
          confidence_source: string;
          confidence_threshold?: number | null;
          created_at?: string;
          deleted_at?: string | null;
          disclaimer_keys_json?: Json | null;
          feedback_helpful_count?: number | null;
          feedback_not_helpful_count?: number | null;
          id?: string;
          input_reading_ids_json?: Json | null;
          issue_severity: string;
          issue_type: string;
          needs_second_opinion?: boolean;
          nutrient_code?: string | null;
          plant_id: string;
          rationale_json?: Json | null;
          recommendation_codes_json?: Json | null;
          recommendations_json?: Json;
          reservoir_id?: string | null;
          resolution_notes?: string | null;
          resolved_at?: string | null;
          rules_based?: boolean;
          rules_confidence?: number | null;
          server_revision?: number | null;
          server_updated_at_ms?: number | null;
          symptoms_json?: Json;
          updated_at?: string;
          user_id?: string | null;
          water_profile_id?: string | null;
        };
        Update: {
          ai_confidence?: number | null;
          ai_hypothesis_id?: string | null;
          ai_metadata_json?: Json | null;
          ai_override?: boolean;
          confidence?: number;
          confidence_flags_json?: Json | null;
          confidence_source?: string;
          confidence_threshold?: number | null;
          created_at?: string;
          deleted_at?: string | null;
          disclaimer_keys_json?: Json | null;
          feedback_helpful_count?: number | null;
          feedback_not_helpful_count?: number | null;
          id?: string;
          input_reading_ids_json?: Json | null;
          issue_severity?: string;
          issue_type?: string;
          needs_second_opinion?: boolean;
          nutrient_code?: string | null;
          plant_id?: string;
          rationale_json?: Json | null;
          recommendation_codes_json?: Json | null;
          recommendations_json?: Json;
          reservoir_id?: string | null;
          resolution_notes?: string | null;
          resolved_at?: string | null;
          rules_based?: boolean;
          rules_confidence?: number | null;
          server_revision?: number | null;
          server_updated_at_ms?: number | null;
          symptoms_json?: Json;
          updated_at?: string;
          user_id?: string | null;
          water_profile_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'fk_diagnostic_results_reservoir';
            columns: ['reservoir_id'];
            isOneToOne: false;
            referencedRelation: 'reservoirs_v2';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_diagnostic_results_water_profile';
            columns: ['water_profile_id'];
            isOneToOne: false;
            referencedRelation: 'source_water_profiles_v2';
            referencedColumns: ['id'];
          },
        ];
      };
      encryption_keys: {
        Row: {
          created_at: string;
          expires_at: string;
          id: string;
          key_hash: string;
          metadata: Json | null;
          rotated_at: string | null;
          status: string;
          version: number;
        };
        Insert: {
          created_at?: string;
          expires_at?: string;
          id?: string;
          key_hash: string;
          metadata?: Json | null;
          rotated_at?: string | null;
          status?: string;
          version: number;
        };
        Update: {
          created_at?: string;
          expires_at?: string;
          id?: string;
          key_hash?: string;
          metadata?: Json | null;
          rotated_at?: string | null;
          status?: string;
          version?: number;
        };
        Relationships: [];
      };
      favorites: {
        Row: {
          added_at: number;
          created_at: string;
          deleted_at: string | null;
          id: string;
          snapshot: Json;
          strain_id: string;
          synced_at: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          added_at: number;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          snapshot: Json;
          strain_id: string;
          synced_at?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          added_at?: number;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          snapshot?: Json;
          strain_id?: string;
          synced_at?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      feedback: {
        Row: {
          category: string;
          created_at: string;
          email: string | null;
          id: string;
          message: string;
          user_id: string | null;
        };
        Insert: {
          category: string;
          created_at?: string;
          email?: string | null;
          id?: string;
          message: string;
          user_id?: string | null;
        };
        Update: {
          category?: string;
          created_at?: string;
          email?: string | null;
          id?: string;
          message?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      feeding_templates: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          id: string;
          is_custom: boolean;
          medium: string;
          name: string;
          phases_json: Json;
          server_revision: number | null;
          server_updated_at_ms: number | null;
          target_ranges_json: Json;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          is_custom?: boolean;
          medium: string;
          name: string;
          phases_json?: Json;
          server_revision?: number | null;
          server_updated_at_ms?: number | null;
          target_ranges_json?: Json;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          is_custom?: boolean;
          medium?: string;
          name?: string;
          phases_json?: Json;
          server_revision?: number | null;
          server_updated_at_ms?: number | null;
          target_ranges_json?: Json;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      geo_location_cache: {
        Row: {
          cached_at: string;
          confidence_score: number | null;
          expires_at: string;
          id: string;
          location_data: Json;
          location_method: string;
          user_id: string;
          vpn_detected: boolean;
        };
        Insert: {
          cached_at?: string;
          confidence_score?: number | null;
          expires_at: string;
          id?: string;
          location_data: Json;
          location_method: string;
          user_id: string;
          vpn_detected?: boolean;
        };
        Update: {
          cached_at?: string;
          confidence_score?: number | null;
          expires_at?: string;
          id?: string;
          location_data?: Json;
          location_method?: string;
          user_id?: string;
          vpn_detected?: boolean;
        };
        Relationships: [];
      };
      geo_restriction_appeals: {
        Row: {
          appeal_reason: string;
          created_at: string;
          id: string;
          resolved_at: string | null;
          restriction_id: string;
          review_notes: string | null;
          reviewer_id: string | null;
          status: string;
          supporting_evidence: Json | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          appeal_reason: string;
          created_at?: string;
          id?: string;
          resolved_at?: string | null;
          restriction_id: string;
          review_notes?: string | null;
          reviewer_id?: string | null;
          status?: string;
          supporting_evidence?: Json | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          appeal_reason?: string;
          created_at?: string;
          id?: string;
          resolved_at?: string | null;
          restriction_id?: string;
          review_notes?: string | null;
          reviewer_id?: string | null;
          status?: string;
          supporting_evidence?: Json | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'geo_restriction_appeals_restriction_id_fkey';
            columns: ['restriction_id'];
            isOneToOne: false;
            referencedRelation: 'geo_restrictions';
            referencedColumns: ['id'];
          },
        ];
      };
      geo_restriction_notifications: {
        Row: {
          created_at: string;
          delivery_method: string;
          delivery_status: string;
          error_message: string | null;
          id: string;
          notification_type: string;
          recipient_id: string;
          restriction_id: string;
          sent_at: string | null;
        };
        Insert: {
          created_at?: string;
          delivery_method: string;
          delivery_status?: string;
          error_message?: string | null;
          id?: string;
          notification_type: string;
          recipient_id: string;
          restriction_id: string;
          sent_at?: string | null;
        };
        Update: {
          created_at?: string;
          delivery_method?: string;
          delivery_status?: string;
          error_message?: string | null;
          id?: string;
          notification_type?: string;
          recipient_id?: string;
          restriction_id?: string;
          sent_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'geo_restriction_notifications_restriction_id_fkey';
            columns: ['restriction_id'];
            isOneToOne: false;
            referencedRelation: 'geo_restrictions';
            referencedColumns: ['id'];
          },
        ];
      };
      geo_restriction_rules: {
        Row: {
          effective_from: string;
          expires_at: string | null;
          id: string;
          lawful_basis: string;
          priority: number;
          region_code: string;
          rule_config: Json;
          rule_type: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          effective_from?: string;
          expires_at?: string | null;
          id?: string;
          lawful_basis: string;
          priority?: number;
          region_code: string;
          rule_config: Json;
          rule_type: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          effective_from?: string;
          expires_at?: string | null;
          id?: string;
          lawful_basis?: string;
          priority?: number;
          region_code?: string;
          rule_config?: Json;
          rule_type?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      geo_restrictions: {
        Row: {
          applied_by: string | null;
          content_id: string;
          content_type: string;
          created_at: string;
          expires_at: string | null;
          id: string;
          include_in_sor: boolean;
          lawful_basis: string;
          permitted_regions: string[];
          reason_code: string;
          restricted_regions: string[];
          updated_at: string;
        };
        Insert: {
          applied_by?: string | null;
          content_id: string;
          content_type: string;
          created_at?: string;
          expires_at?: string | null;
          id?: string;
          include_in_sor?: boolean;
          lawful_basis: string;
          permitted_regions?: string[];
          reason_code: string;
          restricted_regions?: string[];
          updated_at?: string;
        };
        Update: {
          applied_by?: string | null;
          content_id?: string;
          content_type?: string;
          created_at?: string;
          expires_at?: string | null;
          id?: string;
          include_in_sor?: boolean;
          lawful_basis?: string;
          permitted_regions?: string[];
          reason_code?: string;
          restricted_regions?: string[];
          updated_at?: string;
        };
        Relationships: [];
      };
      harvests: {
        Row: {
          conflict_seen: boolean | null;
          created_at: string;
          deleted_at: string | null;
          dry_weight_g: number | null;
          id: string;
          notes: string | null;
          photos: Json;
          plant_id: string;
          server_revision: number | null;
          server_updated_at_ms: number | null;
          stage: string;
          stage_completed_at: string | null;
          stage_started_at: string;
          trimmings_weight_g: number | null;
          updated_at: string;
          user_id: string;
          wet_weight_g: number | null;
        };
        Insert: {
          conflict_seen?: boolean | null;
          created_at?: string;
          deleted_at?: string | null;
          dry_weight_g?: number | null;
          id?: string;
          notes?: string | null;
          photos?: Json;
          plant_id: string;
          server_revision?: number | null;
          server_updated_at_ms?: number | null;
          stage: string;
          stage_completed_at?: string | null;
          stage_started_at?: string;
          trimmings_weight_g?: number | null;
          updated_at?: string;
          user_id: string;
          wet_weight_g?: number | null;
        };
        Update: {
          conflict_seen?: boolean | null;
          created_at?: string;
          deleted_at?: string | null;
          dry_weight_g?: number | null;
          id?: string;
          notes?: string | null;
          photos?: Json;
          plant_id?: string;
          server_revision?: number | null;
          server_updated_at_ms?: number | null;
          stage?: string;
          stage_completed_at?: string | null;
          stage_started_at?: string;
          trimmings_weight_g?: number | null;
          updated_at?: string;
          user_id?: string;
          wet_weight_g?: number | null;
        };
        Relationships: [];
      };
      help_articles: {
        Row: {
          body_markdown: string;
          category: string;
          created_at: string;
          helpful_count: number | null;
          id: string;
          locale: string;
          not_helpful_count: number | null;
          search_vector: unknown;
          tags: string[] | null;
          title: string;
          updated_at: string;
          view_count: number | null;
        };
        Insert: {
          body_markdown: string;
          category: string;
          created_at?: string;
          helpful_count?: number | null;
          id?: string;
          locale?: string;
          not_helpful_count?: number | null;
          search_vector?: unknown;
          tags?: string[] | null;
          title: string;
          updated_at?: string;
          view_count?: number | null;
        };
        Update: {
          body_markdown?: string;
          category?: string;
          created_at?: string;
          helpful_count?: number | null;
          id?: string;
          locale?: string;
          not_helpful_count?: number | null;
          search_vector?: unknown;
          tags?: string[] | null;
          title?: string;
          updated_at?: string;
          view_count?: number | null;
        };
        Relationships: [];
      };
      idempotency_keys: {
        Row: {
          client_tx_id: string | null;
          created_at: string;
          endpoint: string;
          error_details: Json | null;
          expires_at: string;
          id: string;
          idempotency_key: string;
          payload_hash: string | null;
          request_payload: Json | null;
          response_payload: Json | null;
          status: string;
          user_id: string;
        };
        Insert: {
          client_tx_id?: string | null;
          created_at?: string;
          endpoint: string;
          error_details?: Json | null;
          expires_at?: string;
          id?: string;
          idempotency_key: string;
          payload_hash?: string | null;
          request_payload?: Json | null;
          response_payload?: Json | null;
          status: string;
          user_id: string;
        };
        Update: {
          client_tx_id?: string | null;
          created_at?: string;
          endpoint?: string;
          error_details?: Json | null;
          expires_at?: string;
          id?: string;
          idempotency_key?: string;
          payload_hash?: string | null;
          request_payload?: Json | null;
          response_payload?: Json | null;
          status?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      inventory: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          final_weight_g: number;
          harvest_date: string;
          harvest_id: string;
          id: string;
          plant_id: string;
          server_revision: number | null;
          server_updated_at_ms: number | null;
          total_duration_days: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          final_weight_g: number;
          harvest_date: string;
          harvest_id: string;
          id?: string;
          plant_id: string;
          server_revision?: number | null;
          server_updated_at_ms?: number | null;
          total_duration_days: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          final_weight_g?: number;
          harvest_date?: string;
          harvest_id?: string;
          id?: string;
          plant_id?: string;
          server_revision?: number | null;
          server_updated_at_ms?: number | null;
          total_duration_days?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      inventory_batches: {
        Row: {
          cost_per_unit_minor: number;
          created_at: string;
          deleted_at: string | null;
          expires_on: string | null;
          id: string;
          item_id: string;
          lot_number: string;
          quantity: number;
          received_at: string;
          server_revision: number | null;
          server_updated_at_ms: number | null;
          updated_at: string;
        };
        Insert: {
          cost_per_unit_minor: number;
          created_at?: string;
          deleted_at?: string | null;
          expires_on?: string | null;
          id?: string;
          item_id: string;
          lot_number: string;
          quantity: number;
          received_at: string;
          server_revision?: number | null;
          server_updated_at_ms?: number | null;
          updated_at?: string;
        };
        Update: {
          cost_per_unit_minor?: number;
          created_at?: string;
          deleted_at?: string | null;
          expires_on?: string | null;
          id?: string;
          item_id?: string;
          lot_number?: string;
          quantity?: number;
          received_at?: string;
          server_revision?: number | null;
          server_updated_at_ms?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'inventory_batches_item_id_fkey';
            columns: ['item_id'];
            isOneToOne: false;
            referencedRelation: 'inventory_items';
            referencedColumns: ['id'];
          },
        ];
      };
      inventory_items: {
        Row: {
          barcode: string | null;
          category: string;
          created_at: string;
          deleted_at: string | null;
          id: string;
          is_consumable: boolean;
          lead_time_days: number | null;
          min_stock: number;
          name: string;
          reorder_multiple: number;
          server_revision: number | null;
          server_updated_at_ms: number | null;
          sku: string | null;
          tracking_mode: string;
          unit_of_measure: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          barcode?: string | null;
          category: string;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          is_consumable?: boolean;
          lead_time_days?: number | null;
          min_stock?: number;
          name: string;
          reorder_multiple?: number;
          server_revision?: number | null;
          server_updated_at_ms?: number | null;
          sku?: string | null;
          tracking_mode: string;
          unit_of_measure: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          barcode?: string | null;
          category?: string;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          is_consumable?: boolean;
          lead_time_days?: number | null;
          min_stock?: number;
          name?: string;
          reorder_multiple?: number;
          server_revision?: number | null;
          server_updated_at_ms?: number | null;
          sku?: string | null;
          tracking_mode?: string;
          unit_of_measure?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      inventory_movements: {
        Row: {
          batch_id: string | null;
          cost_per_unit_minor: number | null;
          created_at: string;
          external_key: string | null;
          id: string;
          item_id: string;
          quantity_delta: number;
          reason: string;
          task_id: string | null;
          type: string;
        };
        Insert: {
          batch_id?: string | null;
          cost_per_unit_minor?: number | null;
          created_at?: string;
          external_key?: string | null;
          id?: string;
          item_id: string;
          quantity_delta: number;
          reason: string;
          task_id?: string | null;
          type: string;
        };
        Update: {
          batch_id?: string | null;
          cost_per_unit_minor?: number | null;
          created_at?: string;
          external_key?: string | null;
          id?: string;
          item_id?: string;
          quantity_delta?: number;
          reason?: string;
          task_id?: string | null;
          type?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'inventory_movements_batch_id_fkey';
            columns: ['batch_id'];
            isOneToOne: false;
            referencedRelation: 'inventory_batches';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'inventory_movements_item_id_fkey';
            columns: ['item_id'];
            isOneToOne: false;
            referencedRelation: 'inventory_items';
            referencedColumns: ['id'];
          },
        ];
      };
      legal_acceptances: {
        Row: {
          accepted_at: string;
          app_version: string;
          document_type: string;
          id: string;
          ip_address: unknown;
          locale: string;
          user_id: string;
          version: string;
        };
        Insert: {
          accepted_at?: string;
          app_version: string;
          document_type: string;
          id?: string;
          ip_address?: unknown;
          locale: string;
          user_id: string;
          version: string;
        };
        Update: {
          accepted_at?: string;
          app_version?: string;
          document_type?: string;
          id?: string;
          ip_address?: unknown;
          locale?: string;
          user_id?: string;
          version?: string;
        };
        Relationships: [];
      };
      legal_holds: {
        Row: {
          created_at: string;
          created_by: string;
          id: string;
          legal_basis: string;
          metadata: Json | null;
          reason: string;
          released_at: string | null;
          review_date: string;
          target_id: string;
          target_type: string;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          id?: string;
          legal_basis: string;
          metadata?: Json | null;
          reason: string;
          released_at?: string | null;
          review_date: string;
          target_id: string;
          target_type: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          id?: string;
          legal_basis?: string;
          metadata?: Json | null;
          reason?: string;
          released_at?: string | null;
          review_date?: string;
          target_id?: string;
          target_type?: string;
        };
        Relationships: [];
      };
      model_metadata: {
        Row: {
          architecture: string | null;
          checksum_sha256: string;
          created_at: string;
          created_by: string | null;
          deployed_at: string | null;
          deprecated_at: string | null;
          description: string | null;
          file_path: string;
          file_size_bytes: number;
          id: string;
          input_shape: Json | null;
          is_stable: boolean;
          min_app_version: string | null;
          model_type: string;
          previous_stable_version: string | null;
          quantization: string | null;
          release_notes: string | null;
          rollback_threshold: number;
          rollout_percentage: number;
          shadow_mode: boolean;
          shadow_percentage: number | null;
          status: string;
          supported_providers: Json | null;
          target_latency_ms: number | null;
          updated_at: string;
          version: string;
        };
        Insert: {
          architecture?: string | null;
          checksum_sha256: string;
          created_at?: string;
          created_by?: string | null;
          deployed_at?: string | null;
          deprecated_at?: string | null;
          description?: string | null;
          file_path: string;
          file_size_bytes: number;
          id?: string;
          input_shape?: Json | null;
          is_stable?: boolean;
          min_app_version?: string | null;
          model_type?: string;
          previous_stable_version?: string | null;
          quantization?: string | null;
          release_notes?: string | null;
          rollback_threshold?: number;
          rollout_percentage?: number;
          shadow_mode?: boolean;
          shadow_percentage?: number | null;
          status?: string;
          supported_providers?: Json | null;
          target_latency_ms?: number | null;
          updated_at?: string;
          version: string;
        };
        Update: {
          architecture?: string | null;
          checksum_sha256?: string;
          created_at?: string;
          created_by?: string | null;
          deployed_at?: string | null;
          deprecated_at?: string | null;
          description?: string | null;
          file_path?: string;
          file_size_bytes?: number;
          id?: string;
          input_shape?: Json | null;
          is_stable?: boolean;
          min_app_version?: string | null;
          model_type?: string;
          previous_stable_version?: string | null;
          quantization?: string | null;
          release_notes?: string | null;
          rollback_threshold?: number;
          rollout_percentage?: number;
          shadow_mode?: boolean;
          shadow_percentage?: number | null;
          status?: string;
          supported_providers?: Json | null;
          target_latency_ms?: number | null;
          updated_at?: string;
          version?: string;
        };
        Relationships: [];
      };
      moderation_audit: {
        Row: {
          action: string;
          actor_id: string;
          created_at: string;
          id: string;
          idempotency_key: string | null;
          reason: string | null;
          target_id: string;
          target_type: string;
        };
        Insert: {
          action: string;
          actor_id: string;
          created_at?: string;
          id?: string;
          idempotency_key?: string | null;
          reason?: string | null;
          target_id: string;
          target_type: string;
        };
        Update: {
          action?: string;
          actor_id?: string;
          created_at?: string;
          id?: string;
          idempotency_key?: string | null;
          reason?: string | null;
          target_id?: string;
          target_type?: string;
        };
        Relationships: [];
      };
      moderation_claims: {
        Row: {
          claimed_at: string;
          created_at: string;
          expires_at: string;
          id: string;
          moderator_id: string;
          report_id: string;
          updated_at: string;
        };
        Insert: {
          claimed_at?: string;
          created_at?: string;
          expires_at: string;
          id?: string;
          moderator_id: string;
          report_id: string;
          updated_at?: string;
        };
        Update: {
          claimed_at?: string;
          created_at?: string;
          expires_at?: string;
          id?: string;
          moderator_id?: string;
          report_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'moderation_claims_report_id_fkey';
            columns: ['report_id'];
            isOneToOne: false;
            referencedRelation: 'content_reports';
            referencedColumns: ['id'];
          },
        ];
      };
      moderation_decisions: {
        Row: {
          action: string;
          created_at: string;
          deleted_at: string | null;
          evidence: string[] | null;
          executed_at: string | null;
          id: string;
          moderator_id: string;
          policy_violations: string[];
          reasoning: string;
          report_id: string;
          requires_supervisor_approval: boolean;
          reversal_reason: string | null;
          reversed_at: string | null;
          statement_of_reasons_id: string | null;
          status: string;
          supervisor_id: string | null;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          action: string;
          created_at?: string;
          deleted_at?: string | null;
          evidence?: string[] | null;
          executed_at?: string | null;
          id?: string;
          moderator_id: string;
          policy_violations: string[];
          reasoning: string;
          report_id: string;
          requires_supervisor_approval?: boolean;
          reversal_reason?: string | null;
          reversed_at?: string | null;
          statement_of_reasons_id?: string | null;
          status?: string;
          supervisor_id?: string | null;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          action?: string;
          created_at?: string;
          deleted_at?: string | null;
          evidence?: string[] | null;
          executed_at?: string | null;
          id?: string;
          moderator_id?: string;
          policy_violations?: string[];
          reasoning?: string;
          report_id?: string;
          requires_supervisor_approval?: boolean;
          reversal_reason?: string | null;
          reversed_at?: string | null;
          statement_of_reasons_id?: string | null;
          status?: string;
          supervisor_id?: string | null;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'moderation_decisions_report_id_fkey';
            columns: ['report_id'];
            isOneToOne: false;
            referencedRelation: 'content_reports';
            referencedColumns: ['id'];
          },
        ];
      };
      moderation_metrics: {
        Row: {
          created_at: string;
          id: string;
          metadata: Json | null;
          metric_name: string;
          timestamp: string;
          value: number;
        };
        Insert: {
          created_at?: string;
          id?: string;
          metadata?: Json | null;
          metric_name: string;
          timestamp?: string;
          value: number;
        };
        Update: {
          created_at?: string;
          id?: string;
          metadata?: Json | null;
          metric_name?: string;
          timestamp?: string;
          value?: number;
        };
        Relationships: [];
      };
      moderation_notifications: {
        Row: {
          action: string;
          created_at: string;
          decision_id: string;
          error_message: string | null;
          id: string;
          scheduled_for: string;
          sent_at: string | null;
          status: string;
          user_id: string;
        };
        Insert: {
          action: string;
          created_at?: string;
          decision_id: string;
          error_message?: string | null;
          id?: string;
          scheduled_for: string;
          sent_at?: string | null;
          status?: string;
          user_id: string;
        };
        Update: {
          action?: string;
          created_at?: string;
          decision_id?: string;
          error_message?: string | null;
          id?: string;
          scheduled_for?: string;
          sent_at?: string | null;
          status?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'moderation_notifications_decision_id_fkey';
            columns: ['decision_id'];
            isOneToOne: false;
            referencedRelation: 'mod_sor_submission_trail';
            referencedColumns: ['decision_id'];
          },
          {
            foreignKeyName: 'moderation_notifications_decision_id_fkey';
            columns: ['decision_id'];
            isOneToOne: false;
            referencedRelation: 'moderation_decisions';
            referencedColumns: ['id'];
          },
        ];
      };
      moderator_alert_log: {
        Row: {
          acknowledged_at: string | null;
          alert_type: string;
          created_at: string;
          deadline_date: string | null;
          id: string;
          moderator_id: string;
          priority: string;
          report_id: string;
          sla_percentage: number | null;
        };
        Insert: {
          acknowledged_at?: string | null;
          alert_type: string;
          created_at?: string;
          deadline_date?: string | null;
          id?: string;
          moderator_id: string;
          priority: string;
          report_id: string;
          sla_percentage?: number | null;
        };
        Update: {
          acknowledged_at?: string | null;
          alert_type?: string;
          created_at?: string;
          deadline_date?: string | null;
          id?: string;
          moderator_id?: string;
          priority?: string;
          report_id?: string;
          sla_percentage?: number | null;
        };
        Relationships: [];
      };
      notification_delivery_log: {
        Row: {
          created_at: string;
          decision_id: string | null;
          delivered_at: string;
          error_message: string | null;
          id: string;
          notification_type: string;
          statement_id: string | null;
          status: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          decision_id?: string | null;
          delivered_at?: string;
          error_message?: string | null;
          id?: string;
          notification_type: string;
          statement_id?: string | null;
          status: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          decision_id?: string | null;
          delivered_at?: string;
          error_message?: string | null;
          id?: string;
          notification_type?: string;
          statement_id?: string | null;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      notification_preferences: {
        Row: {
          community_interactions: boolean | null;
          community_likes: boolean | null;
          created_at: string | null;
          cultivation_reminders: boolean | null;
          device_id: string | null;
          last_updated: string;
          marketing: boolean;
          quiet_hours_enabled: boolean;
          quiet_hours_end: string | null;
          quiet_hours_start: string | null;
          system_updates: boolean | null;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          community_interactions?: boolean | null;
          community_likes?: boolean | null;
          created_at?: string | null;
          cultivation_reminders?: boolean | null;
          device_id?: string | null;
          last_updated?: string;
          marketing?: boolean;
          quiet_hours_enabled?: boolean;
          quiet_hours_end?: string | null;
          quiet_hours_start?: string | null;
          system_updates?: boolean | null;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          community_interactions?: boolean | null;
          community_likes?: boolean | null;
          created_at?: string | null;
          cultivation_reminders?: boolean | null;
          device_id?: string | null;
          last_updated?: string;
          marketing?: boolean;
          quiet_hours_enabled?: boolean;
          quiet_hours_end?: string | null;
          quiet_hours_start?: string | null;
          system_updates?: boolean | null;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      notification_queue: {
        Row: {
          created_at: string;
          id: string;
          notification_id: string;
          scheduled_for_local: string;
          scheduled_for_utc: string;
          status: string;
          task_id: string;
          timezone: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          notification_id: string;
          scheduled_for_local: string;
          scheduled_for_utc: string;
          status: string;
          task_id: string;
          timezone: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          notification_id?: string;
          scheduled_for_local?: string;
          scheduled_for_utc?: string;
          status?: string;
          task_id?: string;
          timezone?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'notification_queue_task_id_fkey';
            columns: ['task_id'];
            isOneToOne: false;
            referencedRelation: 'tasks';
            referencedColumns: ['id'];
          },
        ];
      };
      notification_requests: {
        Row: {
          body: string;
          created_at: string | null;
          created_by: string;
          data: Json | null;
          deep_link: string | null;
          id: string;
          processed: boolean | null;
          processed_at: string | null;
          title: string;
          type: string;
          user_id: string;
        };
        Insert: {
          body: string;
          created_at?: string | null;
          created_by: string;
          data?: Json | null;
          deep_link?: string | null;
          id?: string;
          processed?: boolean | null;
          processed_at?: string | null;
          title: string;
          type: string;
          user_id: string;
        };
        Update: {
          body?: string;
          created_at?: string | null;
          created_by?: string;
          data?: Json | null;
          deep_link?: string | null;
          id?: string;
          processed?: boolean | null;
          processed_at?: string | null;
          title?: string;
          type?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          created_at: string;
          data: Json | null;
          id: string;
          message: string;
          read: boolean;
          read_at: string | null;
          title: string;
          type: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          data?: Json | null;
          id?: string;
          message: string;
          read?: boolean;
          read_at?: string | null;
          title: string;
          type: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          data?: Json | null;
          id?: string;
          message?: string;
          read?: boolean;
          read_at?: string | null;
          title?: string;
          type?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      occurrence_overrides: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          due_at_local: string | null;
          due_at_utc: string | null;
          id: string;
          occurrence_local_date: string;
          reminder_at_local: string | null;
          reminder_at_utc: string | null;
          series_id: string;
          server_revision: number | null;
          server_updated_at_ms: number | null;
          status: string | null;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          due_at_local?: string | null;
          due_at_utc?: string | null;
          id?: string;
          occurrence_local_date: string;
          reminder_at_local?: string | null;
          reminder_at_utc?: string | null;
          series_id: string;
          server_revision?: number | null;
          server_updated_at_ms?: number | null;
          status?: string | null;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          due_at_local?: string | null;
          due_at_utc?: string | null;
          id?: string;
          occurrence_local_date?: string;
          reminder_at_local?: string | null;
          reminder_at_utc?: string | null;
          series_id?: string;
          server_revision?: number | null;
          server_updated_at_ms?: number | null;
          status?: string | null;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'occurrence_overrides_series_id_fkey';
            columns: ['series_id'];
            isOneToOne: false;
            referencedRelation: 'series';
            referencedColumns: ['id'];
          },
        ];
      };
      ods_bodies: {
        Row: {
          average_resolution_days: number;
          certification_date: string;
          certification_number: string;
          certified_by: string;
          created_at: string;
          deleted_at: string | null;
          email: string;
          expiration_date: string | null;
          id: string;
          jurisdictions: string[];
          languages: string[];
          name: string;
          phone: string | null;
          processing_fee_amount: number | null;
          processing_fee_currency: string | null;
          processing_fee_description: string | null;
          specialization: string[];
          status: string;
          submission_instructions: string;
          submission_url: string;
          updated_at: string;
          website: string;
        };
        Insert: {
          average_resolution_days?: number;
          certification_date: string;
          certification_number: string;
          certified_by: string;
          created_at?: string;
          deleted_at?: string | null;
          email: string;
          expiration_date?: string | null;
          id?: string;
          jurisdictions?: string[];
          languages?: string[];
          name: string;
          phone?: string | null;
          processing_fee_amount?: number | null;
          processing_fee_currency?: string | null;
          processing_fee_description?: string | null;
          specialization?: string[];
          status?: string;
          submission_instructions: string;
          submission_url: string;
          updated_at?: string;
          website: string;
        };
        Update: {
          average_resolution_days?: number;
          certification_date?: string;
          certification_number?: string;
          certified_by?: string;
          created_at?: string;
          deleted_at?: string | null;
          email?: string;
          expiration_date?: string | null;
          id?: string;
          jurisdictions?: string[];
          languages?: string[];
          name?: string;
          phone?: string | null;
          processing_fee_amount?: number | null;
          processing_fee_currency?: string | null;
          processing_fee_description?: string | null;
          specialization?: string[];
          status?: string;
          submission_instructions?: string;
          submission_url?: string;
          updated_at?: string;
          website?: string;
        };
        Relationships: [];
      };
      ods_escalations: {
        Row: {
          actual_resolution_date: string | null;
          appeal_id: string;
          case_number: string | null;
          created_at: string;
          deleted_at: string | null;
          id: string;
          ods_body_id: string;
          ods_decision_document: string | null;
          outcome: string | null;
          outcome_reasoning: string | null;
          platform_action_completed: boolean | null;
          platform_action_date: string | null;
          platform_action_required: boolean | null;
          status: string;
          submitted_at: string;
          target_resolution_date: string;
          updated_at: string;
        };
        Insert: {
          actual_resolution_date?: string | null;
          appeal_id: string;
          case_number?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          ods_body_id: string;
          ods_decision_document?: string | null;
          outcome?: string | null;
          outcome_reasoning?: string | null;
          platform_action_completed?: boolean | null;
          platform_action_date?: string | null;
          platform_action_required?: boolean | null;
          status?: string;
          submitted_at?: string;
          target_resolution_date: string;
          updated_at?: string;
        };
        Update: {
          actual_resolution_date?: string | null;
          appeal_id?: string;
          case_number?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          ods_body_id?: string;
          ods_decision_document?: string | null;
          outcome?: string | null;
          outcome_reasoning?: string | null;
          platform_action_completed?: boolean | null;
          platform_action_date?: string | null;
          platform_action_required?: boolean | null;
          status?: string;
          submitted_at?: string;
          target_resolution_date?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'ods_escalations_appeal_id_fkey';
            columns: ['appeal_id'];
            isOneToOne: false;
            referencedRelation: 'appeals';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ods_escalations_ods_body_id_fkey';
            columns: ['ods_body_id'];
            isOneToOne: false;
            referencedRelation: 'ods_bodies';
            referencedColumns: ['id'];
          },
        ];
      };
      partition_manifests: {
        Row: {
          checksum: string;
          created_at: string;
          id: string;
          last_verified_at: string | null;
          manifest_signature: string;
          partition_end_date: string;
          partition_name: string;
          partition_start_date: string;
          record_count: number;
          table_name: string;
          updated_at: string;
          verification_status: string | null;
        };
        Insert: {
          checksum: string;
          created_at?: string;
          id?: string;
          last_verified_at?: string | null;
          manifest_signature: string;
          partition_end_date: string;
          partition_name: string;
          partition_start_date: string;
          record_count?: number;
          table_name: string;
          updated_at?: string;
          verification_status?: string | null;
        };
        Update: {
          checksum?: string;
          created_at?: string;
          id?: string;
          last_verified_at?: string | null;
          manifest_signature?: string;
          partition_end_date?: string;
          partition_name?: string;
          partition_start_date?: string;
          record_count?: number;
          table_name?: string;
          updated_at?: string;
          verification_status?: string | null;
        };
        Relationships: [];
      };
      ph_ec_readings: {
        Row: {
          atc_on: boolean | null;
          created_at: string;
          deleted_at: string | null;
          ec_25c: number | null;
          ec_raw: number | null;
          id: string;
          measured_at: string;
          measured_at_sec: string | null;
          meter_id: string | null;
          meter_id_fallback: string;
          note: string | null;
          ph: number | null;
          plant_id: string | null;
          ppm_scale: string | null;
          quality_flags: Json | null;
          reservoir_id: string | null;
          temp_c: number | null;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          atc_on?: boolean | null;
          created_at?: string;
          deleted_at?: string | null;
          ec_25c?: number | null;
          ec_raw?: number | null;
          id?: string;
          measured_at: string;
          measured_at_sec?: string | null;
          meter_id?: string | null;
          meter_id_fallback?: string;
          note?: string | null;
          ph?: number | null;
          plant_id?: string | null;
          ppm_scale?: string | null;
          quality_flags?: Json | null;
          reservoir_id?: string | null;
          temp_c?: number | null;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          atc_on?: boolean | null;
          created_at?: string;
          deleted_at?: string | null;
          ec_25c?: number | null;
          ec_raw?: number | null;
          id?: string;
          measured_at?: string;
          measured_at_sec?: string | null;
          meter_id?: string | null;
          meter_id_fallback?: string;
          note?: string | null;
          ph?: number | null;
          plant_id?: string | null;
          ppm_scale?: string | null;
          quality_flags?: Json | null;
          reservoir_id?: string | null;
          temp_c?: number | null;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      plants: {
        Row: {
          created_at: string;
          environment: string | null;
          expected_harvest_at: string | null;
          genetic_lean: string | null;
          health: string | null;
          id: string;
          image_url: string | null;
          last_fed_at: string | null;
          last_watered_at: string | null;
          metadata: Json | null;
          name: string;
          notes: string | null;
          photoperiod_type: string | null;
          planted_at: string | null;
          stage: string | null;
          strain: string | null;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          environment?: string | null;
          expected_harvest_at?: string | null;
          genetic_lean?: string | null;
          health?: string | null;
          id?: string;
          image_url?: string | null;
          last_fed_at?: string | null;
          last_watered_at?: string | null;
          metadata?: Json | null;
          name: string;
          notes?: string | null;
          photoperiod_type?: string | null;
          planted_at?: string | null;
          stage?: string | null;
          strain?: string | null;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          environment?: string | null;
          expected_harvest_at?: string | null;
          genetic_lean?: string | null;
          health?: string | null;
          id?: string;
          image_url?: string | null;
          last_fed_at?: string | null;
          last_watered_at?: string | null;
          metadata?: Json | null;
          name?: string;
          notes?: string | null;
          photoperiod_type?: string | null;
          planted_at?: string | null;
          stage?: string | null;
          strain?: string | null;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      post_comments: {
        Row: {
          body: string;
          client_tx_id: string | null;
          created_at: string;
          deleted_at: string | null;
          hidden_at: string | null;
          id: string;
          post_id: string;
          undo_expires_at: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          body: string;
          client_tx_id?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          hidden_at?: string | null;
          id?: string;
          post_id: string;
          undo_expires_at?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          body?: string;
          client_tx_id?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          hidden_at?: string | null;
          id?: string;
          post_id?: string;
          undo_expires_at?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'post_comments_post_id_fkey';
            columns: ['post_id'];
            isOneToOne: false;
            referencedRelation: 'posts';
            referencedColumns: ['id'];
          },
        ];
      };
      post_likes: {
        Row: {
          client_tx_id: string | null;
          created_at: string;
          post_id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          client_tx_id?: string | null;
          created_at?: string;
          post_id: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          client_tx_id?: string | null;
          created_at?: string;
          post_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'post_likes_post_id_fkey';
            columns: ['post_id'];
            isOneToOne: false;
            referencedRelation: 'posts';
            referencedColumns: ['id'];
          },
        ];
      };
      posts: {
        Row: {
          body: string;
          client_tx_id: string | null;
          comment_count: number;
          created_at: string;
          deleted_at: string | null;
          hidden_at: string | null;
          id: string;
          like_count: number;
          media_aspect_ratio: number | null;
          media_blurhash: string | null;
          media_bytes: number | null;
          media_height: number | null;
          media_resized_uri: string | null;
          media_thumbhash: string | null;
          media_thumbnail_uri: string | null;
          media_uri: string | null;
          media_width: number | null;
          moderation_reason: string | null;
          undo_expires_at: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          body: string;
          client_tx_id?: string | null;
          comment_count?: number;
          created_at?: string;
          deleted_at?: string | null;
          hidden_at?: string | null;
          id?: string;
          like_count?: number;
          media_aspect_ratio?: number | null;
          media_blurhash?: string | null;
          media_bytes?: number | null;
          media_height?: number | null;
          media_resized_uri?: string | null;
          media_thumbhash?: string | null;
          media_thumbnail_uri?: string | null;
          media_uri?: string | null;
          media_width?: number | null;
          moderation_reason?: string | null;
          undo_expires_at?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          body?: string;
          client_tx_id?: string | null;
          comment_count?: number;
          created_at?: string;
          deleted_at?: string | null;
          hidden_at?: string | null;
          id?: string;
          like_count?: number;
          media_aspect_ratio?: number | null;
          media_blurhash?: string | null;
          media_bytes?: number | null;
          media_height?: number | null;
          media_resized_uri?: string | null;
          media_thumbhash?: string | null;
          media_thumbnail_uri?: string | null;
          media_uri?: string | null;
          media_width?: number | null;
          moderation_reason?: string | null;
          undo_expires_at?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      privacy_notice_deliveries: {
        Row: {
          acknowledged_at: string | null;
          delivered_at: string;
          id: string;
          language: string;
          notice_id: string;
          user_id: string;
        };
        Insert: {
          acknowledged_at?: string | null;
          delivered_at?: string;
          id?: string;
          language: string;
          notice_id: string;
          user_id: string;
        };
        Update: {
          acknowledged_at?: string | null;
          delivered_at?: string;
          id?: string;
          language?: string;
          notice_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'privacy_notice_deliveries_notice_id_fkey';
            columns: ['notice_id'];
            isOneToOne: false;
            referencedRelation: 'privacy_notices';
            referencedColumns: ['id'];
          },
        ];
      };
      privacy_notices: {
        Row: {
          content: string;
          created_at: string;
          data_categories: string[];
          effective_date: string;
          id: string;
          language: string;
          legal_bases: string[];
          retention_periods: Json;
          third_party_processors: string[] | null;
          version: string;
        };
        Insert: {
          content: string;
          created_at?: string;
          data_categories: string[];
          effective_date: string;
          id?: string;
          language: string;
          legal_bases: string[];
          retention_periods: Json;
          third_party_processors?: string[] | null;
          version: string;
        };
        Update: {
          content?: string;
          created_at?: string;
          data_categories?: string[];
          effective_date?: string;
          id?: string;
          language?: string;
          legal_bases?: string[];
          retention_periods?: Json;
          third_party_processors?: string[] | null;
          version?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          allow_direct_messages: boolean;
          avatar_url: string | null;
          bio: string | null;
          created_at: string;
          display_name: string;
          id: string;
          location: string | null;
          show_profile_to_community: boolean;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          allow_direct_messages?: boolean;
          avatar_url?: string | null;
          bio?: string | null;
          created_at?: string;
          display_name: string;
          id?: string;
          location?: string | null;
          show_profile_to_community?: boolean;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          allow_direct_messages?: boolean;
          avatar_url?: string | null;
          bio?: string | null;
          created_at?: string;
          display_name?: string;
          id?: string;
          location?: string | null;
          show_profile_to_community?: boolean;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      push_notification_queue: {
        Row: {
          created_at: string | null;
          device_token: string | null;
          error_message: string | null;
          id: string;
          message_id: string;
          payload_summary: Json | null;
          platform: string | null;
          provider_message_name: string | null;
          status: string;
          type: string;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          device_token?: string | null;
          error_message?: string | null;
          id?: string;
          message_id: string;
          payload_summary?: Json | null;
          platform?: string | null;
          provider_message_name?: string | null;
          status: string;
          type: string;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          device_token?: string | null;
          error_message?: string | null;
          id?: string;
          message_id?: string;
          payload_summary?: Json | null;
          platform?: string | null;
          provider_message_name?: string | null;
          status?: string;
          type?: string;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      push_tokens: {
        Row: {
          created_at: string | null;
          is_active: boolean | null;
          last_used_at: string | null;
          platform: string;
          token: string;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          is_active?: boolean | null;
          last_used_at?: string | null;
          platform: string;
          token: string;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          is_active?: boolean | null;
          last_used_at?: string | null;
          platform?: string;
          token?: string;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      quality_thresholds: {
        Row: {
          acceptable_score: number;
          blur_min_variance: number;
          blur_severe_variance: number;
          blur_weight: number;
          borderline_score: number;
          composition_min_center_coverage: number;
          composition_min_plant_coverage: number;
          composition_weight: number;
          device_tier: string | null;
          exposure_over_max_ratio: number;
          exposure_range_max: number;
          exposure_range_min: number;
          exposure_under_max_ratio: number;
          exposure_weight: number;
          id: string;
          platform: Database['public']['Enums']['quality_platform_enum'];
          rollout_percentage: number;
          updated_at: string;
          version: number;
          white_balance_max_deviation: number;
          white_balance_severe_deviation: number;
          white_balance_weight: number;
        };
        Insert: {
          acceptable_score: number;
          blur_min_variance: number;
          blur_severe_variance: number;
          blur_weight: number;
          borderline_score: number;
          composition_min_center_coverage: number;
          composition_min_plant_coverage: number;
          composition_weight: number;
          device_tier?: string | null;
          exposure_over_max_ratio: number;
          exposure_range_max: number;
          exposure_range_min: number;
          exposure_under_max_ratio: number;
          exposure_weight: number;
          id?: string;
          platform?: Database['public']['Enums']['quality_platform_enum'];
          rollout_percentage?: number;
          updated_at?: string;
          version?: number;
          white_balance_max_deviation: number;
          white_balance_severe_deviation: number;
          white_balance_weight: number;
        };
        Update: {
          acceptable_score?: number;
          blur_min_variance?: number;
          blur_severe_variance?: number;
          blur_weight?: number;
          borderline_score?: number;
          composition_min_center_coverage?: number;
          composition_min_plant_coverage?: number;
          composition_weight?: number;
          device_tier?: string | null;
          exposure_over_max_ratio?: number;
          exposure_range_max?: number;
          exposure_range_min?: number;
          exposure_under_max_ratio?: number;
          exposure_weight?: number;
          id?: string;
          platform?: Database['public']['Enums']['quality_platform_enum'];
          rollout_percentage?: number;
          updated_at?: string;
          version?: number;
          white_balance_max_deviation?: number;
          white_balance_severe_deviation?: number;
          white_balance_weight?: number;
        };
        Relationships: [];
      };
      rate_limits: {
        Row: {
          counter: number;
          created_at: string;
          endpoint: string;
          expires_at: string;
          id: string;
          updated_at: string;
          user_id: string;
          window_start: string;
        };
        Insert: {
          counter?: number;
          created_at?: string;
          endpoint: string;
          expires_at: string;
          id?: string;
          updated_at?: string;
          user_id: string;
          window_start?: string;
        };
        Update: {
          counter?: number;
          created_at?: string;
          endpoint?: string;
          expires_at?: string;
          id?: string;
          updated_at?: string;
          user_id?: string;
          window_start?: string;
        };
        Relationships: [];
      };
      repeat_offender_records: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          escalation_level: string;
          id: string;
          last_violation_date: string | null;
          manifestly_unfounded_reports: number | null;
          status: string;
          suspension_history: Json | null;
          updated_at: string;
          user_id: string;
          violation_count: number;
          violation_type: string;
        };
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          escalation_level?: string;
          id?: string;
          last_violation_date?: string | null;
          manifestly_unfounded_reports?: number | null;
          status?: string;
          suspension_history?: Json | null;
          updated_at?: string;
          user_id: string;
          violation_count?: number;
          violation_type: string;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          escalation_level?: string;
          id?: string;
          last_violation_date?: string | null;
          manifestly_unfounded_reports?: number | null;
          status?: string;
          suspension_history?: Json | null;
          updated_at?: string;
          user_id?: string;
          violation_count?: number;
          violation_type?: string;
        };
        Relationships: [];
      };
      reports: {
        Row: {
          created_at: string;
          id: string;
          reason: string;
          reporter_id: string;
          status: string;
          target_id: string;
          target_type: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          reason: string;
          reporter_id: string;
          status?: string;
          target_id: string;
          target_type: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          reason?: string;
          reporter_id?: string;
          status?: string;
          target_id?: string;
          target_type?: string;
        };
        Relationships: [];
      };
      reservoir_events: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          delta_ec_25c: number | null;
          delta_ph: number | null;
          id: string;
          kind: string;
          note: string | null;
          reservoir_id: string;
          server_revision: number | null;
          server_updated_at_ms: number | null;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          delta_ec_25c?: number | null;
          delta_ph?: number | null;
          id?: string;
          kind: string;
          note?: string | null;
          reservoir_id: string;
          server_revision?: number | null;
          server_updated_at_ms?: number | null;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          delta_ec_25c?: number | null;
          delta_ph?: number | null;
          id?: string;
          kind?: string;
          note?: string | null;
          reservoir_id?: string;
          server_revision?: number | null;
          server_updated_at_ms?: number | null;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'fk_reservoir_events_reservoir';
            columns: ['reservoir_id'];
            isOneToOne: false;
            referencedRelation: 'reservoirs_v2';
            referencedColumns: ['id'];
          },
        ];
      };
      reservoirs_v2: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          id: string;
          medium: string;
          name: string;
          playbook_binding: string | null;
          ppm_scale: string;
          server_revision: number | null;
          server_updated_at_ms: number | null;
          source_water_profile_id: string | null;
          target_ec_max_25c: number;
          target_ec_min_25c: number;
          target_ph_max: number;
          target_ph_min: number;
          updated_at: string;
          user_id: string | null;
          volume_l: number;
        };
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          medium: string;
          name: string;
          playbook_binding?: string | null;
          ppm_scale: string;
          server_revision?: number | null;
          server_updated_at_ms?: number | null;
          source_water_profile_id?: string | null;
          target_ec_max_25c: number;
          target_ec_min_25c: number;
          target_ph_max: number;
          target_ph_min: number;
          updated_at?: string;
          user_id?: string | null;
          volume_l: number;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          medium?: string;
          name?: string;
          playbook_binding?: string | null;
          ppm_scale?: string;
          server_revision?: number | null;
          server_updated_at_ms?: number | null;
          source_water_profile_id?: string | null;
          target_ec_max_25c?: number;
          target_ec_min_25c?: number;
          target_ph_max?: number;
          target_ph_min?: number;
          updated_at?: string;
          user_id?: string | null;
          volume_l?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'fk_reservoirs_source_water_profile';
            columns: ['source_water_profile_id'];
            isOneToOne: false;
            referencedRelation: 'source_water_profiles_v2';
            referencedColumns: ['id'];
          },
        ];
      };
      security_email_log: {
        Row: {
          email_type: string;
          id: string;
          sent_at: string;
          user_id: string;
        };
        Insert: {
          email_type: string;
          id?: string;
          sent_at?: string;
          user_id: string;
        };
        Update: {
          email_type?: string;
          id?: string;
          sent_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      series: {
        Row: {
          count: number | null;
          created_at: string;
          deleted_at: string | null;
          description: string | null;
          dtstart_local: string;
          dtstart_utc: string;
          id: string;
          plant_id: string | null;
          rrule: string;
          server_revision: number | null;
          server_updated_at_ms: number | null;
          timezone: string;
          title: string;
          until_utc: string | null;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          count?: number | null;
          created_at?: string;
          deleted_at?: string | null;
          description?: string | null;
          dtstart_local: string;
          dtstart_utc: string;
          id?: string;
          plant_id?: string | null;
          rrule: string;
          server_revision?: number | null;
          server_updated_at_ms?: number | null;
          timezone: string;
          title: string;
          until_utc?: string | null;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          count?: number | null;
          created_at?: string;
          deleted_at?: string | null;
          description?: string | null;
          dtstart_local?: string;
          dtstart_utc?: string;
          id?: string;
          plant_id?: string | null;
          rrule?: string;
          server_revision?: number | null;
          server_updated_at_ms?: number | null;
          timezone?: string;
          title?: string;
          until_utc?: string | null;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      sla_alerts: {
        Row: {
          acknowledged: boolean;
          acknowledged_at: string | null;
          acknowledged_by: string | null;
          alert_level: string;
          created_at: string;
          id: string;
          metadata: Json | null;
          notification_channels: Json | null;
          report_id: string;
          supervisor_ids: string[];
          triggered_at: string;
          updated_at: string;
        };
        Insert: {
          acknowledged?: boolean;
          acknowledged_at?: string | null;
          acknowledged_by?: string | null;
          alert_level: string;
          created_at?: string;
          id?: string;
          metadata?: Json | null;
          notification_channels?: Json | null;
          report_id: string;
          supervisor_ids?: string[];
          triggered_at?: string;
          updated_at?: string;
        };
        Update: {
          acknowledged?: boolean;
          acknowledged_at?: string | null;
          acknowledged_by?: string | null;
          alert_level?: string;
          created_at?: string;
          id?: string;
          metadata?: Json | null;
          notification_channels?: Json | null;
          report_id?: string;
          supervisor_ids?: string[];
          triggered_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'sla_alerts_report_id_fkey';
            columns: ['report_id'];
            isOneToOne: false;
            referencedRelation: 'content_reports';
            referencedColumns: ['id'];
          },
        ];
      };
      sla_incidents: {
        Row: {
          breach_duration_hours: number;
          corrective_actions: string[] | null;
          created_at: string;
          escalated_to: string[];
          id: string;
          incident_type: string;
          metadata: Json | null;
          report_id: string;
          resolved_at: string | null;
          root_cause: string | null;
          severity: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          breach_duration_hours: number;
          corrective_actions?: string[] | null;
          created_at?: string;
          escalated_to?: string[];
          id?: string;
          incident_type: string;
          metadata?: Json | null;
          report_id: string;
          resolved_at?: string | null;
          root_cause?: string | null;
          severity: string;
          status: string;
          updated_at?: string;
        };
        Update: {
          breach_duration_hours?: number;
          corrective_actions?: string[] | null;
          created_at?: string;
          escalated_to?: string[];
          id?: string;
          incident_type?: string;
          metadata?: Json | null;
          report_id?: string;
          resolved_at?: string | null;
          root_cause?: string | null;
          severity?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'sla_incidents_report_id_fkey';
            columns: ['report_id'];
            isOneToOne: false;
            referencedRelation: 'content_reports';
            referencedColumns: ['id'];
          },
        ];
      };
      sor_export_queue: {
        Row: {
          attempts: number;
          created_at: string;
          error_message: string | null;
          id: string;
          idempotency_key: string;
          last_attempt: string | null;
          statement_id: string;
          status: string;
          transparency_db_response: string | null;
          updated_at: string;
        };
        Insert: {
          attempts?: number;
          created_at?: string;
          error_message?: string | null;
          id?: string;
          idempotency_key: string;
          last_attempt?: string | null;
          statement_id: string;
          status?: string;
          transparency_db_response?: string | null;
          updated_at?: string;
        };
        Update: {
          attempts?: number;
          created_at?: string;
          error_message?: string | null;
          id?: string;
          idempotency_key?: string;
          last_attempt?: string | null;
          statement_id?: string;
          status?: string;
          transparency_db_response?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'sor_export_queue_statement_id_fkey';
            columns: ['statement_id'];
            isOneToOne: true;
            referencedRelation: 'sor_submission_trail_view';
            referencedColumns: ['statement_id'];
          },
          {
            foreignKeyName: 'sor_export_queue_statement_id_fkey';
            columns: ['statement_id'];
            isOneToOne: true;
            referencedRelation: 'statements_of_reasons';
            referencedColumns: ['id'];
          },
        ];
      };
      source_water_profiles_v2: {
        Row: {
          alkalinity_mg_per_l_caco3: number;
          baseline_ec_25c: number;
          created_at: string;
          deleted_at: string | null;
          hardness_mg_per_l: number;
          id: string;
          last_tested_at: string;
          name: string;
          server_revision: number | null;
          server_updated_at_ms: number | null;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          alkalinity_mg_per_l_caco3: number;
          baseline_ec_25c: number;
          created_at?: string;
          deleted_at?: string | null;
          hardness_mg_per_l: number;
          id?: string;
          last_tested_at: string;
          name: string;
          server_revision?: number | null;
          server_updated_at_ms?: number | null;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          alkalinity_mg_per_l_caco3?: number;
          baseline_ec_25c?: number;
          created_at?: string;
          deleted_at?: string | null;
          hardness_mg_per_l?: number;
          id?: string;
          last_tested_at?: string;
          name?: string;
          server_revision?: number | null;
          server_updated_at_ms?: number | null;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      statements_of_reasons: {
        Row: {
          automated_decision: boolean;
          automated_detection: boolean;
          content_type: string;
          created_at: string;
          decision_ground: string;
          decision_id: string;
          deleted_at: string | null;
          facts_and_circumstances: string;
          id: string;
          legal_reference: string | null;
          redress: string[];
          territorial_scope: string[] | null;
          transparency_db_id: string | null;
          transparency_db_submitted_at: string | null;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          automated_decision: boolean;
          automated_detection: boolean;
          content_type: string;
          created_at?: string;
          decision_ground: string;
          decision_id: string;
          deleted_at?: string | null;
          facts_and_circumstances: string;
          id?: string;
          legal_reference?: string | null;
          redress?: string[];
          territorial_scope?: string[] | null;
          transparency_db_id?: string | null;
          transparency_db_submitted_at?: string | null;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          automated_decision?: boolean;
          automated_detection?: boolean;
          content_type?: string;
          created_at?: string;
          decision_ground?: string;
          decision_id?: string;
          deleted_at?: string | null;
          facts_and_circumstances?: string;
          id?: string;
          legal_reference?: string | null;
          redress?: string[];
          territorial_scope?: string[] | null;
          transparency_db_id?: string | null;
          transparency_db_submitted_at?: string | null;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'statements_of_reasons_decision_id_fkey';
            columns: ['decision_id'];
            isOneToOne: true;
            referencedRelation: 'mod_sor_submission_trail';
            referencedColumns: ['decision_id'];
          },
          {
            foreignKeyName: 'statements_of_reasons_decision_id_fkey';
            columns: ['decision_id'];
            isOneToOne: true;
            referencedRelation: 'moderation_decisions';
            referencedColumns: ['id'];
          },
        ];
      };
      strain_cache: {
        Row: {
          created_at: string;
          data: Json;
          id: string;
          name: string;
          race: string | null;
          slug: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          data: Json;
          id: string;
          name: string;
          race?: string | null;
          slug: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          data?: Json;
          id?: string;
          name?: string;
          race?: string | null;
          slug?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      sync_idempotency: {
        Row: {
          created_at: string;
          id: number;
          idempotency_key: string;
          response_payload: Json | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: number;
          idempotency_key: string;
          response_payload?: Json | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: number;
          idempotency_key?: string;
          response_payload?: Json | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      tasks: {
        Row: {
          completed_at: string | null;
          created_at: string;
          deleted_at: string | null;
          description: string | null;
          due_at_local: string;
          due_at_utc: string;
          id: string;
          metadata: Json;
          plant_id: string | null;
          reminder_at_local: string | null;
          reminder_at_utc: string | null;
          series_id: string | null;
          server_revision: number | null;
          server_updated_at_ms: number | null;
          status: string;
          timezone: string;
          title: string;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          completed_at?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          description?: string | null;
          due_at_local: string;
          due_at_utc: string;
          id?: string;
          metadata?: Json;
          plant_id?: string | null;
          reminder_at_local?: string | null;
          reminder_at_utc?: string | null;
          series_id?: string | null;
          server_revision?: number | null;
          server_updated_at_ms?: number | null;
          status: string;
          timezone: string;
          title: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          completed_at?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          description?: string | null;
          due_at_local?: string;
          due_at_utc?: string;
          id?: string;
          metadata?: Json;
          plant_id?: string | null;
          reminder_at_local?: string | null;
          reminder_at_utc?: string | null;
          series_id?: string | null;
          server_revision?: number | null;
          server_updated_at_ms?: number | null;
          status?: string;
          timezone?: string;
          title?: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'tasks_series_id_fkey';
            columns: ['series_id'];
            isOneToOne: false;
            referencedRelation: 'series';
            referencedColumns: ['id'];
          },
        ];
      };
      template_comments: {
        Row: {
          comment: string;
          created_at: string;
          deleted_at: string | null;
          id: string;
          template_id: string;
          updated_at: string;
          user_handle: string;
          user_id: string;
        };
        Insert: {
          comment: string;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          template_id: string;
          updated_at?: string;
          user_handle: string;
          user_id: string;
        };
        Update: {
          comment?: string;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          template_id?: string;
          updated_at?: string;
          user_handle?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'template_comments_template_id_fkey';
            columns: ['template_id'];
            isOneToOne: false;
            referencedRelation: 'community_playbook_templates';
            referencedColumns: ['id'];
          },
        ];
      };
      template_ratings: {
        Row: {
          created_at: string;
          id: string;
          rating: number;
          review: string | null;
          template_id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          rating: number;
          review?: string | null;
          template_id: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          rating?: number;
          review?: string | null;
          template_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'template_ratings_template_id_fkey';
            columns: ['template_id'];
            isOneToOne: false;
            referencedRelation: 'community_playbook_templates';
            referencedColumns: ['id'];
          },
        ];
      };
      trusted_flaggers: {
        Row: {
          accuracy_rate: number | null;
          average_handling_time_hours: number | null;
          certification_date: string;
          contact_info: Json;
          created_at: string;
          deleted_at: string | null;
          id: string;
          organization_name: string;
          review_date: string;
          specialization: string[];
          status: string;
          total_reports: number | null;
          updated_at: string;
          upheld_decisions: number | null;
          user_id: string | null;
        };
        Insert: {
          accuracy_rate?: number | null;
          average_handling_time_hours?: number | null;
          certification_date: string;
          contact_info: Json;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          organization_name: string;
          review_date: string;
          specialization: string[];
          status?: string;
          total_reports?: number | null;
          updated_at?: string;
          upheld_decisions?: number | null;
          user_id?: string | null;
        };
        Update: {
          accuracy_rate?: number | null;
          average_handling_time_hours?: number | null;
          certification_date?: string;
          contact_info?: Json;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          organization_name?: string;
          review_date?: string;
          specialization?: string[];
          status?: string;
          total_reports?: number | null;
          updated_at?: string;
          upheld_decisions?: number | null;
          user_id?: string | null;
        };
        Relationships: [];
      };
      user_age_status: {
        Row: {
          active_token_id: string | null;
          created_at: string;
          id: string;
          is_age_verified: boolean;
          is_minor: boolean;
          minor_protections_enabled: boolean;
          show_age_restricted_content: boolean;
          updated_at: string;
          user_id: string;
          verified_at: string | null;
        };
        Insert: {
          active_token_id?: string | null;
          created_at?: string;
          id?: string;
          is_age_verified?: boolean;
          is_minor?: boolean;
          minor_protections_enabled?: boolean;
          show_age_restricted_content?: boolean;
          updated_at?: string;
          user_id: string;
          verified_at?: string | null;
        };
        Update: {
          active_token_id?: string | null;
          created_at?: string;
          id?: string;
          is_age_verified?: boolean;
          is_minor?: boolean;
          minor_protections_enabled?: boolean;
          show_age_restricted_content?: boolean;
          updated_at?: string;
          user_id?: string;
          verified_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'user_age_status_active_token_id_fkey';
            columns: ['active_token_id'];
            isOneToOne: false;
            referencedRelation: 'age_verification_tokens';
            referencedColumns: ['id'];
          },
        ];
      };
      user_rate_limits: {
        Row: {
          created_at: string;
          expires_at: string;
          id: string;
          posts_per_hour: number;
          reason_code: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          expires_at: string;
          id?: string;
          posts_per_hour?: number;
          reason_code: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          expires_at?: string;
          id?: string;
          posts_per_hour?: number;
          reason_code?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      user_sessions: {
        Row: {
          app_version: string | null;
          created_at: string;
          device_name: string | null;
          id: string;
          ip_address: string | null;
          last_active_at: string;
          os: string | null;
          revoked_at: string | null;
          session_key: string;
          user_id: string;
        };
        Insert: {
          app_version?: string | null;
          created_at?: string;
          device_name?: string | null;
          id?: string;
          ip_address?: string | null;
          last_active_at?: string;
          os?: string | null;
          revoked_at?: string | null;
          session_key: string;
          user_id: string;
        };
        Update: {
          app_version?: string | null;
          created_at?: string;
          device_name?: string | null;
          id?: string;
          ip_address?: string | null;
          last_active_at?: string;
          os?: string | null;
          revoked_at?: string | null;
          session_key?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      user_shadow_bans: {
        Row: {
          created_at: string;
          expires_at: string;
          id: string;
          reason_code: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          expires_at: string;
          id?: string;
          reason_code: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          expires_at?: string;
          id?: string;
          reason_code?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      user_suspensions: {
        Row: {
          expires_at: string;
          id: string;
          reason_code: string;
          suspended_at: string;
          user_id: string;
        };
        Insert: {
          expires_at: string;
          id?: string;
          reason_code: string;
          suspended_at?: string;
          user_id: string;
        };
        Update: {
          expires_at?: string;
          id?: string;
          reason_code?: string;
          suspended_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      users: {
        Row: {
          created_at: string;
          id: string;
          suspended: boolean;
          suspension_expires_at: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id: string;
          suspended?: boolean;
          suspension_expires_at?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          suspended?: boolean;
          suspension_expires_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      mod_sor_submission_trail: {
        Row: {
          actor_id: string | null;
          audit_event_id: string | null;
          content_id: string | null;
          decision_id: string | null;
          decision_type: string | null;
          event_timestamp: string | null;
          event_type: string | null;
          metadata: Json | null;
          policy_violated: string[] | null;
          signature: string | null;
          sor_sent_at: string | null;
          sor_submitted_to_transparency_db_at: string | null;
          target_id: string | null;
          target_type: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'moderation_decisions_report_id_fkey';
            columns: ['content_id'];
            isOneToOne: false;
            referencedRelation: 'content_reports';
            referencedColumns: ['id'];
          },
        ];
      };
      notification_delivery_failures: {
        Row: {
          created_at: string | null;
          device_token: string | null;
          error_message: string | null;
          id: string | null;
          message_id: string | null;
          platform: string | null;
          type: string | null;
          updated_at: string | null;
          user_id: string | null;
        };
        Insert: {
          created_at?: string | null;
          device_token?: string | null;
          error_message?: string | null;
          id?: string | null;
          message_id?: string | null;
          platform?: string | null;
          type?: string | null;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Update: {
          created_at?: string | null;
          device_token?: string | null;
          error_message?: string | null;
          id?: string | null;
          message_id?: string | null;
          platform?: string | null;
          type?: string | null;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Relationships: [];
      };
      notification_delivery_stats: {
        Row: {
          attempted: number | null;
          date: string | null;
          delivered: number | null;
          delivery_rate_percent: number | null;
          engagement_rate_percent: number | null;
          failed: number | null;
          opened: number | null;
          platform: string | null;
          sent: number | null;
          type: string | null;
        };
        Relationships: [];
      };
      notification_engagement_tracking: {
        Row: {
          message_id: string | null;
          opened_at: string | null;
          platform: string | null;
          sent_at: string | null;
          status: string | null;
          time_to_open_seconds: number | null;
          type: string | null;
          user_id: string | null;
        };
        Insert: {
          message_id?: string | null;
          opened_at?: string | null;
          platform?: string | null;
          sent_at?: string | null;
          status?: string | null;
          time_to_open_seconds?: never;
          type?: string | null;
          user_id?: string | null;
        };
        Update: {
          message_id?: string | null;
          opened_at?: string | null;
          platform?: string | null;
          sent_at?: string | null;
          status?: string | null;
          time_to_open_seconds?: never;
          type?: string | null;
          user_id?: string | null;
        };
        Relationships: [];
      };
      notification_opt_in_rates: {
        Row: {
          notification_type: string | null;
          opt_in_rate_percent: number | null;
          opted_in: number | null;
          opted_out: number | null;
          total_users: number | null;
        };
        Relationships: [];
      };
      sor_submission_trail_view: {
        Row: {
          attempts: number | null;
          created_at: string | null;
          decision_id: string | null;
          payload_hash: string | null;
          statement_id: string | null;
          status: string | null;
          submitted_at: string | null;
          transparency_db_id: string | null;
          updated_at: string | null;
        };
        Insert: {
          attempts?: never;
          created_at?: string | null;
          decision_id?: string | null;
          payload_hash?: never;
          statement_id?: string | null;
          status?: never;
          submitted_at?: string | null;
          transparency_db_id?: string | null;
          updated_at?: string | null;
        };
        Update: {
          attempts?: never;
          created_at?: string | null;
          decision_id?: string | null;
          payload_hash?: never;
          statement_id?: string | null;
          status?: never;
          submitted_at?: string | null;
          transparency_db_id?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'statements_of_reasons_decision_id_fkey';
            columns: ['decision_id'];
            isOneToOne: true;
            referencedRelation: 'mod_sor_submission_trail';
            referencedColumns: ['decision_id'];
          },
          {
            foreignKeyName: 'statements_of_reasons_decision_id_fkey';
            columns: ['decision_id'];
            isOneToOne: true;
            referencedRelation: 'moderation_decisions';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Functions: {
      apply_sync_push: {
        Args: {
          changes: Json;
          last_pulled_at_ms: number;
          p_idempotency_key: string;
        };
        Returns: Json;
      };
      calculate_retention_date: {
        Args: { p_event_type: string; p_timestamp: string };
        Returns: string;
      };
      cancel_deletion_request: {
        Args: { p_user_id: string };
        Returns: boolean;
      };
      check_age_gating_access: {
        Args: {
          p_content_id: string;
          p_content_type: string;
          p_user_id: string;
        };
        Returns: boolean;
      };
      check_and_increment_lockout: {
        Args: { p_email_hash: string };
        Returns: Json;
      };
      check_content_geo_availability: {
        Args: { p_content_id: string; p_user_location: Json };
        Returns: Json;
      };
      check_delivery_rate_threshold: {
        Args: { p_threshold?: number };
        Returns: {
          alert_message: string;
          delivery_rate_percent: number;
          notification_type: string;
        }[];
      };
      check_key_rotation_needed: {
        Args: never;
        Returns: {
          current_version: number;
          days_until_expiry: number;
          expires_at: string;
          needs_rotation: boolean;
        }[];
      };
      check_pending_deletion: {
        Args: { p_user_id: string };
        Returns: {
          days_remaining: number;
          request_id: string;
          requested_at: string;
          scheduled_for: string;
        }[];
      };
      check_sor_delivery_compliance: {
        Args: { p_decision_id: string };
        Returns: {
          decision_created_at: string;
          decision_id: string;
          delivery_time_minutes: number;
          is_compliant: boolean;
          sor_delivered_at: string;
        }[];
      };
      claim_idempotency_key: {
        Args: {
          p_client_tx_id: string;
          p_endpoint: string;
          p_idempotency_key: string;
          p_payload_hash: string;
          p_user_id: string;
        };
        Returns: Json;
      };
      cleanup_expired_age_tokens: { Args: never; Returns: number };
      cleanup_expired_geo_location_cache: { Args: never; Returns: number };
      cleanup_expired_rate_limits: { Args: never; Returns: number };
      cleanup_expired_tombstones: {
        Args: never;
        Returns: {
          deleted_count: number;
          table_name: string;
        }[];
      };
      cleanup_old_audit_logs: { Args: never; Returns: number };
      cleanup_old_security_email_logs: { Args: never; Returns: undefined };
      create_next_audit_partition: { Args: never; Returns: string };
      digest:
        | { Args: { data: string; type: string }; Returns: string }
        | { Args: { data: string; type: string }; Returns: string };
      drop_expired_partition: {
        Args: { p_dry_run?: boolean; p_partition_name: string };
        Returns: Json;
      };
      execute_moderation_action:
        | {
            Args: { p_decision_id: string; p_executed_by: string };
            Returns: Json;
          }
        | {
            Args: {
              p_action: string;
              p_content_id: string;
              p_decision_id: string;
              p_duration_days?: number;
              p_executed_by?: string;
              p_expires_at?: string;
              p_idempotency_key: string;
              p_reason_code: string;
              p_territorial_scope?: string[];
              p_user_id: string;
            };
            Returns: Json;
          };
      generate_audit_signature: {
        Args: {
          p_action: string;
          p_actor_id: string;
          p_event_type: string;
          p_metadata: Json;
          p_target_id: string;
          p_timestamp: string;
        };
        Returns: string;
      };
      generate_partition_checksum: {
        Args: { p_partition_name: string };
        Returns: {
          checksum: string;
          record_count: number;
        }[];
      };
      get_active_key_version: { Args: never; Returns: number };
      get_delivery_rate: {
        Args: { p_days?: number; p_notification_type: string };
        Returns: {
          attempted: number;
          days_analyzed: number;
          delivery_rate_percent: number;
          notification_type: string;
          sent: number;
        }[];
      };
      get_expired_partitions: {
        Args: { p_retention_years?: number; p_table_name?: string };
        Returns: {
          age_in_days: number;
          partition_end_date: string;
          partition_name: string;
          partition_start_date: string;
        }[];
      };
      get_or_create_profile: {
        Args: { p_display_name: string; p_user_id: string };
        Returns: {
          allow_direct_messages: boolean;
          avatar_url: string | null;
          bio: string | null;
          created_at: string;
          display_name: string;
          id: string;
          location: string | null;
          show_profile_to_community: boolean;
          updated_at: string;
          user_id: string;
        };
        SetofOptions: {
          from: '*';
          to: 'profiles';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      get_retention_expiry_date: {
        Args: { p_created_at: string; p_data_category: string };
        Returns: string;
      };
      get_unacknowledged_alerts: {
        Args: { p_moderator_id: string };
        Returns: {
          age_minutes: number;
          alert_type: string;
          created_at: string;
          id: string;
          priority: string;
          report_id: string;
          sla_percentage: number;
        }[];
      };
      has_moderation_role: { Args: never; Returns: boolean };
      has_pending_deletion_request: {
        Args: { p_user_id: string };
        Returns: boolean;
      };
      hash_email: { Args: { p_email: string }; Returns: string };
      increment_rate_limit: {
        Args: {
          p_endpoint: string;
          p_increment?: number;
          p_limit: number;
          p_user_id: string;
          p_window_seconds: number;
        };
        Returns: Json;
      };
      increment_template_adoption: {
        Args: { template_id: string };
        Returns: undefined;
      };
      is_claim_active: { Args: { expires_at: string }; Returns: boolean };
      is_moderator: { Args: never; Returns: boolean };
      is_under_legal_hold: {
        Args: { p_target_id: string; p_target_type: string };
        Returns: boolean;
      };
      is_user_age_verified: { Args: { p_user_id: string }; Returns: boolean };
      log_auth_event: {
        Args: {
          p_event_type: string;
          p_ip_address?: unknown;
          p_metadata?: Json;
          p_user_agent?: string;
          p_user_id: string;
        };
        Returns: string;
      };
      log_lockout_enforcement: {
        Args: { p_action: string; p_email_hash: string; p_metadata?: Json };
        Returns: undefined;
      };
      moderate_content: {
        Args: {
          p_action: string;
          p_content_id: string;
          p_content_type: string;
          p_idempotency_key?: string;
          p_reason?: string;
        };
        Returns: Json;
      };
      perform_sync_pull: { Args: { last_pulled_at_ms: number }; Returns: Json };
      perform_sync_pull_v2: {
        Args: { cursor?: Json; last_pulled_at_ms: number; page_size?: number };
        Returns: Json;
      };
      poll_expo_push_receipts: { Args: never; Returns: undefined };
      posts_with_signed_media_urls: {
        Args: { p_cursor?: string; p_limit?: number };
        Returns: {
          body: string;
          client_tx_id: string;
          created_at: string;
          deleted_at: string;
          hidden_at: string;
          id: string;
          is_age_restricted: boolean;
          media_aspect_ratio: number;
          media_blurhash: string;
          media_bytes: number;
          media_height: number;
          media_resized_uri: string;
          media_thumbhash: string;
          media_thumbnail_uri: string;
          media_uri: string;
          media_width: number;
          moderation_reason: string;
          title: string;
          undo_expires_at: string;
          updated_at: string;
          user_id: string;
        }[];
      };
      process_notification_requests: { Args: never; Returns: undefined };
      reset_lockout_counter: {
        Args: { p_email_hash: string };
        Returns: undefined;
      };
      revoke_encryption_key: {
        Args: { p_metadata?: Json; p_reason: string; p_version: number };
        Returns: undefined;
      };
      rotate_encryption_key: {
        Args: {
          p_metadata?: Json;
          p_new_key_hash: string;
          p_new_version: number;
          p_old_version: number;
        };
        Returns: string;
      };
      run_monthly_partition_maintenance: { Args: never; Returns: Json };
      seal_audit_partition:
        | { Args: { p_partition_name: string }; Returns: string }
        | {
            Args: { p_partition_name: string; p_signing_key_version?: string };
            Returns: string;
          };
      search_help_articles: {
        Args: {
          result_limit?: number;
          search_category?: string;
          search_locale?: string;
          search_query: string;
        };
        Returns: {
          body_markdown: string;
          category: string;
          helpful_count: number;
          id: string;
          locale: string;
          not_helpful_count: number;
          relevance: number;
          tags: string[];
          title: string;
          view_count: number;
        }[];
      };
      soft_delete_comment:
        | {
            Args: { comment_id: string };
            Returns: {
              id: string;
              undo_expires_at: string;
            }[];
          }
        | {
            Args: { comment_id: string; user_id: string };
            Returns: {
              id: string;
              undo_expires_at: string;
            }[];
          };
      sync_pull_tasks_v2: {
        Args: {
          _limit: number;
          last_ts: string;
          tasks_active_cursor_id: string;
          tasks_active_cursor_ts: string;
          tasks_tomb_cursor_id: string;
          tasks_tomb_cursor_ts: string;
        };
        Returns: Json;
      };
      upsert_push_token: {
        Args: {
          p_last_used_at?: string;
          p_platform: string;
          p_token: string;
          p_user_id: string;
        };
        Returns: undefined;
      };
      verify_audit_signature: {
        Args: { p_event_id: string };
        Returns: boolean;
      };
    };
    Enums: {
      dsr_job_status_enum: 'queued' | 'processing' | 'completed' | 'failed';
      dsr_job_type_enum: 'export' | 'delete' | 'withdraw';
      processing_purpose_enum:
        | 'analytics'
        | 'crashReporting'
        | 'personalizedData'
        | 'sessionReplay'
        | 'diagnosis'
        | 'aiDiagnosis'
        | 'aiInference'
        | 'aiTraining';
      quality_platform_enum: 'ios' | 'android' | 'universal';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  'public'
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] &
        DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] &
        DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      dsr_job_status_enum: ['queued', 'processing', 'completed', 'failed'],
      dsr_job_type_enum: ['export', 'delete', 'withdraw'],
      processing_purpose_enum: [
        'analytics',
        'crashReporting',
        'personalizedData',
        'sessionReplay',
        'diagnosis',
        'aiDiagnosis',
        'aiInference',
        'aiTraining',
      ],
      quality_platform_enum: ['ios', 'android', 'universal'],
    },
  },
} as const;
