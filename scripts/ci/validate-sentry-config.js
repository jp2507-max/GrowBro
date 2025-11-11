#!/usr/bin/env node
/**
 * Observability quick-checks for Sentry RN + Expo
 * - Verifies Metro uses getSentryExpoConfig (Debug IDs + bundler integration)
 * - Soft-warns if SENTRY_DSN missing (no fail in local/dev)
 * - Emits JSON report to build/reports/observability/sentry-validate.json
 *
 * Failing conditions (exit 1):
 * - In CI (CI=true) AND SENTRY_DSN is set AND Metro is not wired
 */
const fs = require('fs');
const path = require('path');

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function main() {
  const root = process.cwd();
  const metroPath = path.join(root, 'metro.config.js');
  const reportDir = path.join(root, 'build', 'reports', 'observability');
  ensureDir(reportDir);

  const ci = String(process.env.CI || '').toLowerCase() === 'true';
  const hasDsn = Boolean(process.env.SENTRY_DSN);

  const metro = fs.existsSync(metroPath)
    ? fs.readFileSync(metroPath, 'utf8')
    : '';
  const usesSentryExpoConfig = /getSentryExpoConfig\(/.test(metro);

  const result = {
    ci,
    env_has_sentry_dsn: hasDsn,
    metro_uses_sentry_expo_config: usesSentryExpoConfig,
    status: 'PASS',
    warnings: [],
    errors: [],
  };

  if (!usesSentryExpoConfig) {
    const msg =
      'Metro is not using getSentryExpoConfig() — Debug IDs/source maps may be missing.';
    if (ci && hasDsn) {
      result.errors.push(msg);
      result.status = 'FAIL';
    } else {
      result.warnings.push(msg);
    }
  }

  if (!hasDsn) {
    result.warnings.push('SENTRY_DSN not set — skipping strict validation.');
  }

  const outPath = path.join(reportDir, 'sentry-validate.json');
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf8');
  const tag = result.status === 'PASS' ? '✓' : '✗';
  console.log(`${tag} wrote ${path.relative(root, outPath)}`);

  if (result.status !== 'PASS') {
    console.error('[observability] FAIL:', result.errors.join('; '));
    process.exit(1);
  }
}

try {
  main();
} catch (e) {
  console.error('[observability] ERROR:', e?.message || String(e));
  process.exit(1);
}
