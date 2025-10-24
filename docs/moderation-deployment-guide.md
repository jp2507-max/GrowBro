# Moderation System Deployment Guide

## Overview

This guide provides comprehensive instructions for deploying the DSA-compliant moderation system across development, staging, and production environments.

## Prerequisites

- Node.js 18+ and pnpm 10+
- Supabase project with appropriate permissions
- Access to environment-specific configuration files
- DSA Transparency Database credentials (production only)
- Age verification provider credentials (if enabled)

## Environment Configuration

### Development Environment

Development environment is configured for local testing with all features enabled except external integrations.

**Configuration File**: `.env.development`

```bash
# Environment
APP_ENV=development

# Feature Flags (all enabled for testing)
FEATURE_CONTENT_REPORTING_ENABLED=true
FEATURE_MODERATION_QUEUE_ENABLED=true
FEATURE_APPEALS_ENABLED=true
FEATURE_ODS_INTEGRATION_ENABLED=false
FEATURE_SOR_EXPORT_ENABLED=false
FEATURE_AGE_VERIFICATION_ENABLED=false
FEATURE_GEO_BLOCKING_ENABLED=false
FEATURE_TRUSTED_FLAGGERS_ENABLED=true
FEATURE_REPEAT_OFFENDER_DETECTION_ENABLED=true
FEATURE_TRANSPARENCY_REPORTING_ENABLED=false

# Supabase Configuration
SUPABASE_URL=https://your-dev-project.supabase.co
SUPABASE_ANON_KEY=your_dev_anon_key

# PII Scrubbing (development salt)
PII_SCRUBBING_SALT=dev-salt-change-in-production
PII_SALT_VERSION=v1.0

# Monitoring
SENTRY_DSN=
SENTRY_SEND_DEFAULT_PII=false
```

### Staging Environment

Staging environment mirrors production configuration but uses test credentials and lower traffic limits.

**Configuration File**: `.env.staging`

```bash
# Environment
APP_ENV=staging

# Feature Flags (gradually enable for testing)
FEATURE_CONTENT_REPORTING_ENABLED=true
FEATURE_MODERATION_QUEUE_ENABLED=true
FEATURE_APPEALS_ENABLED=true
FEATURE_ODS_INTEGRATION_ENABLED=false
FEATURE_SOR_EXPORT_ENABLED=false
FEATURE_AGE_VERIFICATION_ENABLED=false
FEATURE_GEO_BLOCKING_ENABLED=false
FEATURE_TRUSTED_FLAGGERS_ENABLED=true
FEATURE_REPEAT_OFFENDER_DETECTION_ENABLED=true
FEATURE_TRANSPARENCY_REPORTING_ENABLED=false

# Supabase Configuration
SUPABASE_URL=https://your-staging-project.supabase.co
SUPABASE_ANON_KEY=your_staging_anon_key

# DSA Transparency Database (test environment)
DSA_TRANSPARENCY_DB_URL=https://test-transparency-db.ec.europa.eu
DSA_TRANSPARENCY_DB_API_KEY=your_test_api_key

# PII Scrubbing (staging salt)
PII_SCRUBBING_SALT=staging-salt-unique-value
PII_SALT_VERSION=v1.0

# Legal/Compliance Contact Information
LEGAL_ENTITY_ADDRESS=Test Address
DPO_EMAIL=dpo-test@example.com
DPO_NAME=Test DPO

# Monitoring
SENTRY_DSN=https://your-staging-sentry-dsn
SENTRY_SEND_DEFAULT_PII=false
SENTRY_REPLAYS_SESSION_SAMPLE_RATE=0.1
SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE=1.0
SENTRY_ENABLE_REPLAY=true
```

### Production Environment

Production environment has all features disabled by default (ship dark) until compliance validation is complete.

**Configuration File**: `.env.production`

```bash
# Environment
APP_ENV=production

# Feature Flags (all disabled until compliance validated)
FEATURE_CONTENT_REPORTING_ENABLED=false
FEATURE_MODERATION_QUEUE_ENABLED=false
FEATURE_APPEALS_ENABLED=false
FEATURE_ODS_INTEGRATION_ENABLED=false
FEATURE_SOR_EXPORT_ENABLED=false
FEATURE_AGE_VERIFICATION_ENABLED=false
FEATURE_GEO_BLOCKING_ENABLED=false
FEATURE_TRUSTED_FLAGGERS_ENABLED=false
FEATURE_REPEAT_OFFENDER_DETECTION_ENABLED=false
FEATURE_TRANSPARENCY_REPORTING_ENABLED=false

# Supabase Configuration
SUPABASE_URL=https://your-production-project.supabase.co
SUPABASE_ANON_KEY=your_production_anon_key

# DSA Transparency Database (production)
DSA_TRANSPARENCY_DB_URL=https://transparency-db.ec.europa.eu
DSA_TRANSPARENCY_DB_API_KEY=your_production_api_key

# PII Scrubbing (production salt - MUST BE UNIQUE)
PII_SCRUBBING_SALT=production-salt-secure-random-value
PII_SALT_VERSION=v1.0

# Legal/Compliance Contact Information (REQUIRED)
LEGAL_ENTITY_ADDRESS=Complete legal address of GrowBro entity
DPO_EMAIL=dpo@growbro.app
DPO_NAME=Full name of Data Protection Officer
EU_REPRESENTATIVE_ADDRESS=EU representative address if applicable

# Monitoring
SENTRY_DSN=https://your-production-sentry-dsn
SENTRY_SEND_DEFAULT_PII=false
SENTRY_REPLAYS_SESSION_SAMPLE_RATE=0.01
SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE=1.0
SENTRY_ENABLE_REPLAY=true
```

## Database Migrations

### Running Migrations

1. **Check Migration Status**

```bash
# List all migrations
pnpm migration:list

# Check pending migrations
pnpm migration:pending
```

2. **Apply Migrations**

```bash
# Apply all pending migrations
pnpm migration:up

# Apply specific migration
pnpm migration:up --name=20251019_create_audit_worm_triggers
```

3. **Rollback Migrations**

```bash
# Rollback last migration
pnpm migration:down

# Rollback last N migrations
pnpm migration:down --count=3

# Rollback to specific version
pnpm migration:down --to=20251019_create_audit_worm_triggers
```

### Migration Checklist

- [ ] Backup database before applying migrations
- [ ] Test migrations in development environment
- [ ] Verify migrations in staging environment
- [ ] Review migration SQL for security issues
- [ ] Ensure rollback SQL is tested
- [ ] Document any manual steps required
- [ ] Update migration documentation

## Health Checks

### Health Check Endpoints

The system provides health check endpoints for monitoring service status:

```typescript
// Check overall system health
const health = await healthCheckService.checkHealth();

// Check specific service
const dbHealth = await healthCheckService.getServiceHealth('database');

// Check if system is healthy
const isHealthy = healthCheckService.isHealthy();
```

### Health Check Response

```json
{
  "status": "healthy",
  "timestamp": "2025-10-23T10:00:00Z",
  "version": "1.0.0",
  "environment": "production",
  "uptime": 3600000,
  "services": [
    {
      "name": "database",
      "status": "healthy",
      "message": "Database connection is healthy",
      "lastCheck": "2025-10-23T10:00:00Z",
      "responseTime": 45
    },
    {
      "name": "dsa-transparency-db",
      "status": "healthy",
      "message": "DSA Transparency DB is reachable",
      "lastCheck": "2025-10-23T10:00:00Z",
      "responseTime": 120
    }
  ]
}
```

### Monitoring Health Checks

Set up automated health check monitoring:

```bash
# Run health check every 30 seconds
*/30 * * * * curl https://api.growbro.app/health

# Alert on unhealthy status
if [ "$(curl -s https://api.growbro.app/health | jq -r '.status')" != "healthy" ]; then
  # Send alert
  echo "System unhealthy" | mail -s "Health Check Alert" ops@growbro.app
fi
```

## Deployment Steps

### Pre-Deployment Checklist

- [ ] All tests passing
- [ ] Code review completed
- [ ] Security audit completed
- [ ] Database migrations tested
- [ ] Environment variables configured
- [ ] Credentials validated
- [ ] Health checks passing
- [ ] Monitoring configured
- [ ] Rollback plan documented

### Development Deployment

1. **Install Dependencies**

```bash
pnpm install
```

2. **Run Database Migrations**

```bash
pnpm migration:up
```

3. **Start Development Server**

```bash
pnpm start:development
```

4. **Verify Health**

```bash
curl http://localhost:3000/health
```

### Staging Deployment

1. **Build Application**

```bash
APP_ENV=staging pnpm build
```

2. **Run Database Migrations**

```bash
APP_ENV=staging pnpm migration:up
```

3. **Deploy to Staging**

```bash
pnpm deploy:staging
```

4. **Verify Deployment**

```bash
curl https://staging-api.growbro.app/health
```

5. **Run Smoke Tests**

```bash
pnpm test:smoke:staging
```

### Production Deployment

1. **Create Backup**

```bash
pnpm backup:production
```

2. **Build Application**

```bash
APP_ENV=production pnpm build
```

3. **Run Database Migrations**

```bash
APP_ENV=production pnpm migration:up
```

4. **Deploy to Production**

```bash
pnpm deploy:production
```

5. **Verify Deployment**

```bash
curl https://api.growbro.app/health
```

6. **Monitor Metrics**

```bash
# Check Sentry for errors
# Monitor health checks
# Verify feature flags
```

## Rollback Procedures

### Application Rollback

1. **Identify Last Known Good Version**

```bash
git log --oneline
```

2. **Rollback to Previous Version**

```bash
git checkout <commit-hash>
pnpm deploy:production
```

3. **Verify Rollback**

```bash
curl https://api.growbro.app/health
```

### Database Rollback

1. **Identify Migrations to Rollback**

```bash
pnpm migration:list
```

2. **Rollback Migrations**

```bash
pnpm migration:down --count=1
```

3. **Verify Database State**

```bash
pnpm migration:list
```

## Credential Management

### Rotating Credentials

1. **Generate New Credentials**

```bash
# Generate new API key
openssl rand -hex 32
```

2. **Update Environment Variables**

```bash
# Update .env.production
DSA_TRANSPARENCY_DB_API_KEY=new_api_key
```

3. **Restart Services**

```bash
pnpm restart:production
```

4. **Verify New Credentials**

```bash
curl https://api.growbro.app/health
```

### Credential Validation

```bash
# Validate all credentials
pnpm credentials:validate

# Check credential expiration
pnpm credentials:check-expiry
```

## Monitoring and Alerting

### Key Metrics to Monitor

- System health status
- Service response times
- Error rates
- Database connection pool
- DSA Transparency DB submission success rate
- SLA compliance metrics
- Appeal processing times

### Alert Thresholds

- System unhealthy: Immediate alert
- Service degraded: Warning after 5 minutes
- Error rate > 1%: Alert
- Response time > 5s: Warning
- SLA breach: Immediate alert

## Troubleshooting

### Common Issues

**Database Connection Failures**

```bash
# Check database status
pnpm db:status

# Restart database connection pool
pnpm db:restart
```

**DSA Transparency DB Submission Failures**

```bash
# Check circuit breaker status
pnpm dsa:status

# Reset circuit breaker
pnpm dsa:reset
```

**Health Check Failures**

```bash
# Run detailed health check
pnpm health:detailed

# Check individual services
pnpm health:check database
pnpm health:check dsa-transparency-db
```

## Security Considerations

- Never commit `.env` files to version control
- Rotate credentials regularly (every 90 days)
- Use environment-specific salts for PII scrubbing
- Enable audit logging in production
- Monitor for suspicious activity
- Keep dependencies up to date
- Regular security audits

## Compliance Validation

Before enabling features in production:

- [ ] DPIA completed and approved
- [ ] Legal review completed
- [ ] DSA compliance validated
- [ ] GDPR compliance validated
- [ ] Age verification tested
- [ ] PII scrubbing validated
- [ ] Audit logging verified
- [ ] Transparency reporting tested

## Support

For deployment issues:

- Check logs: `pnpm logs:production`
- Review health checks: `curl https://api.growbro.app/health`
- Contact DevOps team: devops@growbro.app
- Emergency hotline: +49-xxx-xxx-xxxx
