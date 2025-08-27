// DeepLinkValidator: a hardened validator for incoming deep links and redirect-like params
// Keep boolean API for compatibility; also expose validateURLWithReason for diagnostics

export type ValidateResult = { ok: true } | { ok: false; reason: string };

export class DeepLinkValidator {
  private readonly ALLOWED_HOSTS = [
    'growbro.app',
    'staging.growbro.app',
    'dev.growbro.app',
  ];

  private readonly ALLOWLIST_PORTS: Record<string, number[]> = {
    'growbro.app': [443],
    'staging.growbro.app': [443],
    'dev.growbro.app': [443, 8080],
  };

  private readonly NAV_KEYS = ['redirect', 'next', 'url', 'continue'];
  private readonly FORBIDDEN_SCHEMES = [
    'javascript:',
    'intent:',
    'data:',
    'file:',
    'vbscript:',
  ];

  private readonly ALLOWED_PATHS = [
    '/post/:id',
    '/profile/:id',
    '/grow/:id',
    '/task/:id',
    '/feed',
    '/calendar',
  ];

  private readonly MAX_PARAM_LEN = 2048;
  private readonly MAX_ID_LEN = 64;

  // Public compatibility method
  validateURL(url: string): boolean {
    return this.validateURLWithReason(url).ok;
  }

  validateURLWithReason(url: string): ValidateResult {
    if (!url || typeof url !== 'string') {
      return { ok: false, reason: 'invalid-input' };
    }

    try {
      const parsed = new URL(url);
      const proto = parsed.protocol; // includes ':'

      const schemeCheck = this.checkScheme(parsed, proto);
      if (!schemeCheck.ok) return schemeCheck;

      const rawQuery = parsed.search || '';
      if (this.containsForbiddenScheme(rawQuery)) {
        return { ok: false, reason: 'forbidden-scheme-in-query' };
      }

      const pathCheck = this.checkPath(parsed, proto);
      if (!pathCheck.ok) return pathCheck;

      const redirectCheck = this.checkRedirectParams(parsed);
      if (!redirectCheck.ok) return redirectCheck;

      return { ok: true };
    } catch {
      return { ok: false, reason: 'parse-error' };
    }
  }

  private checkScheme(parsed: URL, proto: string): ValidateResult {
    if (!['https:', 'growbro:'].includes(proto)) {
      return { ok: false, reason: 'scheme-not-allowed' };
    }
    if (proto === 'https:') {
      if (!this.ALLOWED_HOSTS.includes(parsed.hostname)) {
        return { ok: false, reason: 'host-not-allowed' };
      }
      if (parsed.username || parsed.password) {
        return { ok: false, reason: 'userinfo-not-allowed' };
      }
      const port = parsed.port ? Number(parsed.port) : 443;
      const allowed = this.ALLOWLIST_PORTS[parsed.hostname] ?? [443];
      if (!allowed.includes(port)) {
        return { ok: false, reason: 'port-not-allowed' };
      }
    }
    return { ok: true };
  }

  private checkPath(parsed: URL, proto: string): ValidateResult {
    let rawPath = parsed.pathname;
    if (proto === 'growbro:' && parsed.hostname) {
      // If pathname is just '/' or empty, result should be '/<hostname>'
      if (parsed.pathname === '/' || parsed.pathname === '') {
        rawPath = `/${parsed.hostname}`;
      } else {
        rawPath = `/${parsed.hostname}${parsed.pathname}`;
      }
    }

    const normalizedPath = this.normalizePath(rawPath);
    if (!this.isAllowedPath(normalizedPath)) {
      return { ok: false, reason: 'path-not-allowed' };
    }
    return { ok: true };
  }

  private checkRedirectParams(parsed: URL): ValidateResult {
    for (const key of this.NAV_KEYS) {
      if (!parsed.searchParams.has(key)) continue;
      const raw = parsed.searchParams.get(key) ?? '';
      if (raw.length > this.MAX_PARAM_LEN) {
        return { ok: false, reason: 'param-too-long' };
      }

      const v = this.boundedDecode(raw, 3, this.MAX_PARAM_LEN);
      if (v.length > this.MAX_PARAM_LEN) {
        return { ok: false, reason: 'param-too-long-after-decode' };
      }

      if (v.startsWith('//')) {
        return { ok: false, reason: 'protocol-relative-not-allowed' };
      }

      if (v.startsWith('/')) continue;

      if (/^http:/i.test(v)) {
        return { ok: false, reason: 'insecure-redirect' };
      }

      try {
        const target = new URL(v);
        if (this.FORBIDDEN_SCHEMES.includes(target.protocol)) {
          return { ok: false, reason: 'forbidden-scheme-in-redirect' };
        }
        if (target.protocol !== 'https:') {
          return { ok: false, reason: 'redirect-not-https' };
        }
        if (!this.ALLOWED_HOSTS.includes(target.hostname)) {
          return { ok: false, reason: 'redirect-host-not-allowed' };
        }
        const port = target.port ? Number(target.port) : 443;
        const allowed = this.ALLOWLIST_PORTS[target.hostname] ?? [443];
        if (!allowed.includes(port)) {
          return { ok: false, reason: 'redirect-port-not-allowed' };
        }
      } catch {
        return { ok: false, reason: 'redirect-parse-failed' };
      }
    }
    return { ok: true };
  }

  sanitizeParams(params: Record<string, string>): Record<string, string> {
    const sanitized: Record<string, string> = {};
    for (const [key, value] of Object.entries(params)) {
      if (!key || !value) continue;
      if (key.length > 256 || value.length > 256) continue;
      if (!/^[a-zA-Z0-9_-]+$/.test(key)) continue;
      if (!/^[a-zA-Z0-9_-]+$/.test(value)) continue;
      // avoid navigation keys in sanitized params
      if (this.NAV_KEYS.includes(key)) continue;
      sanitized[key] = value;
    }
    return sanitized;
  }

  // Helpers
  private boundedDecode(
    input: string,
    maxDepth: number,
    maxLen: number
  ): string {
    let v = input;
    try {
      for (let i = 0; i < maxDepth; i++) {
        if (v.length > maxLen) break;
        let d: string;
        try {
          d = decodeURIComponent(v);
        } catch {
          break;
        }
        if (d === v) break;
        v = d;
      }
    } catch {
      /* swallow */
    }
    return v;
  }

  private containsForbiddenScheme(raw: string): boolean {
    if (!raw) return false;
    const decoded = this.boundedDecode(raw, 3, this.MAX_PARAM_LEN);
    const combined = `${raw} ${decoded}`.toLowerCase();
    const schemeRegex = /(javascript:|data:|intent:|file:|vbscript:)/i;
    return schemeRegex.test(combined);
  }

  private normalizePath(pathname: string): string {
    try {
      // decode and collapse multiple slashes
      let p = decodeURIComponent(pathname || '/');
      p = p.replace(/\/+/g, '/');
      // remove /./ segments
      p = p.replace(/\/\.\//g, '/');
      // resolve .. conservatively
      const parts = p.split('/');
      const out: string[] = [];
      for (const part of parts) {
        if (part === '' || part === '.') {
          if (out.length === 0) out.push('');
          continue;
        }
        if (part === '..') {
          if (out.length > 1) out.pop();
          continue;
        }
        out.push(part);
      }
      let res = out.join('/');
      if (!res.startsWith('/')) res = '/' + res;
      if (res.length > 2000) return '/';
      return res;
    } catch {
      return pathname;
    }
  }

  private isAllowedPath(pathname: string): boolean {
    if (!pathname) return false;
    // match against ALLOWED_PATHS patterns
    for (const pattern of this.ALLOWED_PATHS) {
      const pSegs = pattern.split('/').filter(Boolean);
      const sSegs = pathname.split('/').filter(Boolean);
      if (pSegs.length !== sSegs.length) continue;
      let ok = true;
      for (let i = 0; i < pSegs.length; i++) {
        const ps = pSegs[i];
        const ss = sSegs[i];
        if (ps.startsWith(':')) {
          // validate id
          if (!/^[A-Za-z0-9_-]{1,64}$/.test(ss)) {
            ok = false;
            break;
          }
        } else {
          if (ps !== ss) {
            ok = false;
            break;
          }
        }
      }
      if (ok) return true;
    }
    return false;
  }
}

export default DeepLinkValidator;
