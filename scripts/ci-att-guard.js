#!/usr/bin/env node
/*
 ATT prompt policy guard for iOS (Apple App Tracking Transparency).
 - We do NOT perform tracking nor access IDFA, so the app must never show ATT.
 - Ensure no ATT/IDFA libraries or APIs are referenced in source.
 - Ensure NSUserTrackingUsageDescription is absent from config/Info.plist.

 Outputs report to build/reports/compliance/att-guard.json and exits non-zero on violations.
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
    ]),
    includeExts = new Set([
      '.ts',
      '.tsx',
      '.js',
      '.jsx',
      '.mjs',
      '.cjs',
      '.json',
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
        if (ignoreDirs.has(ent.name)) continue;
        stack.push(p);
      } else if (ent.isFile()) {
        const ext = path.extname(ent.name);
        if (includeExts.has(ext)) files.push(p);
      }
    }
  }
  return files;
}

function scanSourceForBannedPatterns() {
  // Word-boundary-based patterns to avoid false positives like "attempt"
  const bannedRegexes = [
    /\bATTrackingManager\b/, // iOS native ATT manager
    /\bAppTrackingTransparency\b/, // framework name
    /\brequestTrackingAuthorization\b/,
    /\bASIdentifierManager\b/,
    /\badvertisingIdentifier\b/i, // IDFA
    /\bIDFA\b/,
    /\bAdSupport\b/,
    /expo-tracking-transparency/, // JS packages
    /react-native-tracking-transparency/,
  ];

  const SRC_DIR = path.join(ROOT, 'src');
  const files = fs.existsSync(SRC_DIR) ? walk(SRC_DIR) : [];
  const hits = [];
  for (const file of files) {
    const txt = readTextSafe(file);
    if (!txt) continue;
    // Fast path: skip if none of the simple needles appear
    if (
      !/Tracking|IDFA|AdSupport|advertisingIdentifier|expo-tracking-transparency|react-native-tracking-transparency/i.test(
        txt
      )
    ) {
      continue;
    }
    const lines = txt.split(/\r?\n/);
    lines.forEach((line, idx) => {
      for (const re of bannedRegexes) {
        if (re.test(line)) {
          hits.push({
            path: path.relative(ROOT, file),
            line: idx + 1,
            snippet: line.trim(),
            pattern: String(re),
          });
          break;
        }
      }
    });
  }
  return hits;
}

function scanConfigForNSUserTrackingUsageDescription() {
  const results = [];
  const appConfigPath = path.join(ROOT, 'app.config.cjs');
  const cfg = readTextSafe(appConfigPath);
  if (cfg && /NSUserTrackingUsageDescription/.test(cfg)) {
    results.push({
      path: path.relative(ROOT, appConfigPath),
      line: null,
      snippet: 'NSUserTrackingUsageDescription present',
      pattern: 'InfoPlist key',
    });
  }
  // If a prebuild ios Info.plist exists, scan it as well
  const iosDir = path.join(ROOT, 'ios');
  if (fs.existsSync(iosDir)) {
    // Find any Info.plist under ios/**/Info.plist
    const plistCandidates = [];
    const stack = [iosDir];
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
        if (ent.isDirectory()) stack.push(p);
        else if (ent.isFile() && ent.name === 'Info.plist')
          plistCandidates.push(p);
      }
    }
    for (const plist of plistCandidates) {
      const txt = readTextSafe(plist);
      if (txt && /NSUserTrackingUsageDescription/.test(txt)) {
        results.push({
          path: path.relative(ROOT, plist),
          line: null,
          snippet: 'NSUserTrackingUsageDescription present',
          pattern: 'Info.plist key',
        });
      }
    }
  }
  return results;
}

function scanPackageJsonForBannedDeps() {
  const p = path.join(ROOT, 'package.json');
  const pkg = readJsonSafe(p) || {};
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  const banned = [
    'expo-tracking-transparency',
    'react-native-tracking-transparency',
  ];
  const hits = [];
  for (const name of banned) {
    if (deps[name]) hits.push({ name, version: deps[name] });
  }
  return hits;
}

function buildReport({ codeHits, configHits, depHits }) {
  const problems = [];
  if (depHits.length) {
    problems.push({
      ruleId: 'att.banned-dependency',
      count: depHits.length,
      deps: depHits,
    });
  }
  if (configHits.length) {
    problems.push({
      ruleId: 'att.info-plist-key',
      count: configHits.length,
      entries: configHits,
    });
  }
  if (codeHits.length) {
    problems.push({
      ruleId: 'att.api-usage',
      count: codeHits.length,
      entries: codeHits.slice(0, 50),
    });
  }
  const ok = problems.length === 0;
  const messages = [];
  if (!ok) {
    if (depHits.length)
      messages.push('Remove tracking transparency libraries.');
    if (configHits.length)
      messages.push(
        'Remove NSUserTrackingUsageDescription from config/Info.plist.'
      );
    if (codeHits.length)
      messages.push(
        'Remove ATT/IDFA API usages. We do not track users or use IDFA.'
      );
  }
  return { ok, problems, messages };
}

function writeReport(report) {
  ensureDir(OUT_DIR);
  const outPath = path.join(OUT_DIR, 'att-guard.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  return outPath;
}

function main() {
  const depHits = scanPackageJsonForBannedDeps();
  const configHits = scanConfigForNSUserTrackingUsageDescription();
  const codeHits = scanSourceForBannedPatterns();
  const report = buildReport({ codeHits, configHits, depHits });
  const outPath = writeReport(report);
  if (!report.ok) {
    console.error('[att-guard] FAIL');
    for (const p of report.problems) {
      console.error(`- [${p.ruleId}] count=${p.count}`);
    }
    console.error('Report: ' + outPath);
    process.exit(1);
  }
  console.log('[att-guard] OK');
  console.log('Report: ' + outPath);
}

try {
  main();
} catch (e) {
  console.error('[att-guard] ERROR: ' + (e?.message || String(e)));
  process.exit(2);
}
