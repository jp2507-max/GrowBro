#!/usr/bin/env node

/**
 * CI Accessibility Compliance Check
 *
 * This script validates that all interactive components meet minimum
 * touch target size requirements (44pt iOS / 48dp Android).
 *
 * Usage: node scripts/ci-accessibility-check.js
 */

const fs = require('fs');
const path = require('path');

// Minimum touch target sizes
const MIN_TOUCH_TARGET_IOS = 44;
const MIN_TOUCH_TARGET_ANDROID = 48;

// Patterns to search for in component files
const INTERACTIVE_COMPONENTS = [
  'Pressable',
  'TouchableOpacity',
  'TouchableHighlight',
  'TouchableWithoutFeedback',
  'Button',
];

// Directories to scan
const SCAN_DIRS = ['src/components', 'src/app'];

let violations = [];
let warnings = [];
let filesScanned = 0;

/**
 * Recursively get all TypeScript/TSX files in a directory
 */
function getFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);

  files.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      // Skip node_modules, __tests__, and other non-source directories
      if (
        !file.startsWith('.') &&
        file !== 'node_modules' &&
        file !== '__tests__' &&
        file !== '__mocks__'
      ) {
        getFiles(filePath, fileList);
      }
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      fileList.push(filePath);
    }
  });

  return fileList;
}

/**
 * Check if a file contains interactive components
 */
function hasInteractiveComponents(content) {
  return INTERACTIVE_COMPONENTS.some((component) =>
    content.includes(`<${component}`)
  );
}

/**
 * Check if file has accessibility props
 */
function checkAccessibilityProps(filePath, content) {
  const issues = [];

  // Check for interactive components without accessibility labels
  INTERACTIVE_COMPONENTS.forEach((component) => {
    const regex = new RegExp(`<${component}[^>]*>`, 'g');
    const matches = content.match(regex);

    if (matches) {
      matches.forEach((match) => {
        // Check if it has accessibility label or role
        if (
          !match.includes('accessibilityLabel') &&
          !match.includes('accessibilityRole') &&
          !match.includes('accessible=')
        ) {
          issues.push({
            file: filePath,
            component,
            issue:
              'Missing accessibility props (accessibilityLabel or accessibilityRole)',
            severity: 'warning',
          });
        }
      });
    }
  });

  return issues;
}

/**
 * Check if file uses touch target utilities
 */
function checkTouchTargetSizes(filePath, content) {
  const issues = [];

  // Check if file imports touch target utilities
  const hasTouchTargetImport =
    content.includes('createAccessibleTouchTarget') ||
    content.includes('MIN_TOUCH_TARGET_SIZE') ||
    content.includes('validateTouchTarget');

  // Check for hardcoded small sizes
  const sizeRegex = /(?:width|height|minWidth|minHeight):\s*(\d+)/g;
  let match;

  while ((match = sizeRegex.exec(content)) !== null) {
    const size = parseInt(match[1], 10);

    if (size < MIN_TOUCH_TARGET_ANDROID && hasInteractiveComponents(content)) {
      issues.push({
        file: filePath,
        size,
        issue: `Hardcoded size ${size} is below minimum touch target (${MIN_TOUCH_TARGET_ANDROID}dp)`,
        severity: hasTouchTargetImport ? 'warning' : 'error',
        line: content.substring(0, match.index).split('\n').length,
      });
    }
  }

  return issues;
}

/**
 * Main scanning function
 */
function scanFiles() {
  console.log('🔍 Scanning for accessibility compliance...\n');

  SCAN_DIRS.forEach((dir) => {
    const dirPath = path.join(process.cwd(), dir);

    if (!fs.existsSync(dirPath)) {
      console.warn(`⚠️  Directory not found: ${dir}`);
      return;
    }

    const files = getFiles(dirPath);

    files.forEach((file) => {
      filesScanned++;
      const content = fs.readFileSync(file, 'utf-8');

      // Only check files with interactive components
      if (hasInteractiveComponents(content)) {
        const a11yIssues = checkAccessibilityProps(file, content);
        const sizeIssues = checkTouchTargetSizes(file, content);

        a11yIssues.forEach((issue) => {
          if (issue.severity === 'error') {
            violations.push(issue);
          } else {
            warnings.push(issue);
          }
        });

        sizeIssues.forEach((issue) => {
          if (issue.severity === 'error') {
            violations.push(issue);
          } else {
            warnings.push(issue);
          }
        });
      }
    });
  });
}

/**
 * Print results
 */
function printResults() {
  console.log(`\n📊 Scanned ${filesScanned} files\n`);

  if (violations.length > 0) {
    console.log('❌ Accessibility Violations:\n');
    violations.forEach((violation, index) => {
      console.log(`${index + 1}. ${violation.file}`);
      if (violation.line) {
        console.log(`   Line: ${violation.line}`);
      }
      if (violation.component) {
        console.log(`   Component: ${violation.component}`);
      }
      console.log(`   Issue: ${violation.issue}\n`);
    });
  }

  if (warnings.length > 0) {
    console.log('⚠️  Accessibility Warnings:\n');
    warnings.forEach((warning, index) => {
      console.log(`${index + 1}. ${warning.file}`);
      if (warning.line) {
        console.log(`   Line: ${warning.line}`);
      }
      if (warning.component) {
        console.log(`   Component: ${warning.component}`);
      }
      console.log(`   Issue: ${warning.issue}\n`);
    });
  }

  if (violations.length === 0 && warnings.length === 0) {
    console.log('✅ No accessibility issues found!\n');
  }

  // Summary
  console.log('Summary:');
  console.log(`  Files scanned: ${filesScanned}`);
  console.log(`  Violations: ${violations.length}`);
  console.log(`  Warnings: ${warnings.length}\n`);

  // Guidelines
  console.log('📖 Accessibility Guidelines:');
  console.log(
    `  - Minimum touch target: ${MIN_TOUCH_TARGET_IOS}pt (iOS) / ${MIN_TOUCH_TARGET_ANDROID}dp (Android)`
  );
  console.log(
    '  - All interactive elements need accessibilityLabel or accessibilityRole'
  );
  console.log('  - Use createAccessibleTouchTarget() from @/lib/accessibility');
  console.log(
    '  - Import MIN_TOUCH_TARGET_SIZE constant for consistent sizing\n'
  );

  // Exit with error if violations found
  if (violations.length > 0) {
    process.exit(1);
  }
}

// Run the script
try {
  scanFiles();
  printResults();
} catch (error) {
  console.error('❌ Error running accessibility check:', error.message);
  process.exit(1);
}
