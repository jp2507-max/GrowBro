#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const {
  loadConfig,
  runCannabisComplianceScan,
  generateMarkdownReport,
  ensureDir,
} = require('./lib/cannabis-policy');

function resolveReportPaths(repoRoot, config) {
  const defaultDir = path.join(repoRoot, 'build', 'reports', 'compliance');
  const jsonPath =
    config.report && config.report.json
      ? path.join(repoRoot, config.report.json)
      : path.join(defaultDir, 'cannabis-policy.json');
  const markdownPath =
    config.report && config.report.markdown
      ? path.join(repoRoot, config.report.markdown)
      : path.join(defaultDir, 'cannabis-policy.md');
  return { jsonPath, markdownPath };
}

function writeReport(jsonPath, markdownPath, report) {
  ensureDir(path.dirname(jsonPath));
  ensureDir(path.dirname(markdownPath));
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  fs.writeFileSync(markdownPath, generateMarkdownReport(report));
}

function main() {
  try {
    const repoRoot = process.cwd();
    const config = loadConfig(repoRoot);
    const report = runCannabisComplianceScan({ repoRoot, config });
    const { jsonPath, markdownPath } = resolveReportPaths(repoRoot, config);
    writeReport(jsonPath, markdownPath, report);

    if (!report.ok) {
      console.error('Cannabis policy compliance violations detected.');
      report.violations.forEach((violation) => {
        const location = violation.filePath ? ` (${violation.filePath})` : '';
        console.error(
          `- [${violation.ruleId}] ${violation.message}${location}`
        );
      });
      process.exit(1);
    }
    console.log(`Cannabis policy compliance OK. Report written to ${jsonPath}`);
  } catch (error) {
    console.error(
      `[cannabis-scan] fatal error: ${(error && error.message) || error}`
    );
    process.exit(2);
  }
}

main();
