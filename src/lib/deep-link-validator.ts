// DeepLinkValidator: hardened validation for deep links and redirect-like query parameters
// Maintains boolean API for compatibility and exposes canonical reason codes for diagnostics

export type ValidationReason =
  | 'invalid-input'
  | 'parse-error'
  | 'blocked-redirect-insecure-http'
  | 'blocked-redirect-external'
  | 'blocked-unknown-external-param'
  | 'blocked-nondefault-port'
  | 'forbidden-userinfo'
  | 'forbidden-scheme-file'
  | 'forbidden-scheme-javascript'
  | 'forbidden-scheme-intent'
  | 'forbidden-scheme-data'
  | 'sanitizer-iteration-limit'
  | 'blocked-idn'
  | 'blocked-path-traversal'
  | 'path-not-allowed'
  | 'param-too-long'
  | 'param-too-long-after-decode'
  | 'redirect-parse-failed'
  | 'redirect-not-https'
  | 'protocol-relative-not-allowed'
  | 'blocked-scheme'
  | 'redirect-host-not-allowed'
  | 'scheme-not-supported';

export type ValidateResult =
  | { ok: true }
  | { ok: false; reason: ValidationReason };

type AllowedOrigin = {
  host: string;
  ports: number[];
};

type DeepLinkValidatorOptions = {
  allowedOrigins: AllowedOrigin[];
  allowedPathPatterns: string[];
  customScheme: string;
  navParamKeys: string[];
  maxParamLength: number;
  maxPathLength: number;
  maxDecodeIterations: number;
};

const DEFAULT_OPTIONS: DeepLinkValidatorOptions = {
  allowedOrigins: [
    { host: 'growbro.app', ports: [443] },
    { host: 'staging.growbro.app', ports: [443] },
    { host: 'dev.growbro.app', ports: [443, 8080] },
  ],
  allowedPathPatterns: [
    '/app-access/assessment-overview',
    '/post/:id',
    '/profile/:id',
    '/grow/:id',
    '/task/:id',
    '/feed',
    '/calendar',
  ],
  customScheme: 'growbro',
  navParamKeys: ['redirect', 'next', 'url', 'continue'],
  maxParamLength: 2048,
  maxPathLength: 2048,
  maxDecodeIterations: 5,
};

const FORBIDDEN_SCHEME_REASONS: Record<string, ValidationReason> = {
  'file:': 'forbidden-scheme-file',
  'javascript:': 'forbidden-scheme-javascript',
  'intent:': 'forbidden-scheme-intent',
  'data:': 'forbidden-scheme-data',
};

type DecodeResult = {
  value: string;
  limitHit: boolean;
  iterations: number;
};

type NormalizedPathResult = {
  normalized: string;
  limitHit: boolean;
  hadTraversal: boolean;
  escapedRoot: boolean;
};

export class DeepLinkValidator {
  private readonly options: DeepLinkValidatorOptions;
  private readonly originMap: Record<string, AllowedOrigin>;

  constructor(options?: Partial<DeepLinkValidatorOptions>) {
    this.options = {
      ...DEFAULT_OPTIONS,
      ...options,
      allowedOrigins: options?.allowedOrigins ?? DEFAULT_OPTIONS.allowedOrigins,
      allowedPathPatterns:
        options?.allowedPathPatterns ?? DEFAULT_OPTIONS.allowedPathPatterns,
      navParamKeys: options?.navParamKeys ?? DEFAULT_OPTIONS.navParamKeys,
    };

    this.originMap = this.options.allowedOrigins.reduce<
      Record<string, AllowedOrigin>
    >((acc, origin) => {
      acc[origin.host.toLowerCase()] = {
        host: origin.host.toLowerCase(),
        ports: origin.ports,
      };
      return acc;
    }, {});

    this.validateURL = this.validateURL.bind(this);
  }

  validateURL(url: string): boolean {
    return this.validateURLWithReason(url).ok;
  }

  validateURLWithReason(url: string): ValidateResult {
    if (!url || typeof url !== 'string') {
      return { ok: false, reason: 'invalid-input' };
    }

    try {
      const parsed = new URL(url);
      const schemeCheck = this.checkSchemeAndHost(parsed);
      if (!schemeCheck.ok) return schemeCheck;

      const queryCheck = this.checkForbiddenSchemes(parsed.search);
      if (!queryCheck.ok) return queryCheck;

      const pathCheck = this.checkPath(parsed, url);
      if (!pathCheck.ok) return pathCheck;

      const redirectCheck = this.checkRedirectParams(parsed);
      if (!redirectCheck.ok) return redirectCheck;

      return { ok: true };
    } catch {
      return { ok: false, reason: 'parse-error' };
    }
  }

  sanitizeParams(params: Record<string, string>): Record<string, string> {
    const sanitized: Record<string, string> = {};
    for (const [key, value] of Object.entries(params)) {
      if (!key || !value) continue;
      if (key.length > 256 || value.length > 256) continue;
      // Strict key validation: allow letters, digits, dot, underscore, hyphen
      if (!/^[a-zA-Z0-9._-]+$/.test(key)) continue;
      // Relaxed value validation: decode and reject only control/null chars and excessive length
      try {
        const decoded = decodeURIComponent(value);
        if (decoded.length > 256) continue;
        // Reject control characters and null bytes
        if (/[\x00-\x1F\x7F]/.test(decoded)) continue;
        if (this.options.navParamKeys.includes(key)) continue;
        sanitized[key] = decoded;
      } catch {
        // If decoding fails, reject the value
        continue;
      }
    }
    return sanitized;
  }

  private checkSchemeAndHost(parsed: URL): ValidateResult {
    const proto = parsed.protocol.toLowerCase();

    if (proto in FORBIDDEN_SCHEME_REASONS) {
      return { ok: false, reason: FORBIDDEN_SCHEME_REASONS[proto] };
    }

    if (proto === 'http:') {
      return { ok: false, reason: 'blocked-redirect-insecure-http' };
    }

    if (proto === `${this.options.customScheme.toLowerCase()}:`) {
      return { ok: true };
    }

    if (proto !== 'https:') {
      return { ok: false, reason: 'scheme-not-supported' };
    }

    const hostname = parsed.hostname.toLowerCase();
    if (parsed.username || parsed.password) {
      return { ok: false, reason: 'forbidden-userinfo' };
    }

    const origin = this.originMap[hostname];
    if (!origin) {
      if (this.isIdn(hostname)) {
        return { ok: false, reason: 'blocked-idn' };
      }
      return { ok: false, reason: 'blocked-redirect-external' };
    }

    const port = this.resolvePort(parsed.port);
    if (!origin.ports.includes(port)) {
      return { ok: false, reason: 'blocked-nondefault-port' };
    }

    return { ok: true };
  }

  private checkPath(parsed: URL, rawInput: string): ValidateResult {
    const rawPath = this.extractRawPath(rawInput, parsed);
    const normalized = this.normalizePath(rawPath);
    return this.evaluateNormalizedPath(normalized);
  }

  private checkRedirectParams(parsed: URL): ValidateResult {
    for (const key of this.options.navParamKeys) {
      if (!parsed.searchParams.has(key)) continue;
      const raw = parsed.searchParams.get(key) ?? '';
      if (raw.length > this.options.maxParamLength) {
        return { ok: false, reason: 'param-too-long' };
      }

      const decoded = this.boundedDecode(
        raw,
        this.options.maxDecodeIterations,
        this.options.maxParamLength
      );

      if (decoded.limitHit) {
        return { ok: false, reason: 'sanitizer-iteration-limit' };
      }

      if (decoded.value.length > this.options.maxParamLength) {
        return { ok: false, reason: 'param-too-long-after-decode' };
      }

      if (decoded.value.startsWith('//')) {
        return { ok: false, reason: 'blocked-redirect-external' };
      }

      if (decoded.value.startsWith('/')) {
        const pathResult = this.normalizePath(decoded.value);
        const evalResult = this.evaluateNormalizedPath(pathResult);
        if (!evalResult.ok) {
          return evalResult;
        }
        continue;
      }

      if (/^http:/i.test(decoded.value)) {
        return { ok: false, reason: 'blocked-redirect-insecure-http' };
      }

      const nestedScheme = this.detectForbiddenScheme(decoded.value);
      if (nestedScheme) {
        return { ok: false, reason: nestedScheme };
      }

      try {
        const target = new URL(decoded.value);
        const absoluteCheck = this.checkAbsoluteTarget(target, decoded.value);
        if (!absoluteCheck.ok) return absoluteCheck;
      } catch {
        return { ok: false, reason: 'redirect-parse-failed' };
      }
    }
    return { ok: true };
  }

  private checkAbsoluteTarget(target: URL, rawInput: string): ValidateResult {
    const scheme = target.protocol.toLowerCase();

    if (scheme in FORBIDDEN_SCHEME_REASONS) {
      return { ok: false, reason: FORBIDDEN_SCHEME_REASONS[scheme] };
    }

    if (scheme === 'http:') {
      return { ok: false, reason: 'blocked-redirect-insecure-http' };
    }

    if (scheme !== 'https:') {
      return { ok: false, reason: 'redirect-not-https' };
    }

    if (target.username || target.password) {
      return { ok: false, reason: 'forbidden-userinfo' };
    }

    const hostname = target.hostname.toLowerCase();
    const origin = this.originMap[hostname];
    if (!origin) {
      if (this.isIdn(hostname)) {
        return { ok: false, reason: 'blocked-idn' };
      }
      return { ok: false, reason: 'blocked-redirect-external' };
    }

    const port = this.resolvePort(target.port);
    if (!origin.ports.includes(port)) {
      return { ok: false, reason: 'blocked-nondefault-port' };
    }

    const rawPath = this.extractRawPath(rawInput, target);
    const pathResult = this.normalizePath(rawPath);
    const evalResult = this.evaluateNormalizedPath(pathResult);
    if (!evalResult.ok) {
      return evalResult;
    }

    return { ok: true };
  }

  private evaluateNormalizedPath(result: NormalizedPathResult): ValidateResult {
    if (result.limitHit) {
      return { ok: false, reason: 'sanitizer-iteration-limit' };
    }

    if (!this.isAllowedPath(result.normalized)) {
      if (result.hadTraversal || result.escapedRoot) {
        return { ok: false, reason: 'blocked-path-traversal' };
      }
      return { ok: false, reason: 'path-not-allowed' };
    }

    return { ok: true };
  }

  private checkForbiddenSchemes(rawQuery: string): ValidateResult {
    if (!rawQuery) {
      return { ok: true };
    }

    const decoded = this.boundedDecode(
      rawQuery,
      this.options.maxDecodeIterations,
      this.options.maxParamLength
    );

    if (decoded.limitHit) {
      return { ok: false, reason: 'sanitizer-iteration-limit' };
    }

    const combined = `${rawQuery}\n${decoded.value}`.toLowerCase();
    for (const [scheme, reason] of Object.entries(FORBIDDEN_SCHEME_REASONS)) {
      if (combined.includes(scheme)) {
        return { ok: false, reason };
      }
    }

    return { ok: true };
  }

  private detectForbiddenScheme(value: string): ValidationReason | null {
    const lowered = value.toLowerCase();
    for (const [scheme, reason] of Object.entries(FORBIDDEN_SCHEME_REASONS)) {
      if (lowered.includes(scheme)) {
        return reason;
      }
    }
    return null;
  }

  private boundedDecode(
    input: string,
    maxDepth: number,
    maxLen: number
  ): DecodeResult {
    let current = input;
    let limitHit = false;
    let iterations = 0;

    for (; iterations < maxDepth; iterations++) {
      if (current.length > maxLen) {
        limitHit = true;
        break;
      }

      let decoded: string;
      try {
        decoded = decodeURIComponent(current);
      } catch {
        if (/%/i.test(current)) {
          limitHit = true;
        }
        break;
      }

      if (decoded === current) {
        break;
      }

      current = decoded;
    }
    if (iterations >= maxDepth && /%[0-9a-f]{2}/i.test(current)) {
      limitHit = true;
    }

    return { value: current, limitHit, iterations };
  }

  private extractRawPath(input: string, parsed: URL): string {
    const source = input ?? '';
    const schemeIndex = source.indexOf('://');
    const searchStart = schemeIndex >= 0 ? schemeIndex + 3 : 0;
    const pathStart = source.indexOf('/', searchStart);

    let basePath = '/';
    if (pathStart !== -1) {
      let end = source.length;
      const queryIndex = source.indexOf('?', pathStart);
      if (queryIndex !== -1 && queryIndex < end) {
        end = queryIndex;
      }
      const hashIndex = source.indexOf('#', pathStart);
      if (hashIndex !== -1 && hashIndex < end) {
        end = hashIndex;
      }
      basePath = source.slice(pathStart, end) || '/';
    }

    const scheme = parsed.protocol.toLowerCase();
    const customScheme = `${this.options.customScheme.toLowerCase()}:`;
    if (scheme === customScheme && parsed.hostname) {
      const hostSegment = `/${parsed.hostname}`;
      if (basePath === '/' || basePath === '') {
        return hostSegment;
      }
      if (basePath.startsWith('/')) {
        return `${hostSegment}${basePath}`;
      }
      return `${hostSegment}/${basePath}`;
    }

    if (pathStart === -1) {
      return '/';
    }

    return basePath;
  }

  private normalizePath(pathname: string): NormalizedPathResult {
    const decoded = this.boundedDecode(
      pathname || '/',
      this.options.maxDecodeIterations,
      this.options.maxPathLength
    );

    let p = decoded.value;
    let hadTraversal = false;
    let escapedRoot = false;

    p = p.replace(/\/+/g, '/');
    p = p.replace(/\/\.\//g, '/');

    const parts = p.split('/');
    const out: string[] = [];

    for (const part of parts) {
      if (part === '' || part === '.') {
        if (out.length === 0) {
          out.push('');
        }
        continue;
      }

      if (part === '..') {
        hadTraversal = true;
        if (out.length > 1) {
          out.pop();
        } else {
          escapedRoot = true;
        }
        continue;
      }

      out.push(part);
    }

    let normalized = out.join('/');
    if (!normalized.startsWith('/')) {
      normalized = `/${normalized}`;
    }

    if (normalized.length > this.options.maxPathLength) {
      normalized = '/';
    }

    return {
      normalized,
      hadTraversal,
      escapedRoot,
      limitHit: decoded.limitHit,
    };
  }

  private resolvePort(port: string): number {
    if (!port) return 443;
    const parsed = Number(port);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return 443;
    }
    return parsed;
  }

  private isAllowedPath(pathname: string): boolean {
    if (!pathname) return false;

    for (const pattern of this.options.allowedPathPatterns) {
      const patternSegments = pattern.split('/').filter(Boolean);
      const pathSegments = pathname.split('/').filter(Boolean);

      if (patternSegments.length !== pathSegments.length) {
        continue;
      }

      let matches = true;
      for (let i = 0; i < patternSegments.length; i++) {
        const expected = patternSegments[i];
        const actual = pathSegments[i];
        if (expected.startsWith(':')) {
          if (!/^[A-Za-z0-9_-]{1,64}$/.test(actual)) {
            matches = false;
            break;
          }
        } else if (expected !== actual) {
          matches = false;
          break;
        }
      }

      if (matches) {
        return true;
      }
    }

    return false;
  }

  private isIdn(host: string): boolean {
    return /xn--/i.test(host);
  }
}

export default DeepLinkValidator;
