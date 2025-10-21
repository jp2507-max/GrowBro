/**
 * TypeScript types for DSA-compliant moderation system
 *
 * Implements types for:
 * - Content Reports (DSA Art. 16)
 * - Moderation Decisions (DSA Art. 17)
 * - Statements of Reasons (DSA Art. 17, Art. 24(5))
 * - Appeals (DSA Art. 20)
 * - Trusted Flaggers (DSA Art. 22)
 * - Repeat Offenders (DSA Art. 23)
 * - Audit Events
 * - Content Snapshots
 *
 * Requirements: 1.5, 6.1
 */

// ============================================================================
// Content Reports (DSA Art. 16)
// ============================================================================

export type ReportType = 'illegal' | 'policy_violation';

export type ReportStatus = 'pending' | 'in_review' | 'resolved' | 'duplicate';

export type ContentType = 'post' | 'comment' | 'image' | 'profile' | 'other';

export type ModerationPriority =
  | 'immediate'
  | 'illegal'
  | 'trusted'
  | 'standard';

export interface ReporterContact {
  name?: string; // Optional for privacy-preserving flows
  email?: string;
  pseudonym?: string; // For anonymous reporting with verification
}

export interface ContentReport {
  id: string;

  // Content identification
  content_id: string;
  content_type: ContentType;
  content_locator: string; // Permalink/deep link
  content_hash: string; // SHA-256 hash

  // Reporter
  reporter_id: string;
  reporter_contact: ReporterContact;
  trusted_flagger: boolean;

  // Report classification (DSA Art. 16 two-track)
  report_type: ReportType;
  jurisdiction?: string; // Required for 'illegal' reports
  legal_reference?: string; // e.g., 'DE StGB §130'

  // DSA Art. 16 mandatory fields
  explanation: string; // Sufficiently substantiated
  good_faith_declaration: boolean;
  evidence_urls?: string[];

  // Processing
  status: ReportStatus;
  priority: number; // 0-100
  sla_deadline: Date;

  // Associated snapshot
  content_snapshot_id?: string;

  // Duplicate handling
  duplicate_of_report_id?: string;

  // Metadata
  user_id?: string;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
}

export interface ContentReportInput {
  content_id: string;
  content_type: ContentType;
  content_locator: string;
  report_type: ReportType;
  jurisdiction?: string;
  legal_reference?: string;
  explanation: string;
  reporter_contact: ReporterContact;
  good_faith_declaration: boolean;
  evidence_urls?: string[];
  content?: string; // Optional pre-fetched content string for hash generation
  content_hash?: string; // Optional pre-computed content hash
}

export interface ReportSubmissionResult {
  success: boolean;
  report_id?: string;
  error?: string;
  duplicate_of?: string;
}

// ============================================================================
// Moderation Decisions
// ============================================================================

export type ModerationAction =
  | 'no_action'
  | 'quarantine'
  | 'geo_block'
  | 'remove'
  | 'suspend_user'
  | 'rate_limit'
  | 'shadow_ban';

export type DecisionStatus = 'pending' | 'approved' | 'executed' | 'reversed';

export interface ModerationDecision {
  id: string;

  // Report reference
  report_id: string;

  // Decision maker
  moderator_id: string;
  supervisor_id?: string;

  // Action
  action: ModerationAction;

  // Policy and reasoning
  policy_violations: string[]; // Policy catalog entry IDs
  reasoning: string;
  evidence: string[];

  // Statement of Reasons
  statement_of_reasons_id?: string;

  // Status
  status: DecisionStatus;
  requires_supervisor_approval: boolean;

  // Execution tracking
  executed_at?: Date;
  reversed_at?: Date;
  reversal_reason?: string;

  // Metadata
  user_id?: string;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
}

export interface ModerationDecisionInput {
  report_id: string;
  moderator_id: string;
  action: ModerationAction;
  policy_violations: string[];
  reasoning: string;
  evidence?: string[];
  requires_supervisor_approval?: boolean;
  metadata?: {
    duration?:
      | {
          value: number;
          unit: string;
        }
      | string; // ISO duration string or structured duration
    territorial_scope?: string | string[]; // Single territory or array of territories
  };
}

export interface DecisionResult {
  success: boolean;
  decision_id?: string;
  statement_of_reasons_id?: string;
  error?: string;
}

// ============================================================================
// Statements of Reasons (DSA Art. 17 & 24(5))
// ============================================================================

export type DecisionGround = 'illegal' | 'terms';

export type RedressOption = 'internal_appeal' | 'ods' | 'court';

export interface StatementOfReasons {
  id: string;

  // Decision reference
  decision_id: string;

  // DSA Art. 17 required fields
  decision_ground: DecisionGround;
  legal_reference?: string; // Required if decision_ground = 'illegal'
  content_type: ContentType;
  facts_and_circumstances: string;

  // Automation disclosure (DSA Art. 17(3)(c))
  automated_detection: boolean;
  automated_decision: boolean;

  // Territorial scope
  territorial_scope?: string[]; // e.g., ['DE', 'AT']

  // Redress options
  redress: RedressOption[];

  // Commission Transparency Database (Art. 24(5))
  transparency_db_id?: string;
  transparency_db_submitted_at?: Date;

  // Metadata
  user_id?: string;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
}

export interface RedactedSoR {
  // Preserved non-PII fields
  decision_id: string;
  decision_ground: DecisionGround;
  legal_reference?: string;
  content_type: ContentType;
  automated_detection: boolean;
  automated_decision: boolean;
  territorial_scope?: string[];
  redress: RedressOption[];
  transparency_db_id?: string;
  created_at: Date;

  // Aggregated/anonymized data
  aggregated_data: {
    report_count: number | 'suppressed';
    evidence_type: 'text' | 'image' | 'video' | 'mixed';
    content_age: 'new' | 'recent' | 'archived';
    jurisdiction_count: number | 'suppressed';
    has_trusted_flagger: boolean;
  };

  // Pseudonymized identifiers
  pseudonymized_reporter_id: string;
  pseudonymized_moderator_id: string;
  pseudonymized_decision_id: string;

  // Scrubbing metadata
  scrubbing_metadata: {
    scrubbed_at: Date;
    scrubbing_version: string;
    redacted_fields: string[];
    environment_salt_version: string;
    aggregation_suppression: {
      report_count: boolean;
      jurisdiction_count: boolean;
      k: number;
    };
  };
}

// ============================================================================
// Appeals (DSA Art. 20 Internal Complaint-Handling)
// ============================================================================

export type AppealType =
  | 'content_removal'
  | 'account_action'
  | 'geo_restriction';

export type AppealStatus =
  | 'pending'
  | 'in_review'
  | 'resolved'
  | 'escalated_to_ods';

export type AppealDecision = 'upheld' | 'rejected' | 'partial';

export interface Appeal {
  id: string;

  // Original decision
  original_decision_id: string;

  // Appellant
  user_id: string;

  // Appeal details
  appeal_type: AppealType;
  counter_arguments: string;
  supporting_evidence: string[];

  // Review
  reviewer_id?: string;

  // Decision
  decision?: AppealDecision;
  decision_reasoning?: string;

  // Status
  status: AppealStatus;

  // Deadlines (DSA Art. 20: ≥7 days)
  submitted_at: Date;
  deadline: Date;
  resolved_at?: Date;

  // ODS escalation (DSA Art. 21)
  ods_escalation_id?: string;
  ods_body_name?: string;
  ods_submitted_at?: Date;
  ods_resolved_at?: Date;

  // Metadata
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
}

export interface AppealInput {
  original_decision_id: string;
  user_id: string;
  appeal_type: AppealType;
  counter_arguments: string;
  supporting_evidence?: string[];
}

export interface AppealSubmissionResult {
  success: boolean;
  appeal_id?: string;
  deadline?: Date;
  error?: string;
}

// ============================================================================
// Trusted Flaggers (DSA Art. 22)
// ============================================================================

export type TrustedFlaggerStatus = 'active' | 'suspended' | 'revoked';

export interface ContactInfo {
  email: string;
  phone?: string;
  address?: string;
}

export interface QualityMetrics {
  accuracy_rate?: number; // Percentage
  average_handling_time_hours?: number;
  total_reports: number;
  upheld_decisions: number;
}

export interface TrustedFlagger {
  id: string;

  // Organization
  organization_name: string;
  contact_info: ContactInfo;
  specialization: string[]; // e.g., ['terrorism', 'csam', 'hate_speech']

  // Status
  status: TrustedFlaggerStatus;

  // Quality metrics (for Art. 22 periodic review)
  quality_metrics: QualityMetrics;

  // Certification
  certification_date: Date;
  review_date: Date; // Next periodic review

  // Metadata
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
}

// ============================================================================
// Repeat Offender Records (DSA Art. 23)
// ============================================================================

export type EscalationLevel =
  | 'warning'
  | 'temporary_suspension'
  | 'permanent_ban';

export type OffenderStatus = 'active' | 'suspended' | 'banned';

export interface SuspensionRecord {
  start: Date;
  end?: Date;
  reason: string;
  duration_days?: number;
}

export interface RepeatOffenderRecord {
  id: string;

  // User tracking
  user_id: string;

  // Violation tracking
  violation_type: string;
  violation_count: number;

  // Escalation level (Art. 23 graduated enforcement)
  escalation_level: EscalationLevel;

  // History
  last_violation_date?: Date;
  suspension_history: SuspensionRecord[];

  // Manifestly unfounded reporter tracking (Art. 23)
  manifestly_unfounded_reports: number;

  // Status
  status: OffenderStatus;

  // Metadata
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
}

// ============================================================================
// Content Snapshots
// ============================================================================

export interface ContentSnapshot {
  id: string;

  // Content identification
  content_id: string;
  content_type: ContentType;

  // Snapshot data (immutable)
  snapshot_hash: string; // SHA-256
  snapshot_data: Record<string, any>; // Complete content state

  // Capture metadata
  captured_at: Date;
  captured_by_report_id?: string;

  // Storage reference
  storage_path?: string;

  // Metadata
  created_at: Date;
}

// ============================================================================
// SoR Export Queue (DSA Art. 24(5))
// ============================================================================

export type SoRExportStatus =
  | 'pending'
  | 'retry'
  | 'submitted'
  | 'failed'
  | 'dlq';

export interface SoRExportQueue {
  id: string;

  // Statement reference (idempotency by statement_id)
  statement_id: string;

  // Idempotency key
  idempotency_key: string;

  // Queue status
  status: SoRExportStatus;

  // Retry tracking
  attempts: number;
  last_attempt?: Date;

  // Response tracking
  transparency_db_response?: string;
  error_message?: string;

  // Metadata
  created_at: Date;
  updated_at: Date;
}

// ============================================================================
// Audit Events
// ============================================================================

export type ActorType = 'user' | 'moderator' | 'system';

export type AuditEventType =
  | 'report_submitted'
  | 'decision_made'
  | 'appeal_filed'
  | 'sor_submitted'
  | 'partition_sealed'
  | 'signature_verified'
  | 'audit_integrity_check'
  | 'legal_hold_applied'
  | 'court_order_received';

export interface AuditEvent {
  id: string;

  // Event classification
  event_type: AuditEventType;

  // Actor and target
  actor_id: string;
  actor_type: ActorType;
  target_id: string;
  target_type: string;

  // Action details
  action: string;
  metadata: Record<string, any>;

  // Timestamp (immutable)
  timestamp: Date;

  // Cryptographic signature (HMAC-SHA256)
  signature: string;

  // GDPR data minimization
  pii_tagged: boolean;
  retention_until: Date;

  // Metadata
  created_at: Date;
}

export interface AuditEventInput {
  event_type: AuditEventType;
  actor_id: string;
  actor_type: ActorType;
  target_id: string;
  target_type: string;
  action: string;
  metadata?: Record<string, any>;
  pii_tagged?: boolean;
}

// ============================================================================
// Partition Manifests
// ============================================================================

export type VerificationStatus = 'valid' | 'tampered' | 'pending' | 'deleted';

export interface PartitionManifest {
  id: string;

  // Partition identification
  table_name: string;
  partition_name: string;
  partition_start_date: Date;
  partition_end_date: Date;

  // Checksum and signature
  record_count: number;
  checksum: string; // SHA-256
  manifest_signature: string; // HMAC-SHA256

  // Verification
  last_verified_at?: Date;
  verification_status?: VerificationStatus;

  // Metadata
  created_at: Date;
  updated_at: Date;
}

// ============================================================================
// Service Response Types
// ============================================================================

export interface ReportStatusInfo {
  report_id: string;
  status: ReportStatus;
  sla_deadline: Date;
  current_priority: number;
}

export interface ValidationResult {
  is_valid: boolean;
  errors: string[];
}

export interface IntegrityResult {
  is_valid: boolean;
  event_id: string;
  expected_signature: string;
  actual_signature: string;
  error?: string;
}

// ============================================================================
// Queue and Dashboard Types
// ============================================================================

export interface ModerationQueueItem {
  report: ContentReport;
  content_snapshot?: ContentSnapshot;
  reporter_history?: {
    total_reports: number;
    trusted_flagger: boolean;
    accuracy_rate?: number;
  };
  similar_decisions?: {
    decision_id: string;
    action: ModerationAction;
    policy_violations: string[];
    created_at: Date;
  }[];
}

export interface ModerationQueue {
  items: ModerationQueueItem[];
  total_count: number;
  pending_count: number;
  overdue_count: number;
  average_age_hours: number;
}

export interface QueueFilters {
  status?: ReportStatus[];
  priority_min?: number;
  report_type?: ReportType[];
  trusted_flagger?: boolean;
  overdue_only?: boolean;
}

// ============================================================================
// SLA Monitoring Types
// ============================================================================

export type SLAStatus = 'green' | 'yellow' | 'orange' | 'red' | 'critical';

export interface SLAMetrics {
  total_reports: number;
  within_sla: number;
  approaching_sla: number; // 75-90% threshold
  breached_sla: number;
  average_response_time_hours: number;
  false_positive_rate?: number;
  appeal_reversal_rate?: number;
}

export interface SLAAlert {
  report_id: string;
  alert_type:
    | 'sla_warning_75_percent'
    | 'sla_warning_90_percent'
    | 'sla_breached';
  sla_deadline: Date;
  time_remaining_minutes: number;
}

// ============================================================================
// Moderator Console Types
// ============================================================================

export type ModeratorRole =
  | 'moderator'
  | 'senior_moderator'
  | 'supervisor'
  | 'admin';

export interface ModeratorPermissions {
  canReviewReports: boolean;
  canMakeDecisions: boolean;
  canApproveSupervisorRequired: boolean;
  canManageTrustedFlaggers: boolean;
  canAccessAnalytics: boolean;
  canExportData: boolean;
  canManagePolicyCatalog: boolean;
}

export interface ModeratorSession {
  moderator_id: string;
  email: string;
  role: ModeratorRole;
  permissions: ModeratorPermissions;
  current_claims: string[]; // Report IDs currently claimed
  session_started_at: Date;
  last_activity_at: Date;
}

export interface ClaimResult {
  success: boolean;
  report_id: string;
  claimed_by?: string;
  claim_expires_at?: Date;
  error?: string;
  conflict_of_interest?: ConflictOfInterest;
}

export interface ConflictOfInterest {
  has_conflict: boolean;
  reasons: string[];
  conflict_type?: 'previous_decision' | 'relationship' | 'bias_indicator';
  related_decision_ids?: string[];
}

export interface QueuedReport extends ContentReport {
  report_age_ms: number;
  sla_status: SLAStatus;
  claimed_by?: string;
  claimed_at?: Date;
  claim_expires_at?: Date;
  content_snapshot?: ContentSnapshot;
  policy_links: string[];
  similar_decisions: PriorDecision[];
}

export interface PriorDecision {
  id: string;
  content_id: string;
  category: string;
  action: ModerationAction;
  reason_code: string;
  decided_at: Date;
  moderator_id: string;
  outcome: 'upheld' | 'reversed' | 'appealed';
  similarity: number; // 0-1 score
}

export interface SoRPreview {
  user_facing: StatementOfReasons;
  redacted: RedactedSoR;
  diff: RedactionDiff;
  validation_status: {
    no_pii_detected: boolean;
    errors: string[];
    warnings: string[];
  };
}

export interface RedactionDiff {
  user_facing_fields: string[];
  redacted_fields: string[];
  preserved_fields: string[];
  aggregated_fields: string[];
  pseudonymized_fields: string[];
}

export interface TrustedFlaggerMetrics {
  flagger_id: string;
  flagger_name: string;
  accuracy_rate: number; // 0-1
  false_positive_rate: number; // 0-1
  average_response_time_ms: number;
  report_volume: {
    total: number;
    this_week: number;
    this_month: number;
  };
  quality_trend: 'improving' | 'stable' | 'degrading';
  last_reviewed_at: Date;
  status: 'active' | 'warning' | 'suspended';
}

export interface TrustedFlaggerAnalytics {
  total_flaggers: number;
  active_flaggers: number;
  flaggers: TrustedFlaggerMetrics[];
  aggregate_metrics: {
    average_accuracy: number;
    average_response_time_ms: number;
    total_reports_this_month: number;
  };
}

export interface PolicyCatalogEntry {
  id: string;
  category: string;
  title: string;
  description: string;
  legal_basis?: string;
  terms_reference?: string;
  evidence_guidelines: string[];
  example_violations: string[];
  jurisdictional_mapping: Record<string, string>; // ISO code -> local law reference
  last_updated_at: Date;
  version: string;
}

export interface QueueActionEvent {
  event_type: 'claim' | 'release' | 'decide' | 'escalate';
  report_id: string;
  moderator_id: string;
  timestamp: Date;
  metadata: Record<string, unknown>;
}
