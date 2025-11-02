#!/usr/bin/env node

/**
 * Generate licenses.json from project dependencies
 *
 * This script extracts all dependencies using pnpm list, reads their package.json
 * and LICENSE files, and generates a JSON file with license information.
 *
 * Output: src/data/licenses.json
 * Usage: node scripts/generate-licenses.js
 */

const fs = require('fs');
const path = require('path');

const OUTPUT_PATH = path.join(__dirname, '..', 'src', 'data', 'licenses.json');

console.log('🔍 Reading package.json to get dependencies...');

// Read package.json to get the list of dependencies
const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

// Merge dependencies and devDependencies (but we'll focus on dependencies)
const allDeps = {
  ...packageJson.dependencies,
};

console.log(`📦 Processing ${Object.keys(allDeps).length} dependencies...`);

const licenses = new Map();

/**
 * Extract license information for a package
 */
function extractLicenseInfo(name) {
  // Look for the package in node_modules
  const packagePath = path.join(__dirname, '..', 'node_modules', name);

  if (!fs.existsSync(packagePath)) {
    console.warn(`⚠️  Package not found: ${name}`);
    return null;
  }

  let version = 'unknown';
  let licenseType = 'Unknown';
  let repository = '';
  let homepage = '';
  let licenseText = '';

  // Read package.json
  try {
    const pkgJsonPath = path.join(packagePath, 'package.json');
    if (fs.existsSync(pkgJsonPath)) {
      const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));

      // Extract version
      version = pkgJson.version || 'unknown';

      // Extract license
      if (typeof pkgJson.license === 'string') {
        licenseType = pkgJson.license;
      } else if (pkgJson.license && pkgJson.license.type) {
        licenseType = pkgJson.license.type;
      } else if (Array.isArray(pkgJson.licenses)) {
        licenseType = pkgJson.licenses.map((l) => l.type || l).join(', ');
      }

      // Extract repository
      if (typeof pkgJson.repository === 'string') {
        repository = pkgJson.repository;
      } else if (pkgJson.repository && pkgJson.repository.url) {
        repository = pkgJson.repository.url
          .replace(/^git\+/, '')
          .replace(/\.git$/, '');
      }

      // Extract homepage
      homepage = pkgJson.homepage || repository;
    }
  } catch (error) {
    console.warn(`⚠️  Error reading package.json for ${name}:`, error.message);
  }

  // Read LICENSE file
  const licenseFiles = [
    'LICENSE',
    'LICENSE.md',
    'LICENSE.txt',
    'LICENCE',
    'LICENCE.md',
    'license',
    'license.md',
  ];

  for (const licenseFile of licenseFiles) {
    try {
      const licensePath = path.join(packagePath, licenseFile);
      if (fs.existsSync(licensePath)) {
        licenseText = fs.readFileSync(licensePath, 'utf-8');
        // Limit to first 5000 chars to keep file size reasonable
        if (licenseText.length > 5000) {
          licenseText =
            licenseText.substring(0, 5000) + '\n\n[License text truncated...]';
        }
        break;
      }
    } catch (_error) {
      // Ignore errors reading LICENSE file
    }
  }

  // If no license text, try to read from README
  if (!licenseText) {
    try {
      const readmePath = path.join(packagePath, 'README.md');
      if (fs.existsSync(readmePath)) {
        const readme = fs.readFileSync(readmePath, 'utf-8');
        const licenseMatch = readme.match(/## License[\s\S]{0,1000}/i);
        if (licenseMatch) {
          licenseText = licenseMatch[0];
        }
      }
    } catch (_error) {
      // Ignore errors reading README
    }
  }

  return {
    name,
    version,
    license: licenseType,
    licenseText:
      licenseText || `No license text available. License type: ${licenseType}`,
    repository,
    homepage,
  };
}

// Process each dependency
Object.keys(allDeps).forEach((depName) => {
  const info = extractLicenseInfo(depName);
  if (info) {
    const key = `${info.name}@${info.version}`;
    licenses.set(key, info);
  }
});

console.log(`✅ Found ${licenses.size} unique dependencies`);

// Convert Map to sorted array
const licensesArray = Array.from(licenses.values()).sort((a, b) => {
  return a.name.localeCompare(b.name);
});

// Group by license type for easier filtering
const byLicenseType = {};
licensesArray.forEach((pkg) => {
  const type = pkg.license || 'Unknown';
  if (!byLicenseType[type]) {
    byLicenseType[type] = [];
  }
  byLicenseType[type].push(pkg.name);
});

console.log('\n📊 License type distribution:');
Object.entries(byLicenseType)
  .sort((a, b) => b[1].length - a[1].length)
  .slice(0, 10)
  .forEach(([type, pkgs]) => {
    console.log(`  ${type}: ${pkgs.length} packages`);
  });

// Ensure output directory exists
const outputDir = path.dirname(OUTPUT_PATH);
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Write output
const output = {
  generated: new Date().toISOString(),
  count: licensesArray.length,
  packages: licensesArray,
};

fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), 'utf-8');

console.log(`\n✨ Generated ${OUTPUT_PATH}`);
console.log(`   ${licensesArray.length} packages with license information\n`);
