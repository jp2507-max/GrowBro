#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const {
  resolveRepoRoot,
  validateSdkDisclosuresWithSdkIndex,
  syncWithPrivacyPolicy,
} = require('./lib/data-safety');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function writeReport(repoRoot, report) {
  const outDir = path.join(repoRoot, 'build', 'reports', 'compliance');
  ensureDir(outDir);
  const outPath = path.join(outDir, 'data-safety-validation.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  return outPath;
}

function main() {
  const repoRoot = resolveRepoRoot();
  const sdkRes = validateSdkDisclosuresWithSdkIndex(repoRoot);
  const syncRes = syncWithPrivacyPolicy(repoRoot);
  // Staleness check: docs/data-safety-draft.json must exist and be newer than compliance sources
  const problems = [...sdkRes.problems, ...syncRes.problems];
  const fs = require('fs');
  const path = require('path');
  const draftPath = path.join(repoRoot, 'docs', 'data-safety-draft.json');
  const sources = [
    path.join(repoRoot, 'compliance', 'data-inventory.json'),
    path.join(repoRoot, 'compliance', 'sdk-index.json'),
    path.join(repoRoot, 'compliance', 'privacy-policy.json'),
  ];
  if (!fs.existsSync(draftPath)) {
    problems.push({
      type: 'missing-draft',
      message:
        'docs/data-safety-draft.json missing. Run: pnpm run data-safety:generate',
    });
  } else {
    const draftMtime = fs.statSync(draftPath).mtimeMs;
    const newestSourceMtime = Math.max(
      ...sources.map((p) => (fs.existsSync(p) ? fs.statSync(p).mtimeMs : 0))
    );
    if (draftMtime < newestSourceMtime) {
      problems.push({
        type: 'stale-draft',
        message:
          'docs/data-safety-draft.json is older than compliance sources. Regenerate with pnpm run data-safety:generate',
      });
    }
  }

  const ok = sdkRes.ok && syncRes.ok && problems.length === 0;
  const report = {
    ok,
    problems,
    draftSummaryCount: syncRes.draftSummaryCount,
    privacyPolicyUrl: syncRes.policy?.privacyPolicyUrl,
    accountDeletionUrl: syncRes.policy?.accountDeletionUrl,
  };

  const outPath = writeReport(repoRoot, report);
  if (!ok) {
    console.error(`Data Safety validation failed. See ${outPath}`);
    for (const p of report.problems) console.error(`- ${p.type}: ${p.message}`);
    process.exit(1);
  }
  console.log(`Data Safety validation OK. Report at ${outPath}`);
}

try {
  main();
} catch (err) {
  console.error(`[ci-data-safety-validate] FAIL: ${err.message}`);
  process.exit(1);
}
