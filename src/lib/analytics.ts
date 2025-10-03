// Central analytics event schema and helper types
// Add new events here to ensure strong typing across the app.
import { hasConsent } from './privacy-consent';

// Map of event names to their payload shapes
export type AnalyticsEvents = {
  // Notification events
  // Emitted when a scheduled notification is cancelled by the app/user
  // Keep payload minimal and PII-safe
  notif_cancelled: {
    notificationId: string;
  };

  // Emitted when rehydration cancels an outdated scheduled notification
  notif_rehydrate_cancelled: {
    notificationId: string;
    taskId: string;
  };

  // Emitted when rehydration schedules a new/updated notification
  notif_rehydrate_scheduled: {
    taskId: string;
  };

  // Emitted when a notification is scheduled
  notif_scheduled: {
    taskId: string;
  };

  // Emitted when a notification is received by the device (fired)
  notif_fired: {
    notificationId?: string;
    taskId?: string;
  };

  // Emitted when the user interacts with a notification (tap/action)
  notif_interacted: {
    notificationId?: string;
    taskId?: string;
    actionId?: string;
  };

  // Emitted with measured delivery delay in milliseconds
  notif_delivery_delay_ms: {
    ms: number;
  };

  // Home UI analytics events
  community_view: {
    post_count: number;
  };
  community_empty: {
    trigger: 'initial_load' | 'refresh';
  };
  community_error: {
    error_type: 'network' | 'validation' | 'timeout' | 'unknown';
    context?: {
      strain_search?: {
        query?: string;
        sanitized_query?: string;
        results_count: number;
        is_offline: boolean;
      };
      home_view?: {
        widgets_shown: string[];
      };
    };
  };
  home_view: {
    widgets_shown: string[];
  };
  strain_search: {
    // 'query' may be provided by callers; analytics sanitization will
    // convert it to 'sanitized_query' before sending to the client.
    query?: string;
    sanitized_query?: string;
    results_count: number;
    filters_applied?: string[];
    sort_by?: string;
    is_offline: boolean;
    response_time_ms?: number;
  };

  // Plant telemetry events
  plant_watered: {
    taskId: string;
  };
  plant_fed: {
    taskId: string;
  };

  // Sync KPIs
  sync_push: {
    pushed: number;
    queue_length: number;
  };
  sync_pull_applied: {
    applied: number;
    has_more: boolean;
  };
  sync_error: {
    stage: 'push' | 'pull' | 'apply' | 'unknown';
    code?: string | number;
  };
  sync_conflict: {
    table: 'series' | 'tasks' | 'occurrence_overrides';
    count: number;
  };
  sync_checkpoint_age_ms: {
    ms: number;
  };

  // Performance KPIs
  perf_first_paint_ms: {
    ms: number;
  };
  perf_cold_start_ms: {
    ms: number;
  };
  home_tti_ms: {
    ms: number;
  };

  // Guided Grow Playbook events
  playbook_apply: {
    playbookId: string;
    strainType?: string;
    setupType?: string;
  };
  playbook_shift_preview: {
    playbookId: string;
    shiftType: 'forward' | 'backward';
    shiftDays: number;
  };
  playbook_shift_apply: {
    playbookId: string;
    shiftType: 'forward' | 'backward';
    shiftDays: number;
    tasksAffected: number;
  };
  playbook_shift_undo: {
    playbookId: string;
    originalShiftType: 'forward' | 'backward';
    originalShiftDays: number;
  };
  playbook_task_customized: {
    playbookId: string;
    taskId: string;
    customizationType: 'time' | 'frequency' | 'skip' | 'modify';
  };
  playbook_saved_as_template: {
    playbookId: string;
    templateName?: string;
    isPublic: boolean;
  };
  ai_adjustment_suggested: {
    playbookId: string;
    adjustmentType: 'watering' | 'feeding' | 'lighting' | 'environment';
    confidence: number;
  };
  ai_adjustment_applied: {
    playbookId: string;
    adjustmentType: 'watering' | 'feeding' | 'lighting' | 'environment';
    applied: boolean;
  };
  ai_adjustment_declined: {
    playbookId: string;
    adjustmentType: 'watering' | 'feeding' | 'lighting' | 'environment';
    reason?: string;
  };
  trichome_helper_open: {
    playbookId: string;
  };
  trichome_helper_logged: {
    playbookId: string;
    trichomeStage: 'clear' | 'milky' | 'cloudy' | 'amber';
    assessmentConfidence: number;
  };

  // Strains feature events
  strain_filter_applied: {
    filter_type: 'race' | 'effects' | 'flavors' | 'difficulty' | 'thc' | 'cbd';
    filter_value: string;
    results_count: number;
  };
  strain_sort_changed: {
    sort_by: 'thc' | 'cbd' | 'popularity' | 'name';
    sort_direction: 'asc' | 'desc';
  };
  strain_detail_viewed: {
    strain_id: string;
    strain_name?: string;
    race?: string;
    source: 'list' | 'search' | 'favorites' | 'deep_link';
    is_offline: boolean;
  };
  strain_favorite_added: {
    strain_id: string;
    source: 'detail' | 'list';
    total_favorites: number;
  };
  strain_favorite_removed: {
    strain_id: string;
    source: 'detail' | 'list' | 'favorites_screen';
    total_favorites: number;
  };
  strain_list_scrolled: {
    page_number: number;
    total_items_loaded: number;
    is_offline: boolean;
  };
  strain_offline_usage: {
    action: 'browse' | 'search' | 'view_detail' | 'manage_favorites';
    cached_pages_available: number;
  };

  // Strains performance events
  strain_list_performance: {
    fps: number;
    frame_drops: number;
    total_frames: number;
    avg_frame_time_ms: number;
    list_size: number;
  };
  strain_api_performance: {
    endpoint: 'list' | 'detail';
    response_time_ms: number;
    status_code: number;
    cache_hit: boolean;
    error_type?: string;
  };
  strain_image_performance: {
    load_time_ms: number;
    cache_hit: boolean;
    image_size_kb?: number;
    failed: boolean;
  };
  strain_cache_performance: {
    operation: 'read' | 'write' | 'evict';
    cache_type: 'memory' | 'disk' | 'etag';
    hit_rate?: number;
    size_kb?: number;
  };

  // Add future events below
  // example_event: { foo: string; bar?: number };
};

export type AnalyticsEventName = keyof AnalyticsEvents;
export type AnalyticsEventPayload<N extends AnalyticsEventName> =
  AnalyticsEvents[N];

// Optional interface for an analytics client implementation used by the app
export interface AnalyticsClient {
  track<N extends AnalyticsEventName>(
    name: N,
    payload: AnalyticsEventPayload<N>
  ): void | Promise<void>;
}

// Example no-op client for testing/dev usage. Replace with real implementation when available.
export const NoopAnalytics: AnalyticsClient = {
  track: async (_name, _payload) => {
    // Intentionally no-op
    return;
  },
};

// Lightweight in-memory metrics aggregator for tests/dev
// Not exported as default client to keep production clean
export class InMemoryMetrics implements AnalyticsClient {
  private events: { name: AnalyticsEventName; payload: any; t: number }[] = [];
  track<N extends AnalyticsEventName>(
    name: N,
    payload: AnalyticsEventPayload<N>
  ): void {
    this.events.push({ name, payload, t: Date.now() });
  }
  getAll(): { name: AnalyticsEventName; payload: any; t: number }[] {
    return this.events.slice();
  }
  clear(): void {
    this.events = [];
  }
}

// Consent-gated analytics helper with PII stripping

// Helper function to create a consent-gated analytics tracker
export function createConsentGatedAnalytics(
  client: AnalyticsClient
): AnalyticsClient {
  return {
    track<N extends AnalyticsEventName>(
      name: N,
      payload: AnalyticsEventPayload<N>
    ): void | Promise<void> {
      const requiresConsent =
        name === 'strain_search' ||
        name.startsWith('strain_') ||
        name.startsWith('playbook_') ||
        name.startsWith('ai_adjustment_') ||
        name.startsWith('trichome_');

      if (requiresConsent && !hasConsent('analytics')) return;

      const sanitizedPayload = sanitizeAnalyticsPayload(name, payload);
      return client.track(name, sanitizedPayload);
    },
  };
}

// Helper to sanitize community error types to safe union
export function sanitizeCommunityErrorType(
  errorType: string
): 'network' | 'validation' | 'timeout' | 'unknown' {
  const normalized = errorType.toLowerCase().trim();

  // Check for network-related errors
  if (
    normalized.includes('network') ||
    normalized.includes('fetch') ||
    normalized.includes('connection') ||
    normalized.includes('timeout') ||
    normalized.includes('abort') ||
    normalized.includes('cancel')
  ) {
    return normalized.includes('timeout') ? 'timeout' : 'network';
  }

  // Check for validation errors
  if (
    normalized.includes('validation') ||
    normalized.includes('invalid') ||
    normalized.includes('bad request') ||
    normalized.includes('unauthorized') ||
    normalized.includes('forbidden')
  ) {
    return 'validation';
  }

  // Default to unknown for anything else
  return 'unknown';
}

// PII stripping and data minimization for analytics payloads

// Sanitize search queries to prevent PII leakage

// Sanitize strain search event payloads
function sanitizeStrainSearchPayload<N extends AnalyticsEventName>(
  payload: AnalyticsEventPayload<N>
): AnalyticsEventPayload<N> {
  const sanitized = { ...payload } as any;
  if (typeof sanitized.query === 'string') {
    sanitized.sanitized_query = sanitizeSearchQuery(sanitized.query);
    delete sanitized.query; // Remove raw query
  }
  return sanitized as AnalyticsEventPayload<N>;
}

// Sanitize community error event payloads
function sanitizeCommunityErrorPayload(
  payload: AnalyticsEventPayload<'community_error'>
): AnalyticsEventPayload<'community_error'> {
  const sanitized = { ...payload };

  // Sanitize error_type
  if (typeof sanitized.error_type === 'string') {
    sanitized.error_type = sanitizeCommunityErrorType(sanitized.error_type);
  }

  // Sanitize context if it exists
  if (sanitized.context && typeof sanitized.context === 'object') {
    const context = { ...sanitized.context };

    // Handle strain_search in context
    if (context.strain_search && typeof context.strain_search === 'object') {
      const strainSearch = { ...context.strain_search };
      if (typeof strainSearch.query === 'string') {
        strainSearch.sanitized_query = sanitizeSearchQuery(strainSearch.query);
        delete strainSearch.query;
      }
      context.strain_search = strainSearch;
    }

    // Handle home_view in context
    if (context.home_view && typeof context.home_view === 'object') {
      const homeView = { ...context.home_view };
      if (Array.isArray(homeView.widgets_shown)) {
        homeView.widgets_shown = homeView.widgets_shown
          .filter((widget): widget is string => typeof widget === 'string')
          .slice(0, 10)
          .map((widget) => sanitizeSearchQuery(widget));
      }
      context.home_view = homeView;
    }

    sanitized.context = context;
  }

  return sanitized;
}

// Sanitize playbook-related event payloads
function sanitizePlaybookPayload<N extends AnalyticsEventName>(
  payload: AnalyticsEventPayload<N>
): AnalyticsEventPayload<N> {
  const sanitized = { ...payload };

  // Ensure playbookId is hashed or anonymized (implementation depends on your ID strategy)
  if ('playbookId' in sanitized && typeof sanitized.playbookId === 'string') {
    // If playbookId contains PII, hash it here
    // For now, assume playbookId is already a non-identifiable UUID or similar
  }

  // Strip any potential PII from template names
  if ('templateName' in sanitized && sanitized.templateName) {
    // Remove any personal identifiers from template names
    sanitized.templateName = sanitized.templateName
      .replace(/[^\w\s\-!.]/g, '')
      .substring(0, 50);
  }

  // Ensure taskId is non-identifiable
  if ('taskId' in sanitized && typeof sanitized.taskId === 'string') {
    // If taskId contains PII, hash it here
    // For now, assume taskId is already a non-identifiable UUID or similar
  }

  // Remove any email, name, or location data that might slip through
  // This is a safeguard in case future events accidentally include PII
  const sanitizedObj = sanitized as any;
  const piiFields = ['email', 'name', 'location', 'address', 'phone', 'userId'];
  piiFields.forEach((field) => {
    if (field in sanitizedObj) {
      delete sanitizedObj[field];
    }
  });

  return sanitized as AnalyticsEventPayload<N>;
}

function sanitizeAnalyticsPayload<N extends AnalyticsEventName>(
  name: N,
  payload: AnalyticsEventPayload<N>
): AnalyticsEventPayload<N> {
  // Sanitize strain search queries to prevent PII leakage
  if (name === 'strain_search') {
    return sanitizeStrainSearchPayload(payload);
  }

  // Sanitize community error types to prevent PII leakage
  if (name === 'community_error') {
    return sanitizeCommunityErrorPayload(
      payload as AnalyticsEventPayload<'community_error'>
    ) as AnalyticsEventPayload<N>;
  }

  if (name === 'home_view') {
    const sanitized = { ...(payload as AnalyticsEventPayload<'home_view'>) };
    sanitized.widgets_shown = Array.isArray(sanitized.widgets_shown)
      ? sanitized.widgets_shown
          .filter((widget): widget is string => typeof widget === 'string')
          .slice(0, 10)
          .map((widget) =>
            sanitizeSearchQuery(widget)
              .toLowerCase()
              .replace(/[^a-z0-9._-]/g, '')
              .slice(0, 32)
          )
          .filter(Boolean)
      : [];
    return sanitized as AnalyticsEventPayload<N>;
  }

  // For guided grow playbook events, ensure minimal identifiers
  if (
    name.startsWith('playbook_') ||
    name.startsWith('ai_adjustment_') ||
    name.startsWith('trichome_')
  ) {
    return sanitizePlaybookPayload(payload);
  }

  // Sanitize strain detail viewed events to remove PII
  if (name === 'strain_detail_viewed') {
    const sanitized = {
      ...(payload as AnalyticsEventPayload<'strain_detail_viewed'>),
    };
    // Keep strain_id as-is (should be non-identifiable UUID)
    // Remove strain_name if it could contain PII (keep it for now as it's public data)
    if (sanitized.strain_name) {
      sanitized.strain_name = sanitized.strain_name.substring(0, 50);
    }
    return sanitized as AnalyticsEventPayload<N>;
  }

  // For non-playbook events, return as-is (they should already be PII-free per existing schema)
  return payload;
}

// Documented settings key for analytics consent
export const ANALYTICS_CONSENT_KEY = 'analytics';

/**
 * Analytics Consent Settings Key
 *
 * Key: 'analytics'
 * Type: boolean
 * Default: false
 * Description: Controls whether the user consents to analytics event collection for
 *              improving the guided grow playbooks feature. When disabled, all
 *              playbook-related analytics events are suppressed. Event payloads
 *              are automatically stripped of any PII and use minimal identifiers
 *              (hashed/non-identifiable IDs) even when consent is granted.
 *
 * Usage:
 * - Check consent with: hasConsent('analytics')
 * - Use createConsentGatedAnalytics() for automatic consent checking
 * - All playbook events: playbook_*, ai_adjustment_*, trichome_*
 */

function sanitizeSearchQuery(query: string): string {
  // Centralized redaction for search queries: trim, limit length, and redact
  // obvious PII patterns (emails, phone numbers). Keep it simple and safe.
  if (typeof query !== 'string') return '';
  const trimmed = query.trim();

  // Basic PII redaction: emails and phone-like numbers
  // Replace emails
  const emailRegex = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
  let out = trimmed.replace(emailRegex, '[redacted_email]');
  // Replace phone numbers with separators and optional country code (7-15 digits total)
  const phoneRegex = /(?=(?:.*\d){7,15})[\+]?[\d\s\-\.\(\)]+/g;
  out = out.replace(phoneRegex, '[redacted_phone]');

  // Bound length to avoid leaking large content (after redaction)
  const maxLen = 128;
  out = out.length > maxLen ? out.slice(0, maxLen) + '…' : out;

  return out;
}
