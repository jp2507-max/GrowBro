#!/usr/bin/env node

/**
 * Script to generate SHA-256 certificate fingerprints for Android App Links
 * This script extracts fingerprints from keystores and formats them for assetlinks.json
 *
 * Usage:
 * node scripts/generate-assetlinks-fingerprints.js [environment]
 *
 * Where environment is: production, staging, or development
 *
 * Prerequisites:
 * - Java keytool must be available in PATH
 * - Keystore files must exist at expected locations
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Keystore configurations - update these paths and aliases for your project
const KEYSTORE_CONFIGS = {
  production: {
    path:
      process.env.PRODUCTION_KEYSTORE_PATH ||
      './android/app/production.keystore',
    alias: process.env.PRODUCTION_KEY_ALIAS || 'production',
    password: process.env.PRODUCTION_KEYSTORE_PASSWORD,
  },
  staging: {
    path: process.env.STAGING_KEYSTORE_PATH || './android/app/staging.keystore',
    alias: process.env.STAGING_KEY_ALIAS || 'staging',
    password: process.env.STAGING_KEYSTORE_PASSWORD,
  },
  development: {
    path:
      process.env.DEVELOPMENT_KEYSTORE_PATH || './android/app/debug.keystore',
    alias: process.env.DEVELOPMENT_KEY_ALIAS || 'androiddebugkey',
    password: process.env.DEVELOPMENT_KEYSTORE_PASSWORD || 'android',
  },
};

function validateInputs(keystorePath, alias, password) {
  // Validate inputs
  if (!keystorePath || typeof keystorePath !== 'string') {
    throw new Error('Invalid keystore path: must be a non-empty string');
  }

  if (!alias || typeof alias !== 'string') {
    throw new Error('Invalid alias: must be a non-empty string');
  }

  if (!password || typeof password !== 'string') {
    throw new Error('Invalid password: must be a non-empty string');
  }

  // Validate keystore path exists and is a file
  if (!fs.existsSync(keystorePath)) {
    throw new Error(`Keystore file does not exist: ${keystorePath}`);
  }

  const stats = fs.statSync(keystorePath);
  if (!stats.isFile()) {
    throw new Error(`Keystore path is not a file: ${keystorePath}`);
  }

  // Validate keystore path and alias for allowed characters (prevent command injection)
  const pathRegex = /^[a-zA-Z0-9._\-\\/:]+$/;
  if (!pathRegex.test(keystorePath)) {
    throw new Error('Keystore path contains invalid characters');
  }

  const aliasRegex = /^[a-zA-Z0-9._\-]+$/;
  if (!aliasRegex.test(alias)) {
    throw new Error('Alias contains invalid characters');
  }
}

function executeKeytool(keystorePath, alias, password) {
  // Generate unique environment variable names to avoid conflicts
  const storePassEnv = `KEYTOOL_STOREPASS_${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
  const keyPassEnv = `KEYTOOL_KEYPASS_${crypto.randomBytes(8).toString('hex').toUpperCase()}`;

  // Set environment variables for passwords
  const env = { ...process.env };
  env[storePassEnv] = password;
  env[keyPassEnv] = password;

  // Use spawnSync with array arguments to prevent command injection
  const result = spawnSync(
    'keytool',
    [
      '-list',
      '-v',
      '-keystore',
      keystorePath,
      '-alias',
      alias,
      `-storepass:env=${storePassEnv}`,
      `-keypass:env=${keyPassEnv}`,
    ],
    {
      encoding: 'utf8',
      env: env,
      stdio: 'pipe',
    }
  );

  if (result.error) {
    throw new Error(`keytool execution failed: ${result.error.message}`);
  }

  if (result.status !== 0) {
    const stderr = result.stderr ? result.stderr.trim() : '';
    throw new Error(
      `keytool exited with code ${result.status}${stderr ? `: ${stderr}` : ''}`
    );
  }

  const output = result.stdout;
  if (!output) {
    throw new Error('No output received from keytool');
  }

  // Extract SHA256 fingerprint
  const sha256Match = output.match(/SHA256:\s*([A-F0-9:]+)/i);
  if (!sha256Match) {
    throw new Error('SHA256 fingerprint not found in keytool output');
  }

  // Remove colons and convert to uppercase (Android format)
  return sha256Match[1].replace(/:/g, '').toUpperCase();
}

function sanitizeError(error) {
  // Re-throw with sanitized error message (no sensitive data)
  if (
    error.message.includes('Invalid keystore path') ||
    error.message.includes('Invalid alias') ||
    error.message.includes('Invalid password') ||
    error.message.includes('Keystore file does not exist') ||
    error.message.includes('Keystore path is not a file') ||
    error.message.includes('contains invalid characters')
  ) {
    throw error; // These are safe to re-throw as-is
  }

  // For keytool errors, provide generic message without exposing command details
  throw new Error(
    `Failed to extract fingerprint from keystore: ${error.message}`
  );
}

function getSHA256Fingerprint(keystorePath, alias, password) {
  validateInputs(keystorePath, alias, password);

  try {
    return executeKeytool(keystorePath, alias, password);
  } catch (error) {
    sanitizeError(error);
  }
}

function updateAssetlinksJson(fingerprints) {
  const assetlinksPath = path.join(
    __dirname,
    '..',
    'docs',
    '.well-known',
    'assetlinks.json'
  );

  try {
    const assetlinksContent = fs.readFileSync(assetlinksPath, 'utf8');
    const assetlinksJson = JSON.parse(assetlinksContent);

    // Update fingerprints
    assetlinksJson.forEach((entry) => {
      const packageName = entry.target.package_name;
      let fingerprint = null;

      if (packageName === 'com.growbro') {
        fingerprint = fingerprints.production;
      } else if (packageName === 'com.growbro.staging') {
        fingerprint = fingerprints.staging;
      } else if (packageName === 'com.growbro.development') {
        fingerprint = fingerprints.development;
      }

      if (fingerprint) {
        entry.target.sha256_cert_fingerprints = [fingerprint];
        console.log(`Updated ${packageName} with fingerprint: ${fingerprint}`);
      }
    });

    // Write back to file
    fs.writeFileSync(assetlinksPath, JSON.stringify(assetlinksJson, null, 2));
    console.log('assetlinks.json updated successfully');
  } catch (error) {
    console.error('Error updating assetlinks.json:', error.message);
  }
}

function resolveEnvironments(input) {
  const allowed = Object.keys(KEYSTORE_CONFIGS);
  if (!input) {
    return allowed;
  }
  if (!allowed.includes(input)) {
    console.error('Invalid environment. Use: production, staging, development');
    process.exit(1);
  }
  return [input];
}

function collectFingerprints(environments) {
  console.log('Extracting SHA-256 certificate fingerprints...\n');
  const fingerprints = {};

  for (const env of environments) {
    const config = KEYSTORE_CONFIGS[env];
    console.log(`Processing ${env} keystore...`);

    if (!fs.existsSync(config.path)) {
      console.warn(`Keystore not found: ${config.path}`);
      console.warn(
        `Set ${env.toUpperCase()}_KEYSTORE_PATH environment variable or update script config`
      );
      continue;
    }

    if (!config.password) {
      console.warn(`Password not set for ${env} keystore`);
      console.warn(
        `Set ${env.toUpperCase()}_KEYSTORE_PASSWORD environment variable`
      );
      continue;
    }

    const fingerprint = getSHA256Fingerprint(
      config.path,
      config.alias,
      config.password
    );
    if (fingerprint) {
      fingerprints[env] = fingerprint;
      console.log(`OK ${env}: ${fingerprint}`);
    } else {
      console.log(`FAIL ${env}: Failed to extract fingerprint`);
    }
  }

  return fingerprints;
}

function logManualFingerprintCommands() {
  const filterCmd = process.platform === 'win32' ? 'findstr' : 'grep';

  console.log('\nManual commands to get fingerprints:');
  console.log('# Production:');
  console.log(
    `keytool -list -v -keystore "${KEYSTORE_CONFIGS.production.path}" -alias "${KEYSTORE_CONFIGS.production.alias}" | ${filterCmd} "SHA256:"`
  );
  console.log('# Staging:');
  console.log(
    `keytool -list -v -keystore "${KEYSTORE_CONFIGS.staging.path}" -alias "${KEYSTORE_CONFIGS.staging.alias}" | ${filterCmd} "SHA256:"`
  );
  console.log('# Development:');
  console.log(
    `keytool -list -v -keystore "${KEYSTORE_CONFIGS.development.path}" -alias "${KEYSTORE_CONFIGS.development.alias}" | ${filterCmd} "SHA256:"`
  );
}

function main() {
  const environments = resolveEnvironments(process.argv[2]);
  const fingerprints = collectFingerprints(environments);

  if (Object.keys(fingerprints).length === 0) {
    console.log(
      '\nNo fingerprints extracted. Please check keystore paths and passwords.'
    );
    logManualFingerprintCommands();
    return;
  }

  console.log('\nUpdating assetlinks.json...');
  updateAssetlinksJson(fingerprints);
}

if (require.main === module) {
  main();
}

module.exports = { getSHA256Fingerprint, updateAssetlinksJson };
