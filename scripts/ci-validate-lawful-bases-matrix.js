#!/usr/bin/env node

/**
 * CI Lawful Bases Matrix Validation Script
 *
 * Validates lawful-bases-matrix.json against JSON Schema and checks file references.
 * This ensures compliance documentation integrity in the CI pipeline.
 *
 * Usage: node scripts/ci-validate-lawful-bases-matrix.js
 *
 * Exit codes:
 *   0 - Validation successful
 *   1 - JSON schema validation failed
 *   2 - File reference validation failed
 *   3 - File not found or unreadable
 */

const fs = require('fs');
const path = require('path');

// Simple JSON Schema validator for the lawful bases matrix
function validateLawfulBasesMatrix(data) {
  const errors = [];

  // Basic structure validation
  if (!data.title || typeof data.title !== 'string') {
    errors.push('Missing or invalid title');
  }

  if (!data.version || typeof data.version !== 'string') {
    errors.push('Missing or invalid version');
  }

  if (!data.processingOperations || !Array.isArray(data.processingOperations)) {
    errors.push('Missing or invalid processingOperations array');
  }

  if (
    !data.legitimateInterestsAssessments ||
    !Array.isArray(data.legitimateInterestsAssessments)
  ) {
    errors.push('Missing or invalid legitimateInterestsAssessments array');
  }

  // Validate processing operations
  data.processingOperations.forEach((op, index) => {
    if (!op.operation || typeof op.operation !== 'string') {
      errors.push(
        `Processing operation ${index}: Missing or invalid operation name`
      );
    }

    if (!op.gdprArticle6Basis || !Array.isArray(op.gdprArticle6Basis)) {
      errors.push(
        `Processing operation ${index}: Missing or invalid gdprArticle6Basis array`
      );
    }
  });

  // Validate legitimate interests assessments
  data.legitimateInterestsAssessments.forEach((lia, index) => {
    if (!lia.liaId || typeof lia.liaId !== 'string') {
      errors.push(`LIA ${index}: Missing or invalid liaId`);
    }

    if (!lia.documentLocation || typeof lia.documentLocation !== 'string') {
      errors.push(`LIA ${index}: Missing or invalid documentLocation`);
    }

    if (!lia.purpose || typeof lia.purpose !== 'string') {
      errors.push(`LIA ${index}: Missing or invalid purpose`);
    }

    if (!lia.legitimateInterest || typeof lia.legitimateInterest !== 'string') {
      errors.push(`LIA ${index}: Missing or invalid legitimateInterest`);
    }

    if (!lia.necessityTest || typeof lia.necessityTest !== 'object') {
      errors.push(`LIA ${index}: Missing or invalid necessityTest`);
    }

    if (!lia.balancingTest || typeof lia.balancingTest !== 'object') {
      errors.push(`LIA ${index}: Missing or invalid balancingTest`);
    }
  });

  return errors;
}

// Check if referenced files exist
function validateFileReferences(data) {
  const errors = [];
  const baseDir = path.join(__dirname, '..');

  // Collect all file references
  const fileReferences = new Set();

  // LIA document references
  data.legitimateInterestsAssessments.forEach((lia) => {
    if (lia.documentLocation) {
      fileReferences.add(lia.documentLocation);
    }
  });

  // Processing operation LIA references
  data.processingOperations.forEach((op) => {
    op.gdprArticle6Basis.forEach((basis) => {
      if (basis.liaDocumentReference) {
        fileReferences.add(basis.liaDocumentReference);
      }
    });
  });

  // Check each file reference
  fileReferences.forEach((filePath) => {
    const fullPath = path.join(baseDir, filePath);
    try {
      if (!fs.existsSync(fullPath)) {
        errors.push(`Referenced file does not exist: ${filePath}`);
      } else {
        // Check if it's a readable file
        const stats = fs.statSync(fullPath);
        if (!stats.isFile()) {
          errors.push(`Referenced path is not a file: ${filePath}`);
        }
      }
    } catch (error) {
      errors.push(`Error checking file ${filePath}: ${error.message}`);
    }
  });

  return errors;
}

function main() {
  const matrixPath = path.join(
    __dirname,
    '../compliance/lawful-bases-matrix.json'
  );
  const reportPath = path.join(
    __dirname,
    '../build/reports/compliance/lawful-bases-matrix-validation.json'
  );

  console.log('🔍 Validating lawful-bases-matrix.json...\n');

  // Ensure report directory exists
  const reportDir = path.dirname(reportPath);
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  const report = {
    timestamp: new Date().toISOString(),
    file: 'compliance/lawful-bases-matrix.json',
    schemaValidation: { passed: false, errors: [] },
    fileReferenceValidation: { passed: false, errors: [] },
    overallResult: 'failed',
  };

  // Check if file exists
  if (!fs.existsSync(matrixPath)) {
    const error = `File not found: ${matrixPath}`;
    console.error(`❌ ${error}`);
    report.schemaValidation.errors.push(error);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    process.exit(3);
  }

  // Read and parse JSON
  let data;
  try {
    const content = fs.readFileSync(matrixPath, 'utf8');
    data = JSON.parse(content);
  } catch (error) {
    const errorMsg = `Failed to read or parse JSON: ${error.message}`;
    console.error(`❌ ${errorMsg}`);
    report.schemaValidation.errors.push(errorMsg);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    process.exit(3);
  }

  // Validate JSON schema
  console.log('📋 Validating JSON schema...');
  const schemaErrors = validateLawfulBasesMatrix(data);
  report.schemaValidation.errors = schemaErrors;

  if (schemaErrors.length > 0) {
    console.error('❌ JSON schema validation failed:');
    schemaErrors.forEach((error) => console.error(`  - ${error}`));
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    process.exit(1);
  }

  report.schemaValidation.passed = true;
  console.log('✅ JSON schema validation passed');

  // Validate file references
  console.log('📁 Validating file references...');
  const fileErrors = validateFileReferences(data);
  report.fileReferenceValidation.errors = fileErrors;

  if (fileErrors.length > 0) {
    console.error('❌ File reference validation failed:');
    fileErrors.forEach((error) => console.error(`  - ${error}`));
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    process.exit(2);
  }

  report.fileReferenceValidation.passed = true;
  console.log('✅ File reference validation passed');

  report.overallResult = 'passed';
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log('\n🎉 Lawful bases matrix validation completed successfully!');
  process.exit(0);
}

if (require.main === module) {
  main();
}
