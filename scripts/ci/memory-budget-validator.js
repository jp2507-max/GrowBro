#!/usr/bin/env node

/**
 * Memory Budget Validator for CI/CD
 * Validates memory leak detection results against performance budgets
 * Fails CI if memory budgets are exceeded
 *
 * Usage: node scripts/ci/memory-budget-validator.js <memory-report.json>
 */

const fs = require('fs');
const path = require('path');

// Memory budget thresholds from requirements
const MEMORY_BUDGETS = {
  maxRSSDeltaMB: 50, // Requirement 5.4
  maxPostGCDeltaMB: 10, // Requirement 5.4
};

/**
 * Validate memory leak detection result against budgets
 */
function validateMemoryBudget(result) {
  const violations = [];
  let passed = true;

  // Validate RSS delta
  if (result.metrics.deltas.rssDeltaMB > MEMORY_BUDGETS.maxRSSDeltaMB) {
    violations.push({
      metric: 'RSS Delta',
      threshold: MEMORY_BUDGETS.maxRSSDeltaMB,
      actual: result.metrics.deltas.rssDeltaMB,
      severity: 'error',
    });
    passed = false;
  }

  // Validate post-GC delta
  if (result.metrics.deltas.postGCDeltaMB > MEMORY_BUDGETS.maxPostGCDeltaMB) {
    violations.push({
      metric: 'Post-GC Delta',
      threshold: MEMORY_BUDGETS.maxPostGCDeltaMB,
      actual: result.metrics.deltas.postGCDeltaMB,
      severity: 'error',
    });
    passed = false;
  }

  return { passed, violations };
}

/**
 * Format validation result for console output
 */
function formatValidationResult(result, validation) {
  const status = validation.passed ? '✅ PASSED' : '❌ FAILED';
  const lines = [
    '',
    '═══════════════════════════════════════════════════════',
    `Memory Budget Validation: ${status}`,
    '═══════════════════════════════════════════════════════',
    '',
    `Test: ${result.testName}`,
    `Duration: ${result.duration / 1000}s`,
    `Build: ${result.build.buildHash || 'unknown'}`,
    `Device: ${result.build.device || 'unknown'}`,
    '',
    '─────────────────────────────────────────────────────',
    'Memory Metrics:',
    '─────────────────────────────────────────────────────',
    `Baseline RSS: ${(result.metrics.baseline.rssMemory / (1024 * 1024)).toFixed(2)} MB`,
    `Peak RSS: ${(result.metrics.peak.rssMemory / (1024 * 1024)).toFixed(2)} MB`,
    `Post-GC RSS: ${(result.metrics.postGC.rssMemory / (1024 * 1024)).toFixed(2)} MB`,
    '',
    `RSS Delta: ${result.metrics.deltas.rssDeltaMB.toFixed(2)} MB (budget: ${MEMORY_BUDGETS.maxRSSDeltaMB} MB)`,
    `Post-GC Delta: ${result.metrics.deltas.postGCDeltaMB.toFixed(2)} MB (budget: ${MEMORY_BUDGETS.maxPostGCDeltaMB} MB)`,
  ];

  if (validation.violations.length > 0) {
    lines.push('', '─────────────────────────────────────────────────────');
    lines.push('Budget Violations:');
    lines.push('─────────────────────────────────────────────────────');
    validation.violations.forEach((v) => {
      lines.push(
        `❌ ${v.metric}: ${v.actual.toFixed(2)} MB exceeds budget ${v.threshold} MB`
      );
    });
  }

  lines.push('═══════════════════════════════════════════════════════');
  lines.push('');

  return lines.join('\n');
}

/**
 * Main execution
 */
function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error(
      'Usage: node memory-budget-validator.js <memory-report.json>'
    );
    process.exit(1);
  }

  const reportPath = path.resolve(args[0]);

  if (!fs.existsSync(reportPath)) {
    console.error(`Error: Memory report not found at ${reportPath}`);
    process.exit(1);
  }

  try {
    const reportContent = fs.readFileSync(reportPath, 'utf8');
    const result = JSON.parse(reportContent);

    // Validate against budgets
    const validation = validateMemoryBudget(result);

    // Print formatted result
    console.log(formatValidationResult(result, validation));

    // Exit with appropriate code
    if (!validation.passed) {
      console.error('Memory budget validation FAILED');
      process.exit(1);
    }

    console.log('Memory budget validation PASSED');
    process.exit(0);
  } catch (error) {
    console.error('Error validating memory budget:', error.message);
    process.exit(1);
  }
}

main();
