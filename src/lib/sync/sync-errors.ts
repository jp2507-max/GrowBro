export const SYNC_ERROR_TYPES = {
  NETWORK: 'network_error',
  SERVER: 'server_error',
  CONFLICT: 'conflict_error',
  VALIDATION: 'validation_error',
  STORAGE: 'storage_error',
  AUTH: 'auth_error',
} as const;

export type SyncErrorType =
  (typeof SYNC_ERROR_TYPES)[keyof typeof SYNC_ERROR_TYPES];

export type SyncError = {
  type: SyncErrorType;
  message: string;
  retryable: boolean;
  code?: string | number;
  context?: Record<string, unknown>;
  timestamp: Date;
};

export class SyncSchemaMismatchError extends Error {
  code: string;
  constructor(message: string = 'schema mismatch') {
    super(message);
    this.name = 'SyncSchemaMismatchError';
    this.code = 'schema_mismatch';
  }
}

function parseStatusFromMessage(message: string): number | null {
  // Matches patterns like "pull failed: 500" or "push failed: 409"
  const m = message.match(/\b(pull|push) failed:\s*(\d{3})\b/i);
  if (m && m[2]) return Number(m[2]);
  return null;
}

export function categorizeSyncError(error: unknown): SyncError {
  // NOTE: Keep this function short to satisfy lint max-lines-per-function rule.
  // Delegate parsing to small helpers.
  const now = new Date();

  // Explicit schema mismatch error
  if (error instanceof SyncSchemaMismatchError) {
    return {
      type: SYNC_ERROR_TYPES.VALIDATION,
      message: error.message,
      retryable: false,
      code: error.code,
      timestamp: now,
    };
  }

  if (error instanceof Error) return categorizeErrorByMessage(error, now);

  // Non-Error throw
  return {
    type: SYNC_ERROR_TYPES.SERVER,
    message: 'unknown error',
    retryable: false,
    timestamp: now,
  };
}

function categorizeErrorByMessage(error: Error, now: Date): SyncError {
  const name = error.name ?? '';
  const msg = error.message ?? '';

  if (
    name === 'AbortError' ||
    /timeout/i.test(msg) ||
    /Network request failed/i.test(msg)
  ) {
    return {
      type: SYNC_ERROR_TYPES.NETWORK,
      message: msg || 'network error',
      retryable: true,
      timestamp: now,
    };
  }

  const status = parseStatusFromMessage(msg);
  if (status != null) {
    if (status === 401 || status === 403) {
      return {
        type: SYNC_ERROR_TYPES.AUTH,
        message: msg,
        retryable: true,
        code: status,
        timestamp: now,
      };
    }
    if (status === 409) {
      return {
        type: SYNC_ERROR_TYPES.CONFLICT,
        message: msg,
        retryable: true,
        code: status,
        timestamp: now,
      };
    }
    if (status === 429 || status >= 500) {
      return {
        type: SYNC_ERROR_TYPES.SERVER,
        message: msg,
        retryable: true,
        code: status,
        timestamp: now,
      };
    }
    return {
      type: SYNC_ERROR_TYPES.VALIDATION,
      message: msg,
      retryable: false,
      code: status,
      timestamp: now,
    };
  }

  return {
    type: SYNC_ERROR_TYPES.SERVER,
    message: msg || 'unknown error',
    retryable: false,
    timestamp: now,
  };
}
