// Minimal static checks for Apple Privacy Manifest and Required-Reason APIs
// Run via: pnpm run privacy:validate

const fs = require('fs');
const path = require('path');

// Define repoRoot at module level so it's available to all functions
const repoRoot = path.resolve(__dirname, '..');

function readJson(filePath) {
  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) throw new Error(`Missing file: ${filePath}`);
  const raw = fs.readFileSync(abs, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (e) {
    throw new Error(`Invalid JSON in ${filePath}: ${e.message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function validateManifestStructure(manifest) {
  assert(
    Array.isArray(manifest.NSPrivacyCollectedDataTypes),
    'NSPrivacyCollectedDataTypes must be an array'
  );
  assert(
    Array.isArray(manifest.NSPrivacyAccessedAPITypes),
    'NSPrivacyAccessedAPITypes must be an array'
  );
}

function validateAccessedApiReasons(manifest) {
  const allowedReasons = {
    NSPrivacyAccessedAPICategoryUserDefaults: new Set(['CA92.1']),
    NSPrivacyAccessedAPICategorySystemBootTime: new Set(['35F9.1']),
    NSPrivacyAccessedAPICategoryFileTimestamp: new Set(['C617.1']),
  };

  for (const entry of manifest.NSPrivacyAccessedAPITypes) {
    assert(
      typeof entry.NSPrivacyAccessedAPIType === 'string',
      'Each NSPrivacyAccessedAPITypes entry must have NSPrivacyAccessedAPIType'
    );
    assert(
      Array.isArray(entry.NSPrivacyAccessedAPITypeReasons) &&
        entry.NSPrivacyAccessedAPITypeReasons.length > 0,
      'Each NSPrivacyAccessedAPITypes entry must include NSPrivacyAccessedAPITypeReasons with at least one code'
    );

    const cat = entry.NSPrivacyAccessedAPIType;
    if (allowedReasons[cat]) {
      for (const reason of entry.NSPrivacyAccessedAPITypeReasons) {
        assert(
          allowedReasons[cat].has(reason),
          `Invalid Required-Reason code '${reason}' for category '${cat}'.`
        );
      }
    } else {
      // Unknown category present; warn but do not fail to allow expansion.
      console.warn(
        `[privacy:validate] Warning: Unknown API category '${cat}'. Please verify its reason codes.`
      );
    }
  }
}

function assertAppConfigWiresManifest() {
  // We use CommonJS Expo config in this repo
  const appConfigPath = path.join(repoRoot, 'app.config.cjs');
  if (!fs.existsSync(appConfigPath)) {
    throw new Error('Expected app.config.cjs to be present in repo root');
  }
  const appConfig = fs.readFileSync(appConfigPath, 'utf8');
  assert(
    appConfig.includes('privacyManifests'),
    'app.config.cjs must include the ios.privacyManifests configuration'
  );
}

function verifyDependencySnapshot() {
  const pkgPath = path.join(repoRoot, 'package.json');
  const pkg = readJson(pkgPath);
  const deps = Object.keys(pkg.dependencies || {}).sort();

  const snapshotPath = path.join(
    repoRoot,
    'docs',
    'privacy-manifest-deps.json'
  );
  if (!fs.existsSync(snapshotPath)) {
    throw new Error(
      'Missing docs/privacy-manifest-deps.json snapshot. Run: pnpm run privacy:snapshot'
    );
  }
  const snapshot = readJson(snapshotPath);
  const snapDeps = Array.isArray(snapshot.dependencies)
    ? snapshot.dependencies.slice().sort()
    : [];

  const a = JSON.stringify(deps);
  const b = JSON.stringify(snapDeps);
  assert(
    a === b,
    'Dependency snapshot out of date. Update docs/privacy-manifest-deps.json by running: pnpm run privacy:snapshot'
  );
}

function main() {
  // 1) Validate manifest presence and structure
  const manifestPath = path.join(repoRoot, 'apple-privacy-manifest.json');
  const manifest = readJson(manifestPath);
  validateManifestStructure(manifest);

  // 2) Validate Accessed API reasons for categories we declare
  validateAccessedApiReasons(manifest);

  // 3) Ensure we wire the manifest in app.config.ts (basic text check)
  assertAppConfigWiresManifest();

  // 4) Dependency change guardrail: ensure snapshot is up to date
  verifyDependencySnapshot();

  console.log('[privacy:validate] OK');
}

try {
  main();
} catch (err) {
  console.error(`[privacy:validate] FAIL: ${err.message}`);
  process.exit(1);
}
