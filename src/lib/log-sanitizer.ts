export type SanitizationConfig = {
  customPatterns?: RegExp[];
};

export class LogSanitizer {
  private sensitivePatterns: RegExp[];
  private sensitiveNames: Set<string>;

  constructor(config: SanitizationConfig = {}) {
    this.sensitivePatterns = [
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/gi, // Email
      /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
      /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g, // Credit card
      /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, // Bearer tokens
      /api[_-]?key['":\s]*[A-Za-z0-9]{8,}/gi, // API keys (len relaxed for tests)
      ...(config.customPatterns ?? []),
    ];

    // Sensitive key names — we'll match tokens exactly after splitting by non-word chars
    this.sensitiveNames = new Set([
      'password',
      'token',
      'secret',
      'key',
      'auth',
      'email',
      'phone',
      'ssn',
      'credit',
      'payment',
      'session',
      'cookie',
      'bearer',
      'oauth',
    ]);
  }

  sanitizeLog(logEntry: string): string {
    let sanitized = logEntry;
    for (const pattern of this.sensitivePatterns) {
      sanitized = sanitized.replace(pattern, '[REDACTED]');
    }
    return sanitized;
  }

  sanitizeObject(obj: unknown): unknown {
    const visited = new WeakSet<object>();

    const sanitize = (value: unknown): unknown => {
      if (value == null) return value;
      const t = typeof value;

      if (t === 'string') return this.sanitizeLog(value as string);
      if (t === 'number' || t === 'boolean' || t === 'bigint') return value;

      if (value instanceof Date) return new Date(value.getTime());

      if (Array.isArray(value)) {
        if (visited.has(value)) return '[Circular]';
        visited.add(value);
        return value.map((v) => sanitize(v));
      }

      if (value instanceof Map) {
        if (visited.has(value)) return '[Circular]';
        visited.add(value);
        const m = new Map();
        for (const [k, v] of value.entries()) m.set(k, sanitize(v));
        return m;
      }

      if (value instanceof Set) {
        if (visited.has(value)) return '[Circular]';
        visited.add(value);
        const s = new Set();
        for (const v of value.values()) s.add(sanitize(v));
        return s;
      }

      if (t === 'object') {
        if (visited.has(value)) return '[Circular]';
        visited.add(value);
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(value)) {
          if (this.isSensitiveKey(k)) out[k] = '[REDACTED]';
          else out[k] = sanitize(v);
        }
        return out;
      }

      return value;
    };

    return sanitize(obj);
  }

  private isSensitiveKey(key: string): boolean {
    if (!key) return false;
    const normalized = key.toLowerCase();
    // Split on non-word characters so 'api-key' -> ['api','key'] and 'monkey' -> ['monkey']
    const tokens = normalized.split(/[^a-z0-9]+/g).filter(Boolean);
    for (const t of tokens) {
      if (this.sensitiveNames.has(t)) return true;
    }
    return false;
  }
}

export default LogSanitizer;
