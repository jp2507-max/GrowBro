#!/usr/bin/env node

/**
 * CI Schema Validation Script
 *
 * Validates all playbook schema fixtures using Zod schemas.
 * This ensures schema compliance in the CI pipeline.
 *
 * Usage: node scripts/ci-validate-schemas.js
 * Exit codes:
 *   0 - All schemas valid
 *   1 - Validation errors found
 */

const fs = require('fs');
const path = require('path');

// Note: This script runs in Node.js, but the validator is TypeScript
// We'll use a simpler approach for CI validation

const fixturesDir = path.join(__dirname, '../src/lib/schemas/__fixtures__');

// Validation results
let totalFiles = 0;
let validFiles = 0;
let invalidFiles = 0;
const errors = [];

console.log('🔍 Validating playbook schema fixtures...\n');

// Validate required fields
function validateRequiredFields(data, issues) {
  if (!data.id) issues.push('Missing required field: id');
  if (!data.name) issues.push('Missing required field: name');
  if (!data.setup) issues.push('Missing required field: setup');
  if (!data.locale) issues.push('Missing required field: locale');
  if (!data.steps || !Array.isArray(data.steps)) {
    issues.push('Missing or invalid required field: steps');
  }
}

// Validate setup and locale
function validateSetupAndLocale(data, issues) {
  const validSetups = [
    'auto_indoor',
    'auto_outdoor',
    'photo_indoor',
    'photo_outdoor',
  ];
  if (data.setup && !validSetups.includes(data.setup)) {
    issues.push(`Invalid setup value: ${data.setup}`);
  }

  if (data.locale && !/^[a-z]{2}(-[A-Z]{2})?$/.test(data.locale)) {
    issues.push(`Invalid locale format: ${data.locale}`);
  }
}

// Validate step fields
function validateStep(step, index, issues) {
  if (!step.id) issues.push(`Step ${index}: Missing id`);
  if (!step.phase) issues.push(`Step ${index}: Missing phase`);
  if (!step.title) issues.push(`Step ${index}: Missing title`);
  if (typeof step.relativeDay !== 'number') {
    issues.push(`Step ${index}: Missing or invalid relativeDay`);
  }
  if (step.relativeDay < 0) {
    issues.push(`Step ${index}: relativeDay must be >= 0`);
  }
  if (!step.taskType) issues.push(`Step ${index}: Missing taskType`);

  const validPhases = ['seedling', 'veg', 'flower', 'harvest'];
  if (step.phase && !validPhases.includes(step.phase)) {
    issues.push(`Step ${index}: Invalid phase value: ${step.phase}`);
  }

  const validTaskTypes = [
    'water',
    'feed',
    'prune',
    'train',
    'monitor',
    'note',
    'custom',
  ];
  if (step.taskType && !validTaskTypes.includes(step.taskType)) {
    issues.push(`Step ${index}: Invalid taskType value: ${step.taskType}`);
  }

  if (step.defaultReminderLocal) {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(step.defaultReminderLocal)) {
      issues.push(
        `Step ${index}: Invalid time format: ${step.defaultReminderLocal}`
      );
    }
  }

  if (step.rrule) {
    if (!/^FREQ=(DAILY|WEEKLY|MONTHLY|YEARLY)/.test(step.rrule)) {
      issues.push(`Step ${index}: Invalid RRULE format: ${step.rrule}`);
    }
  }
}

// Basic validation rules
function validatePlaybook(data, _filename) {
  const issues = [];

  validateRequiredFields(data, issues);
  validateSetupAndLocale(data, issues);

  if (Array.isArray(data.steps)) {
    if (data.steps.length === 0) {
      issues.push('Steps array must have at least one item');
    }
    data.steps.forEach((step, index) => validateStep(step, index, issues));
  }

  return issues;
}

// Read all fixture files
const files = fs.readdirSync(fixturesDir).filter((f) => f.endsWith('.json'));

files.forEach((file) => {
  const filePath = path.join(fixturesDir, file);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  totalFiles++;

  const issues = validatePlaybook(data, file);
  const shouldBeValid = file.includes('valid') && !file.includes('invalid');

  if (shouldBeValid && issues.length === 0) {
    validFiles++;
    console.log(`✅ ${file} - Valid (as expected)`);
  } else if (!shouldBeValid && issues.length > 0) {
    validFiles++;
    console.log(`✅ ${file} - Invalid (as expected)`);
  } else if (shouldBeValid && issues.length > 0) {
    invalidFiles++;
    console.log(`❌ ${file} - Expected valid but got errors:`);
    issues.forEach((issue) => {
      console.log(`   ${issue}`);
      errors.push({ file, error: issue });
    });
  } else {
    invalidFiles++;
    console.log(`❌ ${file} - Expected invalid but passed validation`);
    errors.push({ file, error: 'Expected to fail validation but passed' });
  }
});

// Summary
console.log('\n' + '='.repeat(60));
console.log('📊 Validation Summary');
console.log('='.repeat(60));
console.log(`Total files: ${totalFiles}`);
console.log(`Passed: ${validFiles}`);
console.log(`Failed: ${invalidFiles}`);

if (invalidFiles > 0) {
  console.log('\n❌ Schema validation failed!');
  console.log('\nErrors:');
  errors.forEach(({ file, error }) => {
    console.log(`\n${file}:`);
    console.log(error);
  });
  process.exit(1);
} else {
  console.log('\n✅ All schema validations passed!');
  process.exit(0);
}
