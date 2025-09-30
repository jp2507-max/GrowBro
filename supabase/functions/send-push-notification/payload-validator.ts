/**
 * Payload size validation and truncation utilities for Expo Push Notifications
 *
 * Platform limits:
 * - Expo Push Service: 4KB recommended limit (enforced by APNs)
 * - APNs: 4096 bytes total payload (includes all fields: title, body, data, etc.)
 * - FCM: Similar constraints; uses collapse_key for deduplication
 *
 * This module ensures payloads stay under limits by truncating notification bodies
 * when necessary, while preserving required metadata (deep links, message IDs, etc.).
 */

const EXPO_PUSH_MAX_BYTES = 4096; // APNs hard limit
const SAFE_PAYLOAD_BYTES = 3800; // Safety margin for overhead

interface NotificationPayload {
  to: string; // Expo push token
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: string;
  badge?: number;
  channelId?: string;
  categoryId?: string;
}

interface ValidationResult {
  valid: boolean;
  size: number;
  truncated?: string;
  reason?: string;
}

/**
 * Calculate UTF-8 byte size of a string (multi-byte safe)
 */
function getByteSize(str: string): number {
  return new TextEncoder().encode(str).length;
}

/**
 * Validate notification payload size against Expo/APNs limits
 * Returns validation result with truncation suggestion if needed
 */
export function validatePayloadSize(
  payload: NotificationPayload
): ValidationResult {
  const serialized = JSON.stringify(payload);
  const size = getByteSize(serialized);

  if (size <= EXPO_PUSH_MAX_BYTES) {
    return { valid: true, size };
  }

  // Payload too large; suggest body truncation
  const bodySize = getByteSize(payload.body);
  const overhead = size - bodySize;

  if (overhead >= SAFE_PAYLOAD_BYTES) {
    // Even with no body, payload is too large (bad metadata)
    return {
      valid: false,
      size,
      reason: 'Payload metadata exceeds safe limit; reduce data field size',
    };
  }

  const maxBodyBytes = SAFE_PAYLOAD_BYTES - overhead;
  const truncated = truncateNotificationBody(payload.body, maxBodyBytes);

  return {
    valid: false,
    size,
    truncated,
    reason: `Payload size ${size} bytes exceeds ${EXPO_PUSH_MAX_BYTES} byte limit`,
  };
}

/**
 * Truncate notification body to fit within byte limit (UTF-8 safe)
 * Appends ellipsis suffix and preserves multi-byte character boundaries
 */
export function truncateNotificationBody(
  body: string,
  maxBytes: number
): string {
  const ellipsis = '...';
  const ellipsisBytes = getByteSize(ellipsis);

  if (maxBytes <= ellipsisBytes) {
    // Not enough space for even ellipsis
    return '';
  }

  const targetBytes = maxBytes - ellipsisBytes;
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  // Binary search for safe truncation point
  let low = 0;
  let high = body.length;
  let bestLength = 0;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const candidate = body.substring(0, mid);
    const candidateBytes = encoder.encode(candidate).length;

    if (candidateBytes <= targetBytes) {
      bestLength = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  if (bestLength === 0) {
    return ellipsis;
  }

  // Extract bytes and decode to handle multi-byte character boundaries
  const truncatedBytes = encoder.encode(body.substring(0, bestLength));
  const safeTruncated = decoder.decode(truncatedBytes);

  return safeTruncated + ellipsis;
}

/**
 * Create truncated payload copy with body size limit enforced
 */
export function createTruncatedPayload(
  payload: NotificationPayload,
  maxBodyBytes: number
): NotificationPayload {
  return {
    ...payload,
    body: truncateNotificationBody(payload.body, maxBodyBytes),
  };
}
