import { storage, SUPPORT_STORAGE_KEYS } from '@/lib/storage';

const THROTTLE_DAYS = 30;
const THROTTLE_MS = THROTTLE_DAYS * 24 * 60 * 60 * 1000;

// Apple limits: 3 prompts per 365 days per app
const APPLE_MAX_PROMPTS = 3;
const APPLE_PERIOD_DAYS = 365;
const APPLE_PERIOD_MS = APPLE_PERIOD_DAYS * 24 * 60 * 60 * 1000;

interface RatingHistory {
  promptCount: number;
  lastPromptTimestamp: number;
  optedOut: boolean;
  prompts: {
    timestamp: number;
    trigger: string;
  }[];
}

/**
 * Check if rating prompt should be shown
 */
export function shouldShowRatingPrompt(_trigger: string): boolean {
  'worklet';
  // Check opt-out
  if (isOptedOut()) {
    return false;
  }

  // Check throttle
  if (!isThrottleExpired()) {
    return false;
  }

  // Check Apple quota
  if (!hasAppleQuota()) {
    return false;
  }

  return true;
}

/**
 * Check if user opted out of rating prompts
 */
export function isOptedOut(): boolean {
  'worklet';
  const optOut = storage.getBoolean(SUPPORT_STORAGE_KEYS.RATING_OPT_OUT);
  return optOut === true;
}

/**
 * Set opt-out preference
 */
export function setOptOut(optOut: boolean): void {
  storage.set(SUPPORT_STORAGE_KEYS.RATING_OPT_OUT, optOut);
}

/**
 * Check if throttle period has expired
 */
function isThrottleExpired(): boolean {
  'worklet';
  const lastPrompt = storage.getNumber(SUPPORT_STORAGE_KEYS.RATING_LAST_PROMPT);

  if (!lastPrompt) {
    return true;
  }

  const elapsed = Date.now() - lastPrompt;
  return elapsed >= THROTTLE_MS;
}

/**
 * Check if Apple quota allows showing prompt
 */
function hasAppleQuota(): boolean {
  'worklet';
  const historyJson = storage.getString(SUPPORT_STORAGE_KEYS.RATING_HISTORY);

  if (!historyJson) {
    return true;
  }

  try {
    const history: RatingHistory = JSON.parse(historyJson);
    const cutoffTime = Date.now() - APPLE_PERIOD_MS;

    // Count prompts in last 365 days
    const recentPrompts = history.prompts.filter(
      (p) => p.timestamp > cutoffTime
    );

    return recentPrompts.length < APPLE_MAX_PROMPTS;
  } catch {
    return true;
  }
}

/**
 * Record that a prompt was shown
 */
export function recordPromptShown(trigger: string): void {
  const historyJson = storage.getString(SUPPORT_STORAGE_KEYS.RATING_HISTORY);
  let history: RatingHistory;

  if (historyJson) {
    try {
      history = JSON.parse(historyJson);
    } catch {
      history = createEmptyHistory();
    }
  } else {
    history = createEmptyHistory();
  }

  const now = Date.now();

  // Add new prompt
  history.prompts.push({
    timestamp: now,
    trigger,
  });

  history.promptCount++;
  history.lastPromptTimestamp = now;

  // Clean up old prompts (older than Apple period)
  const cutoffTime = now - APPLE_PERIOD_MS;
  history.prompts = history.prompts.filter((p) => p.timestamp > cutoffTime);

  // Update storage
  storage.set(SUPPORT_STORAGE_KEYS.RATING_HISTORY, JSON.stringify(history));
  storage.set(SUPPORT_STORAGE_KEYS.RATING_LAST_PROMPT, now);
}

/**
 * Get time until next eligible prompt
 */
export function getTimeUntilNextPrompt(): number {
  const lastPrompt = storage.getNumber(SUPPORT_STORAGE_KEYS.RATING_LAST_PROMPT);

  if (!lastPrompt) {
    return 0;
  }

  const elapsed = Date.now() - lastPrompt;
  const remaining = THROTTLE_MS - elapsed;

  return Math.max(0, remaining);
}

/**
 * Get remaining Apple quota
 */
export function getRemainingAppleQuota(): number {
  const historyJson = storage.getString(SUPPORT_STORAGE_KEYS.RATING_HISTORY);

  if (!historyJson) {
    return APPLE_MAX_PROMPTS;
  }

  try {
    const history: RatingHistory = JSON.parse(historyJson);
    const cutoffTime = Date.now() - APPLE_PERIOD_MS;

    const recentPrompts = history.prompts.filter(
      (p) => p.timestamp > cutoffTime
    );

    return Math.max(0, APPLE_MAX_PROMPTS - recentPrompts.length);
  } catch {
    return APPLE_MAX_PROMPTS;
  }
}

/**
 * Clear rating history (for testing)
 */
export function clearRatingHistory(): void {
  storage.delete(SUPPORT_STORAGE_KEYS.RATING_HISTORY);
  storage.delete(SUPPORT_STORAGE_KEYS.RATING_LAST_PROMPT);
}

/**
 * Create empty rating history
 */
function createEmptyHistory(): RatingHistory {
  return {
    promptCount: 0,
    lastPromptTimestamp: 0,
    optedOut: false,
    prompts: [],
  };
}

/**
 * Format time remaining for display
 */
export function formatTimeRemaining(ms: number): string {
  const days = Math.ceil(ms / (24 * 60 * 60 * 1000));

  if (days === 0) {
    return 'now';
  } else if (days === 1) {
    return '1 day';
  } else {
    return `${days} days`;
  }
}
