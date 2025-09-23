#!/usr/bin/env node
/*
 Validate a Play Pre-launch-like report and hard-fail on any warnings/security issues.
 Usage: node scripts/ci-prelaunch-validate.js [pathToReport.json]
*/
const fs = require('fs');
const path = require('path');
const { validatePrelaunchReport } = require('./lib/prelaunch');

function readJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    throw new Error(`Failed to read JSON ${p}: ${e?.message || e}`);
  }
}

function main() {
  const input =
    process.argv[2] || path.join('build', 'reports', 'prelaunch.json');
  if (!fs.existsSync(input)) {
    console.error(`[prelaunch] report file not found: ${input}`);
    process.exit(2);
  }
  const report = readJson(input);
  const res = validatePrelaunchReport(report);
  const outDir = path.join(process.cwd(), 'build', 'reports', 'compliance');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'prelaunch-validate.json');
  fs.writeFileSync(outPath, JSON.stringify(res, null, 2));

  if (!res.ok) {
    console.error('Pre-launch validation failed:');
    for (const p of res.problems) {
      console.error(
        `- [${p.ruleId}] ${p.count ? `count=${p.count}` : ''} ${
          p.key ? `key=${p.key}` : ''
        }`
      );
    }
    process.exit(1);
  }
  console.log(`Pre-launch validation OK. Report -> ${outPath}`);
}

try {
  main();
} catch (e) {
  console.error(`[prelaunch] ${e.message}`);
  process.exit(1);
}
