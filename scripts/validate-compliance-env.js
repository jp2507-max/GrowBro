#!/usr/bin/env node

/**
 * Compliance Environment Variables Validation Script
 *
 * This script validates that all required environment variables for compliance
 * documents are properly populated before production deployment.
 *
 * Usage:
 *   node scripts/validate-compliance-env.js [environment]
 *
 * Examples:
 *   node scripts/validate-compliance-env.js production
 *   node scripts/validate-compliance-env.js staging
 */

const fs = require('fs');
const path = require('path');

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  bold: '\x1b[1m',
};

const log = {
  error: (msg) => console.error(`${colors.red}❌ ${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  warn: (msg) => console.warn(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`),
  header: (msg) => console.log(`\n${colors.bold}${msg}${colors.reset}\n`),
};

// Required environment variables for compliance
const REQUIRED_VARS = {
  LEGAL_ENTITY_ADDRESS: {
    description: 'Complete legal address of the data controller',
    example: 'GrowBro GmbH, Musterstrasse 123, 10115 Berlin, Germany',
    critical: true,
  },
  DPO_EMAIL: {
    description: 'Data Protection Officer email address',
    example: 'jan-blohm@gmx.de',
    critical: true,
    validate: (value) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(value);
    },
  },
  DPO_NAME: {
    description: 'Data Protection Officer full name',
    example: 'Jan Blohm',
    critical: true,
  },
  EU_REPRESENTATIVE_ADDRESS: {
    description: 'EU representative address (if controller is outside EU)',
    example: 'EU Representative Name, Address, City, Country',
    critical: false,
    optional: true,
  },
  DSA_TRANSPARENCY_DB_URL: {
    description: 'European Commission DSA Transparency Database API URL',
    example: 'https://transparency.dsa.ec.europa.eu/api/v1',
    critical: true,
  },
  DSA_TRANSPARENCY_DB_API_KEY: {
    description: 'DSA Transparency Database API key',
    example: '[SECRET]',
    critical: true,
  },
  PII_SCRUBBING_SALT: {
    description: 'Cryptographic salt for PII pseudonymization',
    example: '[64-character hex string]',
    critical: true,
    validate: (value) => {
      // Should be a long hex string (at least 32 chars)
      return value.length >= 32 && /^[0-9a-fA-F]+$/.test(value);
    },
  },
  PII_SALT_VERSION: {
    description: 'PII salt version identifier',
    example: '1.0',
    critical: true,
  },
};

// Placeholder patterns that indicate missing values
const PLACEHOLDER_PATTERNS = [
  /\[.*required.*\]/i,
  /\[.*to be filled.*\]/i,
  /\[.*missing.*\]/i,
  /\[generate.*\]/i,
  /\[production.*\]/i,
  /^\s*$/, // Empty or whitespace only
];

/**
 * Check if a value looks like a placeholder
 */
function isPlaceholder(value) {
  if (!value) return true;
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(value));
}

/**
 * Load environment variables from .env file
 */
function loadEnvFile(envName) {
  const envPath = path.resolve(__dirname, '..', `.env.${envName}`);

  if (!fs.existsSync(envPath)) {
    log.error(`Environment file not found: .env.${envName}`);
    log.info(`Expected path: ${envPath}`);
    return null;
  }

  const envContent = fs.readFileSync(envPath, 'utf8');
  const envVars = {};

  envContent.split('\n').forEach((line) => {
    line = line.trim();
    if (!line || line.startsWith('#')) return;

    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["']|["']$/g, ''); // Remove quotes
      envVars[key] = value;
    }
  });

  return envVars;
}

/**
 * Validate a single environment variable
 */
function validateVar(name, config, value) {
  const errors = [];
  const warnings = [];

  // Check if value is missing or placeholder
  if (!value || isPlaceholder(value)) {
    if (config.critical && !config.optional) {
      errors.push(`${name} is missing or contains a placeholder value`);
    } else if (config.optional) {
      warnings.push(`${name} is optional but not set`);
    }
    return { valid: !config.critical || config.optional, errors, warnings };
  }

  // Run custom validation if provided
  if (config.validate && !config.validate(value)) {
    errors.push(`${name} has an invalid format`);
    return { valid: false, errors, warnings };
  }

  return { valid: true, errors, warnings };
}

/**
 * Check compliance documents for remaining placeholders
 */
function checkComplianceDocuments() {
  log.header('Checking compliance documents for placeholders...');

  const complianceDir = path.resolve(__dirname, '..', 'compliance');
  const ropaPath = path.join(complianceDir, 'ropa-entries.json');
  const retentionPath = path.join(complianceDir, 'retention-schedule.json');

  // Check RoPA entries
  if (!fs.existsSync(ropaPath)) {
    log.error('RoPA entries file not found');
    return false;
  }

  // Check retention schedule
  if (!fs.existsSync(retentionPath)) {
    log.error('Retention schedule file not found');
    return false;
  }

  const ropaContent = fs.readFileSync(ropaPath, 'utf8');
  const retentionContent = fs.readFileSync(retentionPath, 'utf8');
  const allContent = ropaContent + '\n' + retentionContent;

  const placeholderMatches = allContent.match(/\$\{[A-Z_]+\}/g);

  if (placeholderMatches && placeholderMatches.length > 0) {
    log.warn(
      'Found environment variable placeholders in compliance documents:'
    );
    const uniquePlaceholders = [...new Set(placeholderMatches)];
    uniquePlaceholders.forEach((placeholder) => {
      log.info(`  ${placeholder}`);
    });
    log.info('\nThese will be replaced at runtime from environment variables.');
    return true;
  }

  const deprecatedPlaceholders = allContent.match(/\[To be filled\]/g);
  if (deprecatedPlaceholders && deprecatedPlaceholders.length > 0) {
    log.error(
      'Found deprecated "[To be filled]" placeholders in compliance documents'
    );
    log.info(
      'Please replace with environment variable references: ${VAR_NAME}'
    );
    return false;
  }

  log.success('No deprecated placeholders found in compliance documents');
  return true;
}

/**
 * Main validation function
 */
function validateEnvironment(envName) {
  log.header(`🔍 Validating ${envName} environment for compliance`);

  // Load environment variables
  const envVars = loadEnvFile(envName);
  if (!envVars) {
    process.exit(1);
  }

  // Validate each required variable
  let hasErrors = false;
  let hasWarnings = false;

  Object.entries(REQUIRED_VARS).forEach(([name, config]) => {
    const value = envVars[name];
    const result = validateVar(name, config, value);

    if (result.errors.length > 0) {
      hasErrors = true;
      log.error(`${name}:`);
      result.errors.forEach((err) => log.info(`  - ${err}`));
      log.info(`  Description: ${config.description}`);
      log.info(`  Example: ${config.example}`);
      console.log('');
    } else if (result.warnings.length > 0) {
      hasWarnings = true;
      result.warnings.forEach((warn) => log.warn(warn));
    } else {
      log.success(`${name} is valid`);
    }
  });

  // Check compliance documents
  console.log('');
  const docsValid = checkComplianceDocuments();

  // Summary
  log.header('Validation Summary');
  if (hasErrors) {
    log.error(`Environment validation FAILED for ${envName}`);
    log.info('\nPlease fix the errors above before deploying to production.');
    log.info(
      'See compliance/README-env-variables.md for detailed instructions.'
    );
    process.exit(1);
  } else if (hasWarnings) {
    log.warn(`Environment validation completed with warnings for ${envName}`);
    log.info(
      '\nOptional variables are not set. This may be acceptable depending on your setup.'
    );
    process.exit(0);
  } else if (!docsValid) {
    log.error('Compliance documents contain invalid placeholders');
    process.exit(1);
  } else {
    log.success(`All required environment variables are valid for ${envName}`);
    log.info('\n✨ Environment is ready for deployment!');
    process.exit(0);
  }
}

// CLI Entry point
const envName = process.argv[2] || 'production';

if (!['development', 'staging', 'production'].includes(envName)) {
  log.error(`Invalid environment: ${envName}`);
  log.info('Valid environments: development, staging, production');
  process.exit(1);
}

validateEnvironment(envName);
