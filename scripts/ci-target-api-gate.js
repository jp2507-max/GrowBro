#!/usr/bin/env node
/*
 Target API gate for Google Play policy (API 35).
 - Reads enforcement dates from docs/compliance/policy-deadlines.md if available
 - Detects configured targetSdkVersion from:
   1) android/app/build.gradle (if prebuilt)
   2) app.config.cjs expo-build-properties plugin (programmatic)
   3) app.config.cjs source text as a fallback regex
 - Emits report JSON to build/reports/compliance/target-api-gate.json
 - Fails CI if today is past enforcement date and targetSdkVersion < required
 */

const fs = require('fs');
const path = require('path');

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

function parsePolicyDeadlines(md) {
  if (!md) {
    return null;
  }
  // Example line:
  // - Target SDK 35 (mobile): required for releases after 2025-08-31; hard-stop after 2025-11-01 without extension
  const re =
    /Target\s+SDK\s+(\d+)[^\n]*?after\s+(\d{4}-\d{2}-\d{2});\s*hard-stop\s+after\s+(\d{4}-\d{2}-\d{2})/i;
  const m = md.match(re);
  if (!m) return null;
  const [, requiredStr, requiredAfter, hardStopAfter] = m;
  return {
    requiredTarget: Number(requiredStr),
    requiredAfter, // inclusive gate after this date
    hardStopAfter,
  };
}

function readPolicy() {
  const p = path.join(
    process.cwd(),
    'docs',
    'compliance',
    'policy-deadlines.md'
  );
  const md = readTextSafe(p);
  const parsed = parsePolicyDeadlines(md);
  if (parsed) return parsed;
  // Fallback defaults if parsing fails
  return {
    requiredTarget: 35,
    requiredAfter: '2025-08-31',
    hardStopAfter: '2025-11-01',
  };
}

function parseIntSafe(s) {
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function detectFromGradle() {
  const gradlePaths = [
    path.join(process.cwd(), 'android', 'app', 'build.gradle'),
    path.join(process.cwd(), 'android', 'app', 'build.gradle.kts'),
  ];
  for (const p of gradlePaths) {
    const txt = readTextSafe(p);
    if (!txt) continue;
    // Groovy: targetSdkVersion 35
    const m1 = txt.match(/targetSdkVersion\s+(\d+)/);
    if (m1) return parseIntSafe(m1[1]);
    // Kotlin DSL: targetSdk = 35
    const m2 = txt.match(/targetSdk\s*=\s*(\d+)/);
    if (m2) return parseIntSafe(m2[1]);
  }
  return null;
}

function detectFromExpoConfigProgrammatic() {
  // Attempt to require app.config.cjs which exports a function ({config}) => object
  try {
    const cfgFactory = require(path.join(process.cwd(), 'app.config.cjs'));
    const cfg =
      typeof cfgFactory === 'function'
        ? cfgFactory({ config: {} })
        : cfgFactory;
    const plugins = cfg?.plugins ?? [];
    for (const entry of plugins) {
      if (Array.isArray(entry) && entry[0] === 'expo-build-properties') {
        const pluginCfg = entry[1];
        const v = pluginCfg?.android?.targetSdkVersion;
        if (typeof v === 'number') return v;
      }
    }
  } catch {
    // ignore
  }
  return null;
}

function detectFromExpoConfigRegex() {
  const p = path.join(process.cwd(), 'app.config.cjs');
  const txt = readTextSafe(p);
  if (!txt) return null;
  // Narrow the search to the expo-build-properties block if possible
  const blockMatch = txt.match(/['\"]expo-build-properties['\"][\s\S]*?\]/);
  const source = blockMatch ? blockMatch[0] : txt;
  const m = source.match(/targetSdkVersion\s*:\s*(\d+)/);
  if (m) return parseIntSafe(m[1]);
  return null;
}

function detectTargetSdk() {
  return (
    detectFromGradle() ??
    detectFromExpoConfigProgrammatic() ??
    detectFromExpoConfigRegex()
  );
}

function isoToday() {
  // Allow override for testing (YYYY-MM-DD)
  const override = process.env.POLICY_OVERRIDE_DATE;
  if (override && /^\d{4}-\d{2}-\d{2}$/.test(override)) return override;
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function compareIso(a, b) {
  // return a - b in lex order since YYYY-MM-DD
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

function evaluateCompliance(policy, configured, today) {
  const msgs = [];
  let ok = true;
  let status = 'pass';

  if (configured == null) {
    msgs.push(
      'Unable to detect targetSdkVersion. Ensure either android/app/build.gradle exists or expo-build-properties plugin sets android.targetSdkVersion.'
    );
  }

  const required = policy.requiredTarget ?? 35;
  const isPastRequired = compareIso(today, policy.requiredAfter) > 0;
  const isPastHardStop = compareIso(today, policy.hardStopAfter) > 0;

  if (isPastRequired) {
    if (configured == null || configured < required) {
      ok = false;
      status = 'fail';
      msgs.push(
        `Target SDK policy gate: required >= ${required} for releases after ${policy.requiredAfter}. Detected: ${configured ?? 'unknown'}.`
      );
      msgs.push(
        'Remediation: In Expo managed apps, set targetSdkVersion in app.config.cjs via the expo-build-properties plugin (android.targetSdkVersion = 35). For bare apps, update android/app/build.gradle to targetSdkVersion 35. Re-run prebuild if needed.'
      );
      if (isPastHardStop) {
        msgs.push(
          `Hard-stop window has begun (after ${policy.hardStopAfter}). Submissions may be rejected until compliant.`
        );
      }
    }
  } else {
    status = 'warn';
    msgs.push(
      `Upcoming policy: Target SDK ${required} required after ${policy.requiredAfter}. Current detected: ${configured ?? 'unknown'}.`
    );
  }

  return { ok, status, messages: msgs, required };
}

function buildReport({ policy, configured, today, evaluation }) {
  return {
    ok: evaluation.ok,
    status: evaluation.status,
    configuredTargetSdk: configured ?? null,
    requiredTargetSdk: evaluation.required,
    enforcement: {
      requiredAfter: policy.requiredAfter,
      hardStopAfter: policy.hardStopAfter,
      today,
    },
    messages: evaluation.messages,
    remediation:
      'Set android.targetSdkVersion = 35 (expo-build-properties) or targetSdkVersion 35 in Gradle. Ensure release variants meet policy.',
    policyRef: 'docs/compliance/policy-deadlines.md',
  };
}

function writeReport(reportDir, report) {
  const outPath = path.join(reportDir, 'target-api-gate.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  return outPath;
}

function main() {
  const policy = readPolicy();
  const reportDir = path.join(process.cwd(), 'build', 'reports', 'compliance');
  ensureDir(reportDir);

  const configured = detectTargetSdk();
  const today = isoToday();
  const evaluation = evaluateCompliance(policy, configured, today);
  const report = buildReport({ policy, configured, today, evaluation });
  const outPath = writeReport(reportDir, report);

  if (!evaluation.ok) {
    console.error('[target-api-gate] FAIL');
    console.error(evaluation.messages.join('\n'));
    console.error('Report: ' + outPath);
    process.exit(1);
  }

  const header =
    evaluation.status === 'warn'
      ? '[target-api-gate] WARN'
      : '[target-api-gate] OK';
  console.log(header);
  if (evaluation.messages.length) console.log(evaluation.messages.join('\n'));
  console.log('Report: ' + outPath);
}

try {
  main();
} catch (e) {
  console.error('[target-api-gate] ERROR: ' + (e?.message || String(e)));
  process.exit(2);
}
