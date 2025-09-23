#!/usr/bin/env node
/* Validate presence of required compliance documentation and artifacts. */
const fs = require('fs');
const path = require('path');

function checkExists(p) {
  return fs.existsSync(p);
}

function main() {
  const root = process.cwd();
  const required = [
    'docs/compliance/play-submission-checklist.md',
    'docs/compliance/compliance-playbook.md',
    'docs/compliance/troubleshooting.md',
    'docs/compliance/policy-deadlines.md',
    'docs/compliance/developer-onboarding-for-compliance.md',
    'compliance/data-inventory.json',
    'compliance/privacy-policy.json',
    'compliance/deletion-methods.json',
    'compliance/sdk-index.json',
  ];
  const missing = required.filter((p) => !checkExists(path.join(root, p)));
  const outDir = path.join(root, 'build', 'reports', 'compliance');
  fs.mkdirSync(outDir, { recursive: true });
  const report = { ok: missing.length === 0, missing };
  const outPath = path.join(outDir, 'docs-validate.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  if (!report.ok) {
    console.error('[compliance:docs:validate] Missing required files:');
    for (const m of missing) console.error('- ' + m);
    process.exit(1);
  }
  console.log('[compliance:docs:validate] OK');
}

try {
  main();
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
