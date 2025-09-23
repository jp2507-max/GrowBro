#!/usr/bin/env node
/* Aggregate compliance artifacts into a single audit report. */
const fs = require('fs');
const path = require('path');

function readJsonSafe(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function main() {
  const root = process.cwd();
  const outDir = path.join(root, 'build', 'reports', 'compliance');
  fs.mkdirSync(outDir, { recursive: true });

  const artifacts = {
    docs: readJsonSafe(path.join(outDir, 'docs-validate.json')),
    manifest: readJsonSafe(path.join(outDir, 'android-manifest-scan.json')),
    dataSafety: readJsonSafe(path.join(outDir, 'data-safety-validation.json')),
    cannabis: readJsonSafe(path.join(outDir, 'cannabis-policy.json')),
    prelaunch: readJsonSafe(path.join(outDir, 'prelaunch-validate.json')),
  };

  const problems = [];
  for (const [key, rep] of Object.entries(artifacts)) {
    if (!rep) continue;
    if (rep.ok === false) problems.push({ component: key, details: rep });
  }

  const ok = problems.length === 0;
  const audit = { ok, problems, generatedAt: new Date().toISOString() };
  const outPath = path.join(outDir, 'compliance-audit.json');
  fs.writeFileSync(outPath, JSON.stringify(audit, null, 2));
  if (!ok) {
    console.error('[compliance:audit] FAIL — see ' + outPath);
    process.exit(1);
  }
  console.log('[compliance:audit] OK — ' + outPath);
}

try {
  main();
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
