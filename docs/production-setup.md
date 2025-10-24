# Production Setup and Configuration Guide

This guide covers the production deployment configuration for GrowBro, including environment variables, secrets management, and security considerations.

## Environment Variables

### Required Production Environment Variables

#### PII Scrubbing Salt (`PII_SCRUBBING_SALT`)

**Purpose**: Cryptographic salt used for pseudonymizing personally identifiable information (PII) in moderation transparency reports and audit trails.

**Requirements**:

- **Length**: Minimum 32 characters (256 bits)
- **Entropy**: High entropy random string (use cryptographically secure random generation)
- **Format**: Base64-encoded or hexadecimal string
- **Storage**: Must be stored as a secret in your secrets manager (AWS Secrets Manager, Azure Key Vault, etc.)

**Generation**:

```bash
# Generate a secure 32-byte (256-bit) random salt
openssl rand -base64 32

# Or using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**Rotation Policy**:

- Rotate annually or upon security incidents
- Maintain backward compatibility during transition period (support old salt for decryption)
- Update `PII_SALT_VERSION` when rotating
- Archive old salts for historical data decryption

**Example Environment Configuration**:

```bash
# In your secrets manager or .env.production
PII_SCRUBBING_SALT=your-32-character-minimum-high-entropy-salt-here
PII_SALT_VERSION=v1.0
```

**Security Considerations**:

- Never commit to version control
- Restrict access to production deployment systems only
- Monitor for unauthorized access attempts
- Use different salts for different environments (development, staging, production)

#### Other Required Variables

See `env.js` for the complete list of required environment variables for production deployment.

## Secrets Management

### AWS Secrets Manager (Recommended)

```json
{
  "GrowBro/Production": {
    "PII_SCRUBBING_SALT": "your-secure-salt-here",
    "SUPABASE_SERVICE_ROLE_KEY": "your-service-role-key",
    "DSA_TRANSPARENCY_DB_API_KEY": "your-api-key"
  }
}
```

### Environment File Structure

Create `.env.production` with references to your secrets manager:

```bash
# .env.production
APP_ENV=production
PII_SCRUBBING_SALT=${AWS_SECRET:GrowBro/Production:PII_SCRUBBING_SALT}
SUPABASE_SERVICE_ROLE_KEY=${AWS_SECRET:GrowBro/Production:SUPABASE_SERVICE_ROLE_KEY}
DSA_TRANSPARENCY_DB_API_KEY=${AWS_SECRET:GrowBro/Production:DSA_TRANSPARENCY_DB_API_KEY}
```

## Deployment Checklist

### Pre-Deployment

- [ ] All environment variables configured in secrets manager
- [ ] PII_SCRUBBING_SALT meets length and entropy requirements
- [ ] Database migrations applied
- [ ] SSL certificates valid
- [ ] DNS configured correctly

### Security Validation

- [ ] Secrets not exposed in logs or error messages
- [ ] PII scrubbing functioning correctly
- [ ] Audit trails enabled and monitored
- [ ] Access controls configured

### Post-Deployment

- [ ] Environment variables loaded correctly
- [ ] Application starts without errors
- [ ] PII scrubbing salt accessible to application
- [ ] Monitoring and alerting configured

## Monitoring and Alerting

### Key Metrics to Monitor

- PII scrubbing failures
- Audit trail integrity violations
- Unauthorized access attempts to secrets
- Environment variable loading errors

### Log Aggregation

Ensure PII_SCRUBBING_SALT and other secrets are not logged:

```javascript
// Never log sensitive values
console.log('Salt loaded:', piiSalt); // ❌ BAD
console.log('Salt loaded successfully'); // ✅ GOOD
```

## Troubleshooting

### Common Issues

**PII_SCRUBBING_SALT not found**:

- Check secrets manager permissions
- Verify environment variable name matches `env.js` schema
- Ensure salt meets minimum length requirements

**Invalid salt format**:

- Verify salt is properly encoded (Base64/hex)
- Check for special characters that may cause parsing issues

**Salt rotation issues**:

- Ensure old salt is archived for decryption
- Update PII_SALT_VERSION
- Test decryption of historical data
