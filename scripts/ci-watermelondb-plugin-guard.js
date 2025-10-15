#!/usr/bin/env node
/**
 * CI Guard: WatermelonDB Expo Plugin Configuration
 *
 * Ensures @morrowdigital/watermelondb-expo-plugin is configured in app.config.cjs
 * to prevent accidental removal that would break the inventory feature.
 *
 * Requirements:
 * - Task 2: Add CI check that WatermelonDB plugin is configured
 * - Plugin enables JSI adapter for native performance (requires development build)
 *
 * Exit codes:
 * - 0: Plugin is properly configured
 * - 1: Plugin missing or misconfigured
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
 * Reads and parses an Expo config file
 * @param {string} configPath - Path to the config file
 * @returns {object} Parsed config object
 * @throws {Error} If reading or parsing fails
 */
function readExpoConfig(configPath) {
  const isJson = path.extname(configPath) === '.json';

  try {
    if (isJson) {
      // For JSON files, read and parse
      const content = fs.readFileSync(configPath, 'utf-8');
      return JSON.parse(content);
    } else {
      // For JS/TS/CJS files, use require
      // Clear require cache to ensure fresh read
      delete require.cache[require.resolve(configPath)];
      return require(configPath);
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

function checkWatermelonDBPlugin() {
  console.log('🔍 Checking WatermelonDB Expo plugin configuration...\n');

  let hasErrors = false;
  let appConfigPath;

  // Find and read Expo config file
  try {
    appConfigPath = findExpoConfigFile();
    console.log(
      `📄 Found Expo config: ${path.relative(process.cwd(), appConfigPath)}`
    );

    const appConfig = readExpoConfig(appConfigPath);

    // Check if it's a function (dynamic config) or object (static config)
    const configObj =
      typeof appConfig === 'function' ? appConfig({}) : appConfig;

    // Check plugins array
    const plugins = configObj.plugins || [];
    const hasWatermelonPlugin = plugins.some((plugin) => {
      if (typeof plugin === 'string') {
        return plugin === '@morrowdigital/watermelondb-expo-plugin';
      }
      if (Array.isArray(plugin)) {
        return plugin[0] === '@morrowdigital/watermelondb-expo-plugin';
      }
      return false;
    });

    if (!hasWatermelonPlugin) {
      console.error(
        `❌ ERROR: @morrowdigital/watermelondb-expo-plugin missing from ${path.basename(appConfigPath)} plugins array`
      );
      console.error(
        '   This plugin is REQUIRED for inventory feature (enables JSI adapter)'
      );
      console.error(
        "   Add '@morrowdigital/watermelondb-expo-plugin' to the plugins array\n"
      );
      hasErrors = true;
    } else {
      console.log(
        `✅ WatermelonDB plugin found in ${path.basename(appConfigPath)} plugins array`
      );
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

    if (!deps['@morrowdigital/watermelondb-expo-plugin']) {
      console.error(
        '❌ ERROR: @morrowdigital/watermelondb-expo-plugin missing from package.json'
      );
      console.error(
        '   Install: npx expo install @morrowdigital/watermelondb-expo-plugin\n'
      );
      hasErrors = true;
    } else {
      console.log('✅ WatermelonDB plugin found in package.json dependencies');
    }

    if (!deps['@nozbe/watermelondb']) {
      console.error('❌ ERROR: @nozbe/watermelondb missing from package.json');
      console.error('   Install: npx expo install @nozbe/watermelondb\n');
      hasErrors = true;
    } else {
      console.log('✅ WatermelonDB core found in package.json dependencies');
    }
  } catch (error) {
    console.error(`❌ ERROR: Could not read ${PACKAGE_JSON_PATH}`);
    console.error(`   ${error.message}\n`);
    hasErrors = true;
  }

  if (hasErrors) {
    console.error('\n❌ WatermelonDB plugin configuration check FAILED');
    console.error(
      '\nIMPORTANT: The inventory feature requires WatermelonDB with JSI adapter.'
    );
    console.error('This requires a development build (not Expo Go).');
    console.error('\nSee docs/watermelondb-setup.md for setup instructions.\n');
    process.exit(1);
  }

  console.log('\n✅ WatermelonDB plugin configuration check PASSED');
  console.log(
    '   Note: Development build required for native JSI adapter support\n'
  );
}

checkWatermelonDBPlugin();
