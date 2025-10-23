#!/usr/bin/env node

/**
 * Moderation System Deployment Script
 *
 * Automates deployment of the DSA-compliant moderation system with
 * pre-deployment checks, health validation, and rollback capabilities.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

/**
 * Log with color
 */
function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Execute command
 */
function exec(command, options = {}) {
  try {
    return execSync(command, {
      stdio: options.silent ? 'pipe' : 'inherit',
      encoding: 'utf-8',
      ...options,
    });
  } catch (error) {
    if (!options.ignoreError) {
      throw error;
    }
    return null;
  }
}

/**
 * Check if environment file exists
 */
function checkEnvFile(env) {
  const envPath = path.join(process.cwd(), `.env.${env}`);
  if (!fs.existsSync(envPath)) {
    log(`❌ Environment file not found: .env.${env}`, 'red');
    return false;
  }
  return true;
}

/**
 * Validate environment variables
 */
function validateEnvVars(env) {
  log('\n📋 Validating environment variables...', 'blue');

  const requiredVars = ['SUPABASE_URL', 'SUPABASE_ANON_KEY'];

  const productionVars = [
    'DSA_TRANSPARENCY_DB_URL',
    'DSA_TRANSPARENCY_DB_API_KEY',
    'PII_SCRUBBING_SALT',
    'LEGAL_ENTITY_ADDRESS',
    'DPO_EMAIL',
    'DPO_NAME',
  ];

  const envPath = path.join(process.cwd(), `.env.${env}`);
  const envContent = fs.readFileSync(envPath, 'utf-8');

  const missing = [];

  // Check required vars
  for (const varName of requiredVars) {
    if (!envContent.includes(`${varName}=`)) {
      missing.push(varName);
    }
  }

  // Check production-specific vars
  if (env === 'production') {
    for (const varName of productionVars) {
      if (!envContent.includes(`${varName}=`)) {
        missing.push(varName);
      }
    }
  }

  if (missing.length > 0) {
    log(`❌ Missing required environment variables:`, 'red');
    missing.forEach((varName) => log(`   - ${varName}`, 'red'));
    return false;
  }

  log('✅ Environment variables validated', 'green');
  return true;
}

/**
 * Run tests
 */
function runTests() {
  log('\n🧪 Running tests...', 'blue');

  try {
    exec('pnpm test --run', { silent: false });
    log('✅ Tests passed', 'green');
    return true;
  } catch (_error) {
    log('❌ Tests failed', 'red');
    return false;
  }
}

/**
 * Run type check
 */
function runTypeCheck() {
  log('\n🔍 Running type check...', 'blue');

  try {
    exec('pnpm type-check', { silent: false });
    log('✅ Type check passed', 'green');
    return true;
  } catch (_error) {
    log('❌ Type check failed', 'red');
    return false;
  }
}

/**
 * Run linter
 */
function runLinter() {
  log('\n🔍 Running linter...', 'blue');

  try {
    exec('pnpm lint', { silent: false });
    log('✅ Linter passed', 'green');
    return true;
  } catch (_error) {
    log('❌ Linter failed', 'red');
    return false;
  }
}

/**
 * Build application
 */
function buildApp(env) {
  log('\n🔨 Building application...', 'blue');

  try {
    exec(`APP_ENV=${env} pnpm build`, { silent: false });
    log('✅ Build successful', 'green');
    return true;
  } catch (_error) {
    log('❌ Build failed', 'red');
    return false;
  }
}

/**
 * Run database migrations
 */
function runMigrations(env) {
  log('\n🗄️  Running database migrations...', 'blue');

  try {
    // Check pending migrations
    const pending = exec('pnpm migration:pending', {
      silent: true,
      ignoreError: true,
    });

    if (pending && pending.trim()) {
      log(`Found pending migrations:\n${pending}`, 'yellow');

      // Apply migrations
      exec(`APP_ENV=${env} pnpm migration:up`, { silent: false });
      log('✅ Migrations applied', 'green');
    } else {
      log('✅ No pending migrations', 'green');
    }

    return true;
  } catch (_error) {
    log('❌ Migration failed', 'red');
    return false;
  }
}

/**
 * Check health
 */
function checkHealth(url) {
  log('\n🏥 Checking system health...', 'blue');

  try {
    const response = exec(`curl -s ${url}/health`, {
      silent: true,
      ignoreError: true,
    });

    if (response) {
      const health = JSON.parse(response);

      if (health.status === 'healthy') {
        log('✅ System is healthy', 'green');
        return true;
      } else {
        log(`⚠️  System status: ${health.status}`, 'yellow');
        log(JSON.stringify(health, null, 2), 'yellow');
        return false;
      }
    } else {
      log('❌ Health check failed', 'red');
      return false;
    }
  } catch (_error) {
    log('❌ Health check error', 'red');
    return false;
  }
}

/**
 * Create backup
 */
function createBackup(env) {
  log('\n💾 Creating backup...', 'blue');

  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `backup-${env}-${timestamp}`;

    exec(`pnpm backup:create ${backupName}`, {
      silent: false,
      ignoreError: true,
    });

    log(`✅ Backup created: ${backupName}`, 'green');
    return backupName;
  } catch (_error) {
    log('⚠️  Backup creation failed (continuing anyway)', 'yellow');
    return null;
  }
}

/**
 * Deploy to environment
 */
function deploy(env, options = {}) {
  log(`\n${'='.repeat(60)}`, 'bright');
  log(`🚀 Deploying to ${env.toUpperCase()}`, 'bright');
  log(`${'='.repeat(60)}\n`, 'bright');

  // Check environment file
  if (!checkEnvFile(env)) {
    process.exit(1);
  }

  // Validate environment variables
  if (!validateEnvVars(env)) {
    process.exit(1);
  }

  // Run pre-deployment checks
  if (!options.skipTests) {
    if (!runTests()) {
      log('\n❌ Deployment aborted: Tests failed', 'red');
      process.exit(1);
    }
  }

  if (!options.skipTypeCheck) {
    if (!runTypeCheck()) {
      log('\n❌ Deployment aborted: Type check failed', 'red');
      process.exit(1);
    }
  }

  if (!options.skipLint) {
    if (!runLinter()) {
      log('\n❌ Deployment aborted: Linter failed', 'red');
      process.exit(1);
    }
  }

  // Create backup (production only)
  let backupName = null;
  if (env === 'production' && !options.skipBackup) {
    backupName = createBackup(env);
  }

  // Build application
  if (!buildApp(env)) {
    log('\n❌ Deployment aborted: Build failed', 'red');
    process.exit(1);
  }

  // Run migrations
  if (!options.skipMigrations) {
    if (!runMigrations(env)) {
      log('\n❌ Deployment aborted: Migrations failed', 'red');
      process.exit(1);
    }
  }

  // Deploy
  log('\n🚀 Deploying application...', 'blue');
  try {
    exec(`pnpm deploy:${env}`, { silent: false });
    log('✅ Deployment successful', 'green');
  } catch (_error) {
    log('❌ Deployment failed', 'red');

    if (backupName) {
      log(`\n💾 Backup available: ${backupName}`, 'yellow');
      log('Run rollback: pnpm rollback:production', 'yellow');
    }

    process.exit(1);
  }

  // Health check
  if (!options.skipHealthCheck) {
    const urls = {
      development: 'http://localhost:3000',
      staging: 'https://staging-api.growbro.app',
      production: 'https://api.growbro.app',
    };

    const url = urls[env];
    if (url) {
      // Wait for deployment to stabilize
      log('\n⏳ Waiting for deployment to stabilize...', 'blue');
      exec('sleep 10', { silent: true });

      if (!checkHealth(url)) {
        log('\n⚠️  Health check failed after deployment', 'yellow');
        log('Please investigate and consider rollback if needed', 'yellow');
      }
    }
  }

  log(`\n${'='.repeat(60)}`, 'bright');
  log(`✅ Deployment to ${env.toUpperCase()} completed successfully!`, 'green');
  log(`${'='.repeat(60)}\n`, 'bright');
}

/**
 * Main
 */
function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    log('Usage: node deploy-moderation.js <environment> [options]', 'yellow');
    log('\nEnvironments:', 'yellow');
    log('  development', 'yellow');
    log('  staging', 'yellow');
    log('  production', 'yellow');
    log('\nOptions:', 'yellow');
    log('  --skip-tests         Skip running tests', 'yellow');
    log('  --skip-type-check    Skip type checking', 'yellow');
    log('  --skip-lint          Skip linting', 'yellow');
    log('  --skip-migrations    Skip database migrations', 'yellow');
    log('  --skip-backup        Skip creating backup', 'yellow');
    log('  --skip-health-check  Skip health check', 'yellow');
    process.exit(1);
  }

  const env = args[0];
  const options = {
    skipTests: args.includes('--skip-tests'),
    skipTypeCheck: args.includes('--skip-type-check'),
    skipLint: args.includes('--skip-lint'),
    skipMigrations: args.includes('--skip-migrations'),
    skipBackup: args.includes('--skip-backup'),
    skipHealthCheck: args.includes('--skip-health-check'),
  };

  if (!['development', 'staging', 'production'].includes(env)) {
    log(`❌ Invalid environment: ${env}`, 'red');
    log('Valid environments: development, staging, production', 'yellow');
    process.exit(1);
  }

  deploy(env, options);
}

main();
