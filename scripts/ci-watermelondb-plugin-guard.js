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

const APP_CONFIG_PATH = path.join(__dirname, '..', 'app.config.cjs');
const PACKAGE_JSON_PATH = path.join(__dirname, '..', 'package.json');

function checkWatermelonDBPlugin() {
  console.log('🔍 Checking WatermelonDB Expo plugin configuration...\n');

  let hasErrors = false;

  // Check app.config.cjs
  try {
    const appConfig = fs.readFileSync(APP_CONFIG_PATH, 'utf-8');

    if (!appConfig.includes('@morrowdigital/watermelondb-expo-plugin')) {
      console.error(
        '❌ ERROR: @morrowdigital/watermelondb-expo-plugin missing from app.config.cjs plugins array'
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
        '✅ WatermelonDB plugin found in app.config.cjs plugins array'
      );
    }
  } catch (error) {
    console.error(`❌ ERROR: Could not read ${APP_CONFIG_PATH}`);
    console.error(`   ${error.message}\n`);
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
