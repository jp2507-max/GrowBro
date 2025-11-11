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

function validateOutputDir(dir) {
  // Reject empty values, root directory, or home directory
  if (!dir || dir === '/' || dir.startsWith('~')) {
    throw new Error(
      `Invalid output directory: ${dir}. Cannot delete system root or home directory.`
    );
  }

  const projectRoot = process.cwd();
  const resolvedDir = path.resolve(dir);

  // Ensure the resolved path is within the project root or a safe build directory
  const isInProjectRoot =
    resolvedDir.startsWith(projectRoot + path.sep) ||
    resolvedDir === projectRoot;
  const isInBuildDir = resolvedDir.startsWith(
    path.join(projectRoot, 'build') + path.sep
  );

  if (!isInProjectRoot && !isInBuildDir) {
    throw new Error(
      `Output directory ${resolvedDir} is outside the safe project directory. Only paths within the project root or build/ directory are allowed.`
    );
  }
}

function exportBundle() {
  const env = {
    ...process.env,
    APP_ENV: process.env.APP_ENV ?? 'production',
    EXPO_NO_DOTENV: process.env.EXPO_NO_DOTENV ?? '1',
  };

  // Validate output directory before deletion
  validateOutputDir(outputDir);

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
