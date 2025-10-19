import { randomUUID } from 'expo-crypto';

// Header name constants
export const IDEMPOTENCY_KEY_HEADER = 'Idempotency-Key';
export const CLIENT_TX_ID_HEADER = 'X-Client-Tx-Id';

// Header validation regex patterns
const HEADER_PATTERN = /^[A-Za-z0-9_-]{1,255}$/;

/**
 * Generate a unique idempotency key using UUIDv4
 */
export function generateIdempotencyKey(): string {
  return randomUUID();
}

/**
 * Generate a unique client transaction ID using UUIDv4 + timestamp
 */
export function generateClientTxId(): string {
  const uuid = randomUUID();
  const timestamp = Date.now();
  return `${uuid}-${timestamp}`;
}

/**
 * Validate idempotency key format
 */
export function validateIdempotencyKey(
  key: string | null | undefined
): boolean {
  if (!key || typeof key !== 'string') {
    return false;
  }
  return HEADER_PATTERN.test(key);
}

/**
 * Validate client transaction ID format
 */
export function validateClientTxId(txId: string | null | undefined): boolean {
  if (!txId || typeof txId !== 'string') {
    return false;
  }
  return HEADER_PATTERN.test(txId);
}

/**
 * Validate both idempotency headers and throw if invalid
 */
export function validateIdempotencyHeaders(
  key: string | null | undefined,
  clientTxId: string | null | undefined
): { key: string; clientTxId: string } {
  if (!validateIdempotencyKey(key)) {
    throw new Error(
      'Missing or invalid Idempotency-Key header. Must be 1-255 alphanumeric, underscore, or hyphen characters.'
    );
  }

  if (!validateClientTxId(clientTxId)) {
    throw new Error(
      'Missing or invalid X-Client-Tx-Id header. Must be 1-255 alphanumeric, underscore, or hyphen characters.'
    );
  }

  return { key: key!, clientTxId: clientTxId! };
}

/**
 * Create headers object for idempotent requests
 */
export function createIdempotencyHeaders(
  idempotencyKey?: string,
  clientTxId?: string
): Record<string, string> {
  return {
    [IDEMPOTENCY_KEY_HEADER]: idempotencyKey || generateIdempotencyKey(),
    [CLIENT_TX_ID_HEADER]: clientTxId || generateClientTxId(),
  };
}
