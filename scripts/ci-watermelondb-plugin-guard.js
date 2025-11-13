#!/usr/bin/env node
/**
 * CI Guard: WatermelonDB Native Configuration
 *
 * Ensures the required native configuration for WatermelonDB is present when using
 * Expo SDK 54+:
 *   - expo-build-properties plugin declared
 *   - ios.extraPods includes simdjson pod with modular headers
 *   - android.packagingOptions.pickFirst includes libc++_shared.so
 *   - '@nozbe/watermelondb' and '@nozbe/simdjson' dependencies installed
 *   - legacy '@morrowdigital/watermelondb-expo-plugin' dependency NOT present
 *
 * Exit codes:
 * - 0: configuration is valid
 * - 1: configuration missing or misconfigured
 */

const fs = require('fs');
const path = require('path');

const PACKAGE_JSON_PATH = path.join(__dirname, '..', 'package.json');

// List of common Expo config filenames to check in order of preference
const EXPO_CONFIG_CANDIDATES = [
  'app.config.cjs',
  'app.config.js',
  'app.config.ts',
  'app.json',
];

/**
 * Finds the first existing Expo config file from a list of candidates
 * @returns {string} Path to the existing config file
 * @throws {Error} If no config file is found
 */
function findExpoConfigFile() {
  const projectRoot = path.join(__dirname, '..');

  for (const candidate of EXPO_CONFIG_CANDIDATES) {
    const configPath = path.join(projectRoot, candidate);
    try {
      if (fs.existsSync(configPath)) {
        return configPath;
      }
    } catch (_error) {
      // Continue to next candidate if this one fails
      continue;
    }
  }

  // No config file found
  const triedPaths = EXPO_CONFIG_CANDIDATES.map((candidate) =>
    path.join(projectRoot, candidate)
  );
  throw new Error(
    `No Expo config file found. Tried:\n${triedPaths.map((p) => `  - ${p}`).join('\n')}\n\n` +
      'Please ensure you have one of the following files in your project root:\n' +
      '  - app.config.cjs (CommonJS)\n' +
      '  - app.config.js (JavaScript)\n' +
      '  - app.config.ts (TypeScript)\n' +
      '  - app.json (JSON)\n\n' +
      'See Expo documentation for config file setup: https://docs.expo.dev/workflow/configuration/'
  );
}

/**
 * Reads and parses an Expo config file safely
 * @param {string} configPath - Path to the config file
 * @returns {object} Parsed config object or fallback with source text
 * @throws {Error} If reading fails completely
 */
function readExpoConfig(configPath) {
  const isJson = path.extname(configPath) === '.json';

  try {
    if (isJson) {
      // For JSON files, read and parse
      const content = fs.readFileSync(configPath, 'utf-8');
      return JSON.parse(content);
    } else {
      // For JS/TS/CJS files, try require; fallback to text scanning on failure
      try {
        // Clear require cache to ensure fresh read
        delete require.cache[require.resolve(configPath)];
        return require(configPath);
      } catch (_requireError) {
        // If require fails (TS/ESM issues), read as text for plugin scanning
        const content = fs.readFileSync(configPath, 'utf-8');
        return { __source: content };
      }
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`Config file not found: ${configPath}`);
    }
    if (error instanceof SyntaxError) {
      throw new Error(
        `Failed to parse ${isJson ? 'JSON' : 'JavaScript'} config file: ${configPath}\n` +
          `Parse error: ${error.message}`
      );
    }
    throw new Error(
      `Failed to read config file: ${configPath}\n` + `Error: ${error.message}`
    );
  }
}

function guardWatermelonConfiguration() {
  console.log('🔍 Checking WatermelonDB native configuration...\n');

  let hasErrors = false;
  let appConfigPath;

  // Find and read Expo config file
  try {
    appConfigPath = findExpoConfigFile();
    console.log(
      `📄 Found Expo config: ${path.relative(process.cwd(), appConfigPath)}`
    );

    const appConfig = readExpoConfig(appConfigPath);
    const configObj =
      typeof appConfig === 'function' ? appConfig({}) : appConfig;

    const plugins =
      (Array.isArray(configObj.plugins) && configObj.plugins) ||
      (Array.isArray(configObj.expo?.plugins) && configObj.expo.plugins) ||
      [];

    const buildPropsEntry = plugins.find((plugin) => {
      if (typeof plugin === 'string') {
        return plugin === 'expo-build-properties';
      }
      if (Array.isArray(plugin)) {
        return plugin[0] === 'expo-build-properties';
      }
      return false;
    });

    if (!buildPropsEntry) {
      console.error(
        '❌ ERROR: expo-build-properties plugin is missing from app.config. Add it to configure native build settings.'
      );
      hasErrors = true;
    } else {
      console.log('✅ expo-build-properties plugin declared');

      const buildPropsConfig = Array.isArray(buildPropsEntry)
        ? buildPropsEntry[1] || {}
        : {};

      const iosPods = buildPropsConfig?.ios?.extraPods ?? [];
      const hasSimdjsonPod = iosPods.some((pod) => {
        if (typeof pod !== 'object' || !pod) return false;
        return (
          pod.name === 'simdjson' &&
          typeof pod.path === 'string' &&
          pod.path.includes('@nozbe/simdjson') &&
          pod.modular_headers === true
        );
      });

      if (!hasSimdjsonPod) {
        console.error(
          '❌ ERROR: expo-build-properties ios.extraPods must declare the simdjson pod with modular_headers: true.'
        );
        hasErrors = true;
      } else {
        console.log('✅ simdjson pod configured via ios.extraPods');
      }

      const pickFirstEntries =
        buildPropsConfig?.android?.packagingOptions?.pickFirst ?? [];
      const hasLibcxxPickFirst = pickFirstEntries.includes(
        '**/libc++_shared.so'
      );

      if (!hasLibcxxPickFirst) {
        console.error(
          '❌ ERROR: expo-build-properties android.packagingOptions.pickFirst must include "**/libc++_shared.so".'
        );
        hasErrors = true;
      } else {
        console.log('✅ Android pickFirst for libc++_shared configured');
      }
    }
  } catch (error) {
    console.error(`❌ ERROR: ${error.message}\n`);
    hasErrors = true;
  }

  // Check package.json dependencies
  try {
    const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf-8'));
    const deps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    const hasWatermelon = Boolean(deps['@nozbe/watermelondb']);
    const hasSimdjson = Boolean(deps['@nozbe/simdjson']);
    const hasLegacyPlugin = Boolean(
      deps['@morrowdigital/watermelondb-expo-plugin']
    );

    if (!hasWatermelon) {
      console.error(
        '❌ ERROR: @nozbe/watermelondb missing from package.json dependencies. Install it with `npx expo install @nozbe/watermelondb`.'
      );
      hasErrors = true;
    } else {
      console.log('✅ @nozbe/watermelondb dependency present');
    }

    if (!hasSimdjson) {
      console.error(
        '❌ ERROR: @nozbe/simdjson missing from package.json dependencies. Install it with `npx expo install @nozbe/simdjson`.'
      );
      hasErrors = true;
    } else {
      console.log('✅ @nozbe/simdjson dependency present');
    }

    if (hasLegacyPlugin) {
      console.error(
        '❌ ERROR: Legacy @morrowdigital/watermelondb-expo-plugin dependency detected. Remove it to avoid conflicting configuration.'
      );
      hasErrors = true;
    } else {
      console.log('✅ Legacy WatermelonDB Expo plugin not present');
    }
  } catch (error) {
    console.error(`❌ ERROR: Could not read ${PACKAGE_JSON_PATH}`);
    console.error(`   ${error.message}\n`);
    hasErrors = true;
  }

  if (hasErrors) {
    console.error('\n❌ WatermelonDB native configuration check FAILED');
    console.error(
      '\nRemediation steps:\n' +
        '  • Declare expo-build-properties in app.config and add ios.extraPods entry for simdjson\n' +
        '  • Ensure android.packagingOptions.pickFirst includes "**/libc++_shared.so"\n' +
        '  • Install @nozbe/watermelondb and @nozbe/simdjson\n' +
        '  • Remove @morrowdigital/watermelondb-expo-plugin if still listed\n'
    );
    console.error('This app requires a development build (expo-dev-client).');
    console.error('\nSee docs/watermelondb-setup.md for setup instructions.\n');
    process.exit(1);
  }

  console.log('\n✅ WatermelonDB native configuration check PASSED');
  console.log('   Note: Run expo prebuild after changing native config.\n');
}

guardWatermelonConfiguration();
