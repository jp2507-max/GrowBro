/**
 * Playbook Types for Guided Grow Playbooks Feature
 *
 * These types define the structure for playbook templates, generated tasks,
 * and related entities following RFC 5545 RRULE standards and timezone-aware
 * date handling.
 */

export type PlaybookSetup =
  | 'auto_indoor'
  | 'auto_outdoor'
  | 'photo_indoor'
  | 'photo_outdoor';

export type GrowPhase = 'seedling' | 'veg' | 'flower' | 'harvest';

export type TaskType =
  | 'water'
  | 'feed'
  | 'prune'
  | 'train'
  | 'monitor'
  | 'note'
  | 'custom';

/**
 * Playbook Step Template
 * Defines a single step in a playbook that will be converted to concrete tasks
 */
export type PlaybookStep = {
  id: string;
  phase: GrowPhase;
  title: string;
  descriptionIcu: string; // ICU MessageFormat for i18n
  relativeDay: number; // Day offset from phase start
  rrule?: string; // RFC 5545 RRULE pattern (optional for one-time tasks)
  defaultReminderLocal: string; // HH:mm format (e.g., "08:00")
  taskType: TaskType;
  durationDays?: number; // For tasks that span multiple days
  dependencies: string[]; // IDs of steps that must complete first
};

/**
 * Playbook Metadata
 * Additional information about the playbook
 */
export type PlaybookMetadata = {
  author?: string;
  version?: string;
  tags?: string[];
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  estimatedDuration?: number; // Total weeks
  strainTypes?: string[]; // Compatible strain types
};

/**
 * Playbook Template
 * Complete playbook definition stored locally and synced
 */
export type Playbook = {
  id: string;
  name: string;
  setup: PlaybookSetup;
  locale: string; // e.g., "en", "de"
  phaseOrder: GrowPhase[];
  steps: PlaybookStep[];
  metadata: PlaybookMetadata;
  isTemplate: boolean; // True for baseline/community templates
  isCommunity: boolean; // True if shared by community
  authorHandle?: string; // For community templates
  license?: string; // e.g., "CC-BY-SA"
  serverRevision?: number;
  serverUpdatedAtMs?: number;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
};

/**
 * Playbook Task Flags
 * Flags for tracking task customization and bulk operation behavior
 */
export type PlaybookTaskFlags = {
  manualEdited: boolean; // True if user has manually edited this task
  excludeFromBulkShift: boolean; // True to exclude from bulk schedule shifts
};

/**
 * Extended Task Metadata for Playbook Tasks
 * Additional metadata fields for tasks generated from playbooks
 */
export type PlaybookTaskMetadata = {
  playbookId?: string; // ID of the playbook that generated this task
  originStepId?: string; // Immutable ID of the playbook step (for traceability)
  phaseIndex?: number; // Index of the phase (for faster progress queries)
  notificationId?: string; // OS notification ID for cancel/reschedule
  flags?: PlaybookTaskFlags;
  customNotes?: string; // User-added notes
  [key: string]: unknown; // Allow additional metadata
};

/**
 * Playbook Preview
 * Summary information shown before applying a playbook
 */
export type PlaybookPreview = {
  playbookId: string;
  name: string;
  setup: PlaybookSetup;
  totalWeeks: number;
  totalTasks: number;
  phaseBreakdown: {
    phase: GrowPhase;
    durationDays: number;
    taskCount: number;
  }[];
  estimatedStartDate?: string;
  estimatedEndDate?: string;
};

/**
 * Playbook Application Result
 * Result of applying a playbook to a plant
 */
export type PlaybookApplicationResult = {
  appliedTaskCount: number;
  durationMs: number;
  jobId: string;
  playbookId: string;
  plantId: string;
};

/**
 * Schedule Shift Preview
 * Preview of changes before applying a schedule shift
 */
export type ScheduleShiftPreview = {
  shiftId: string;
  plantId: string;
  daysDelta: number;
  affectedTaskCount: number;
  firstNewDate: string | null;
  lastNewDate: string | null;
  collisionWarnings: string[];
  manuallyEditedCount: number;
  phaseBreakdown: {
    phaseIndex: number;
    taskCount: number;
    netDelta: number;
  }[];
};

/**
 * Undo Descriptor
 * Persistent record for 30-second undo functionality
 */
export type UndoDescriptor = {
  id: string;
  operationType: 'schedule_shift';
  affectedTaskIds: string[];
  priorFieldValues: Record<string, unknown>; // Serialized prior state
  timestamp: number;
  expiresAt: number;
};

/**
 * Outbox Notification Action
 * Queued notification operations for atomic scheduling
 */
export type OutboxNotificationAction = {
  id: string;
  actionType: 'schedule' | 'cancel';
  payload: {
    notificationId: string;
    triggerTime?: string;
    channel?: string;
    title?: string;
    body?: string;
    data?: Record<string, unknown>;
  };
  businessKey?: string; // For deduplication
  ttl: number; // Time to live in ms
  expiresAt: number;
  nextAttemptAt: number;
  attemptedCount: number;
  status: 'pending' | 'processing' | 'completed' | 'expired' | 'failed';
  lastError?: string;
  createdAt: string;
  updatedAt: string;
};

/**
 * AI Adjustment Context
 * Context for AI-driven schedule adjustment suggestions
 */
export type AdjustmentContext = {
  plantId: string;
  skippedTaskCount: number;
  assessmentConfidence?: number;
  issueType?: string;
  lastSevenDays: boolean;
};

/**
 * AI Suggestion
 * AI-generated schedule adjustment suggestion
 */
export type AISuggestion = {
  id: string;
  plantId: string;
  suggestionType:
    | 'schedule_adjustment'
    | 'phase_extension'
    | 'task_modification';
  reasoning: string;
  affectedTasks: {
    taskId: string;
    currentDate: string;
    proposedDate: string;
    reason: string;
  }[];
  confidence: number;
  status: 'pending' | 'accepted' | 'declined';
  cooldownUntil?: number;
  createdAt: string;
  expiresAt: string;
};

/**
 * Trichome Assessment
 * User-logged trichome check for harvest timing
 */
export type TrichomeAssessment = {
  id: string;
  plantId: string;
  assessmentDate: string;
  clearPercent?: number;
  milkyPercent?: number;
  amberPercent?: number;
  photos?: string[]; // URIs to assessment photos
  notes?: string;
  harvestWindowSuggestion?: {
    minDays: number;
    maxDays: number;
    targetEffect: 'energetic' | 'balanced' | 'sedating';
  };
  createdAt: string;
};
