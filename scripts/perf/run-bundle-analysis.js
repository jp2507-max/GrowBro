#!/usr/bin/env node
/**
 * Generates a production bundle for a target platform and enforces bundle budgets
 * by parsing the Expo Atlas output.
 *
 * Usage:
 *   node scripts/perf/run-bundle-analysis.js --platform android
 *
 * Environment overrides:
 *   APP_ENV (default: production)
 *   EXPO_NO_DOTENV (default: 1)
 *   BUNDLE_SIZE_BUDGET_KB (default: 3500)
 */
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

function getArg(flag, fallback) {
  const index = process.argv.indexOf(flag);
  if (index !== -1 && process.argv[index + 1]) {
    return process.argv[index + 1];
  }
  return fallback;
}

const platform = getArg('--platform', 'android').toLowerCase();
const outputDir = path.resolve(
  getArg('--output-dir', path.join('build', `bundle-report-${platform}`))
);
const atlasFile = path.resolve(
  getArg('--atlas-file', path.join('.expo', 'atlas.jsonl'))
);

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    env: options.env ?? process.env,
    cwd: options.cwd ?? process.cwd(),
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function ensureAtlasFile() {
  fs.mkdirSync(path.dirname(atlasFile), { recursive: true });
  fs.rmSync(atlasFile, { force: true });
}

function exportBundle() {
  const env = {
    ...process.env,
    APP_ENV: process.env.APP_ENV ?? 'production',
    EXPO_NO_DOTENV: process.env.EXPO_NO_DOTENV ?? '1',
  };

  fs.rmSync(outputDir, { recursive: true, force: true });

  const args = [
    'expo',
    'export',
    '--platform',
    platform,
    '--force',
    '--dump-sourcemap',
    '--dump-assetmap',
    '--output-dir',
    outputDir,
  ];

  console.log(`\n🔧 Exporting ${platform} bundle to ${outputDir}...\n`);
  run('npx', args, { env });
}

function analyzeBundle() {
  const analyzeEnv = {
    ...process.env,
    BUNDLE_PLATFORM: platform,
    ATLAS_FILE: atlasFile,
    BUNDLE_REPORT_OUTPUT: path.join(outputDir, `${platform}-atlas-report.json`),
  };

  console.log('\n📊 Verifying bundle size with Expo Atlas data...\n');
  run('node', [path.join('scripts', 'perf', 'check-atlas-bundle.js')], {
    env: analyzeEnv,
  });
}

ensureAtlasFile();
exportBundle();
analyzeBundle();
