#!/usr/bin/env node
/*
 SIWA readiness guard (Apple: Sign in with Apple requirement).
 Purpose: If any third‑party/social login is introduced (Google/Facebook/etc.),
 ensure the project also includes Sign in with Apple support.

 References (verify periodically):
 - https://developer.apple.com/app-store/review/guidelines/
 - https://developer.apple.com/sign-in-with-apple/

 Behavior:
 - Scans package.json dependencies and source code for known third‑party login patterns.
 - If any are found, verifies presence of `expo-apple-authentication` (Expo plugin adds entitlement).
 - Writes JSON report to build/reports/compliance/siwa-guard.json.
 - Exits non-zero on violations.
*/
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'build', 'reports', 'compliance');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readTextSafe(p) {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch {
    return null;
  }
}

function readJsonSafe(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function walk(dir, opts = {}) {
  const {
    ignoreDirs = new Set([
      'node_modules',
      '.git',
      'build',
      'coverage',
      'android',
      '.expo',
      '.maestro',
      'ios/build',
    ]),
    includeExts = new Set([
      '.ts',
      '.tsx',
      '.js',
      '.jsx',
      '.json',
      '.cjs',
      '.mjs',
    ]),
  } = opts;
  const files = [];
  const stack = [dir];
  while (stack.length) {
    const d = stack.pop();
    let entries = [];
    try {
      entries = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const ent of entries) {
      const p = path.join(d, ent.name);
      if (ent.isDirectory()) {
        const name = ent.name;
        if (ignoreDirs.has(name)) continue;
        stack.push(p);
      } else if (ent.isFile()) {
        const ext = path.extname(ent.name);
        if (includeExts.has(ext)) files.push(p);
      }
    }
  }
  return files;
}

// Third-party login detection
const THIRD_PARTY_DEPS = [
  // Google
  '@react-native-google-signin/google-signin',
  'react-native-google-signin',
  'expo-google-app-auth', // legacy
  // Facebook
  'react-native-fbsdk-next',
  'expo-facebook',
  // Twitter
  'react-native-twitter-signin',
  // Auth providers via SDKs
  'auth0-react-native',
  '@react-native-seoul/kakao-login',
  '@invertase/react-native-apple-authentication', // not third-party, but keep out of this list on purpose
  // Expo AuthSession (providers handled via source scan)
  // 'expo-auth-session' alone is not conclusive
];

const THIRD_PARTY_SOURCE_PATTERNS = [
  // Expo AuthSession provider imports
  /from\s+['"]expo-auth-session\/providers\/(google|facebook|twitter|github|gitlab|bitbucket|linkedin|amazon|wechat|microsoft)['"]/i,
  // Popular SDK APIs
  /\bGoogleSignin\b/,
  /\bLoginManager\b/, // FB
  /\bAccessToken\b/, // FB
  /\bTwitterSignIn\b/,
  // Supabase OAuth providers (signInWithOAuth({ provider: 'google' | 'facebook' | ... }))
  /signInWithOAuth\s*\(\s*\{[^}]*provider\s*:\s*['"](google|facebook|twitter|github|gitlab|bitbucket|linkedin|amazon|wechat|yandex|spotify|discord|slack|tiktok|twitch|yahoo|microsoft)['"][^}]*\}\s*\)/i,
];

function scanPackageJsonForThirdPartyDeps() {
  const p = path.join(ROOT, 'package.json');
  const pkg = readJsonSafe(p) || {};
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  const hits = [];
  for (const name of THIRD_PARTY_DEPS) {
    if (deps[name]) hits.push({ name, version: deps[name] });
  }
  return hits;
}

function scanSourceForThirdPartyUsage() {
  const SRC_DIR = path.join(ROOT, 'src');
  const files = fs.existsSync(SRC_DIR) ? walk(SRC_DIR) : [];
  const hits = [];
  for (const file of files) {
    const txt = readTextSafe(file);
    if (!txt) continue;
    // Fast path prefilter
    if (
      !/(expo-auth-session\/providers|GoogleSignin|LoginManager|AccessToken|signInWithOAuth)/i.test(
        txt
      )
    ) {
      continue;
    }
    const lines = txt.split(/\r?\n/);
    lines.forEach((line, idx) => {
      for (const re of THIRD_PARTY_SOURCE_PATTERNS) {
        if (re.test(line)) {
          hits.push({
            path: path.relative(ROOT, file),
            line: idx + 1,
            snippet: line.trim().slice(0, 200),
            pattern: String(re),
          });
          break;
        }
      }
    });
  }
  return hits;
}

function checkSiwaPresence() {
  // Primary check: Expo Apple Authentication module present
  const pkg = readJsonSafe(path.join(ROOT, 'package.json')) || {};
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  const hasExpoAppleAuth = Boolean(deps['expo-apple-authentication']);

  // Optional: confirm app.config.cjs mentions plugin (not required in recent Expo, but helpful)
  const cfgPath = path.join(ROOT, 'app.config.cjs');
  const cfgTxt = readTextSafe(cfgPath) || '';
  const mentionsPlugin = /expo-apple-authentication/.test(cfgTxt);

  return { hasExpoAppleAuth, mentionsPlugin };
}

function buildReport({ depHits, codeHits, siwa }) {
  const problems = [];
  const thirdPartyDetected = depHits.length > 0 || codeHits.length > 0;
  if (thirdPartyDetected) {
    if (!siwa.hasExpoAppleAuth) {
      problems.push({
        ruleId: 'siwa.missing-apple-auth',
        message:
          'Third-party login detected but expo-apple-authentication is not present. Add Sign in with Apple support.',
      });
    }
  }

  const ok = problems.length === 0;
  const summary = [];
  if (!thirdPartyDetected) {
    summary.push(
      'No third-party login detected — SIWA requirement not applicable.'
    );
  } else {
    summary.push('Third-party login detected.');
    if (siwa.hasExpoAppleAuth)
      summary.push('expo-apple-authentication present.');
    if (siwa.mentionsPlugin)
      summary.push('app.config mentions expo-apple-authentication.');
  }

  return {
    ok,
    problems,
    thirdParty: {
      depHits,
      codeHits: codeHits.slice(0, 50),
      detected: thirdPartyDetected,
    },
    siwa: {
      hasExpoAppleAuth: siwa.hasExpoAppleAuth,
      mentionsPlugin: siwa.mentionsPlugin,
    },
    messages: ok
      ? summary
      : summary.concat([
          'Add SIWA when offering Google/Facebook/etc., per App Store guidelines.',
        ]),
  };
}

function writeReport(report) {
  ensureDir(OUT_DIR);
  const outPath = path.join(OUT_DIR, 'siwa-guard.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  return outPath;
}

function main() {
  const depHits = scanPackageJsonForThirdPartyDeps();
  const codeHits = scanSourceForThirdPartyUsage();
  const siwa = checkSiwaPresence();
  const report = buildReport({ depHits, codeHits, siwa });
  const outPath = writeReport(report);
  if (!report.ok) {
    console.error('[siwa-guard] FAIL');
    for (const p of report.problems)
      console.error('- ' + p.ruleId + ': ' + p.message);
    console.error('Report: ' + outPath);
    process.exit(1);
  }
  console.log('[siwa-guard] OK');
  console.log('Report: ' + outPath);
}

try {
  main();
} catch (e) {
  console.error('[siwa-guard] ERROR: ' + (e?.message || String(e)));
  process.exit(2);
}
