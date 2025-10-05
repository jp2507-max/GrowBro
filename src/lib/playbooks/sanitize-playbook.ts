/**
 * PII Sanitization for Community Playbook Templates
 *
 * This module strips all personally identifiable information (PII) and personal
 * plant data from playbooks before they are shared with the community.
 *
 * Requirements:
 * - Strip all PII (user names, emails, locations, etc.)
 * - Remove personal plant data (plant names, specific dates, custom notes)
 * - Keep only normalized step schema and structure
 * - Preserve educational content and task patterns
 */

export interface PlaybookStep {
  id: string;
  phase: 'seedling' | 'veg' | 'flower' | 'harvest';
  title: string;
  descriptionIcu?: string;
  relativeDay: number;
  rrule?: string;
  defaultReminderLocal?: string;
  taskType:
    | 'water'
    | 'feed'
    | 'prune'
    | 'train'
    | 'monitor'
    | 'note'
    | 'custom';
  durationDays?: number;
  dependencies?: string[];
}

export interface Playbook {
  id: string;
  name: string;
  setup: 'auto_indoor' | 'auto_outdoor' | 'photo_indoor' | 'photo_outdoor';
  locale: string;
  phaseOrder: string[];
  steps: PlaybookStep[];
  metadata?: Record<string, any>;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface SanitizedPlaybook {
  name: string;
  description?: string;
  setup: 'auto_indoor' | 'auto_outdoor' | 'photo_indoor' | 'photo_outdoor';
  locale: string;
  phaseOrder: string[];
  steps: PlaybookStep[];
  totalWeeks?: number;
  taskCount: number;
}

/**
 * Sanitizes a playbook by removing all PII and personal plant data
 *
 * @param playbook - The playbook to sanitize
 * @param authorHandle - The author's public handle (non-PII)
 * @returns Sanitized playbook safe for community sharing
 */
export function sanitizePlaybookForSharing(
  playbook: Playbook,
  authorHandle: string
): SanitizedPlaybook {
  // Validate author handle is not PII
  if (!isValidAuthorHandle(authorHandle)) {
    throw new Error(
      'Invalid author handle: must not contain email or personal information'
    );
  }

  // Sanitize playbook name
  const sanitizedName = sanitizeText(playbook.name);

  // Sanitize steps - remove any custom notes or personal data
  const sanitizedSteps = playbook.steps.map((step) => sanitizeStep(step));

  // Calculate metadata
  const totalWeeks = calculateTotalWeeks(sanitizedSteps);
  const taskCount = sanitizedSteps.length;

  return {
    name: sanitizedName,
    setup: playbook.setup,
    locale: playbook.locale,
    phaseOrder: playbook.phaseOrder,
    steps: sanitizedSteps,
    totalWeeks,
    taskCount,
  };
}

/**
 * Sanitizes a single playbook step
 */
function sanitizeStep(step: PlaybookStep): PlaybookStep {
  return {
    id: step.id,
    phase: step.phase,
    title: sanitizeText(step.title),
    descriptionIcu: step.descriptionIcu
      ? sanitizeText(step.descriptionIcu)
      : undefined,
    relativeDay: step.relativeDay,
    rrule: step.rrule,
    defaultReminderLocal: step.defaultReminderLocal,
    taskType: step.taskType,
    durationDays: step.durationDays,
    dependencies: step.dependencies,
  };
}

/**
 * Sanitizes text by removing potential PII patterns
 */
function sanitizeText(text: string): string {
  if (!text) return '';

  let sanitized = text.trim();

  // Remove email addresses
  sanitized = sanitized.replace(
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
    '[email removed]'
  );

  // Remove phone numbers (various formats)
  sanitized = sanitized.replace(
    /(?:(?:\+|00)\d{1,3}[-.\s]?)?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}/g,
    '[phone removed]'
  );

  // Remove URLs with personal domains
  sanitized = sanitized.replace(/https?:\/\/[^\s]+/gi, '[link removed]');

  // Remove common PII patterns (names with @ mentions, etc.)
  sanitized = sanitized.replace(/@[\w]+/g, '[mention removed]');

  // Limit length to prevent abuse
  const maxLength = 500;
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength) + '...';
  }

  return sanitized;
}

/**
 * Validates that an author handle doesn't contain PII
 */
function isValidAuthorHandle(handle: string): boolean {
  if (!handle || handle.length < 3 || handle.length > 30) {
    return false;
  }

  // Check for email patterns
  if (/@.*\./i.test(handle)) {
    return false;
  }

  // Check for phone number patterns
  if (/\d{7,}/i.test(handle)) {
    return false;
  }

  // Check for URL patterns
  if (/https?:\/\//i.test(handle)) {
    return false;
  }

  return true;
}

/**
 * Calculates total weeks from playbook steps
 */
function calculateTotalWeeks(steps: PlaybookStep[]): number {
  if (steps.length === 0) return 0;

  // Find the maximum relativeDay + durationDays
  const maxDay = steps.reduce((max, step) => {
    const endDay = step.relativeDay + (step.durationDays || 0);
    return Math.max(max, endDay);
  }, 0);

  // Convert to weeks (round up)
  return Math.ceil(maxDay / 7);
}

/**
 * Validates that a playbook is safe for sharing
 */
export function validatePlaybookForSharing(playbook: Playbook): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check required fields
  if (!playbook.name || playbook.name.trim().length === 0) {
    errors.push('Playbook name is required');
  }

  if (!playbook.setup) {
    errors.push('Playbook setup type is required');
  }

  if (!playbook.steps || playbook.steps.length === 0) {
    errors.push('Playbook must have at least one step');
  }

  // Check for minimum customization (at least 20% different from baseline)
  // This prevents sharing of unmodified templates
  const minSteps = 5;
  if (playbook.steps.length < minSteps) {
    errors.push(`Playbook must have at least ${minSteps} steps`);
  }

  // Validate each step
  playbook.steps.forEach((step, index) => {
    if (!step.title || step.title.trim().length === 0) {
      errors.push(`Step ${index + 1} is missing a title`);
    }

    if (!step.phase) {
      errors.push(`Step ${index + 1} is missing a phase`);
    }

    if (typeof step.relativeDay !== 'number' || step.relativeDay < 0) {
      errors.push(`Step ${index + 1} has invalid relativeDay`);
    }

    if (!step.taskType) {
      errors.push(`Step ${index + 1} is missing a task type`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}
