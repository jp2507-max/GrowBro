# Security Audit Guide - Moderation System

## Overview

This guide provides comprehensive procedures for conducting security audits of GrowBro's content moderation system, covering authentication, authorization, data protection, audit trail integrity, and compliance with GDPR Art. 32 security requirements.

## Audit Scope

### In-Scope Systems

- Content moderation infrastructure
- Reporting and appeals systems
- Statement of Reasons generation and submission
- Audit trail and logging systems
- Age verification system
- Geo-location services
- Commission DB integration
- ODS integration

### Out-of-Scope

- Core GrowBro application (separate audit)
- Third-party services (rely on vendor SOC 2 reports)
- Infrastructure layer (Supabase security)

## Security Audit Checklist

### 1. Authentication and Authorization

#### 1.1 Moderator Authentication

**Controls to Verify**:

- [ ] Multi-factor authentication (MFA) required for all moderators
- [ ] Password complexity requirements enforced
- [ ] Session timeout configured (max 8 hours)
- [ ] Failed login attempt lockout (5 attempts)
- [ ] Password rotation policy (90 days)

**Test Procedures**:

```bash
# Verify MFA enforcement
pnpm tsx scripts/audit/verify-mfa-enforcement.ts --role=moderator

# Test session timeout
pnpm tsx scripts/audit/test-session-timeout.ts --expected=28800

# Test lockout policy
pnpm tsx scripts/audit/test-lockout-policy.ts --max-attempts=5
```

**Evidence Required**:

- MFA configuration in Supabase Auth
- Session timeout settings
- Lockout policy configuration
- Recent authentication logs

#### 1.2 Role-Based Access Control (RBAC)

**Controls to Verify**:

- [ ] Moderator role (`mod_role`) enforced via JWT claims
- [ ] RLS policies prevent unauthorized data access
- [ ] Principle of least privilege applied
- [ ] Role assignments audited

**Test Procedures**:

```bash
# Test RLS policy enforcement
pnpm tsx scripts/audit/test-rls-policies.ts

# Verify role mappings
pnpm tsx scripts/audit/verify-role-mappings.ts

# Test unauthorized access attempts
pnpm tsx scripts/audit/test-unauthorized-access.ts
```

**Evidence Required**:

- RLS policy definitions
- Role assignment audit logs
- Access control test results

#### 1.3 API Authentication

**Controls to Verify**:

- [ ] Commission DB API credentials stored securely (env vars)
- [ ] ODS API credentials stored securely
- [ ] Age verification provider credentials secured
- [ ] No hardcoded credentials in code

**Test Procedures**:

```bash
# Scan for hardcoded credentials
pnpm tsx scripts/audit/scan-hardcoded-credentials.ts

# Verify environment variable encryption
pnpm tsx scripts/audit/verify-env-encryption.ts

# Test API key rotation procedures
pnpm tsx scripts/audit/test-api-key-rotation.ts
```

**Evidence Required**:

- Environment variable configuration
- Secrets management documentation
- API key rotation logs

### 2. Data Protection

#### 2.1 Encryption

**Controls to Verify**:

- [ ] Data at rest encrypted (AES-256)
- [ ] Data in transit encrypted (TLS 1.3)
- [ ] Database connections encrypted
- [ ] API communications encrypted

**Test Procedures**:

```bash
# Verify database encryption
pnpm tsx scripts/audit/verify-db-encryption.ts

# Test TLS configuration
pnpm tsx scripts/audit/test-tls-config.ts --min-version=1.3

# Scan for unencrypted connections
pnpm tsx scripts/audit/scan-unencrypted-connections.ts
```

**Evidence Required**:

- Supabase encryption configuration
- TLS certificate details
- Network traffic analysis

#### 2.2 PII Protection

**Controls to Verify**:

- [ ] PII scrubbing before Commission DB submission
- [ ] No raw ID storage in age verification
- [ ] Reporter contact data minimized
- [ ] Pseudonymization for transparency reporting

**Test Procedures**:

```bash
# Run PII scrubbing golden tests
pnpm test src/lib/moderation/__tests__/pii-scrubber.test.ts

# Verify no raw ID storage
pnpm tsx scripts/audit/verify-no-raw-id-storage.ts

# Test pseudonymization
pnpm tsx scripts/audit/test-pseudonymization.ts
```

**Evidence Required**:

- PII scrubbing test results
- Age verification database schema
- Pseudonymization algorithm documentation

#### 2.3 Data Retention

**Controls to Verify**:

- [ ] Retention schedules implemented
- [ ] Automated deletion workflows operational
- [ ] Legal hold exceptions handled
- [ ] Audit trail retention (7 years anonymized)

**Test Procedures**:

```bash
# Verify retention policies
pnpm tsx scripts/audit/verify-retention-policies.ts

# Test automated deletion
pnpm tsx scripts/audit/test-automated-deletion.ts

# Check legal hold handling
pnpm tsx scripts/audit/test-legal-hold.ts
```

**Evidence Required**:

- Retention schedule documentation
- Deletion workflow logs
- Legal hold procedures

### 3. Audit Trail Integrity

#### 3.1 Append-Only Enforcement

**Controls to Verify**:

- [ ] WORM triggers prevent UPDATE/DELETE
- [ ] RLS policies enforce append-only
- [ ] Partition immutability verified
- [ ] Tampering detection operational

**Test Procedures**:

```bash
# Test WORM enforcement
pnpm tsx scripts/audit/test-worm-enforcement.ts

# Attempt unauthorized modification
pnpm tsx scripts/audit/test-audit-tampering.ts

# Verify partition integrity
pnpm tsx scripts/verify-partition-checksums.ts
```

**Evidence Required**:

- WORM trigger definitions
- RLS policy configurations
- Tampering attempt logs
- Integrity verification results

#### 3.2 Cryptographic Signatures

**Controls to Verify**:

- [ ] Per-event HMAC-SHA256 signatures
- [ ] Signature verification operational
- [ ] Signer key rotation documented
- [ ] Signature validation in audit queries

**Test Procedures**:

```bash
# Verify signature generation
pnpm tsx scripts/audit/verify-signature-generation.ts

# Test signature validation
pnpm tsx scripts/audit/test-signature-validation.ts

# Test key rotation procedure
pnpm tsx scripts/audit/test-key-rotation.ts
```

**Evidence Required**:

- Signature algorithm documentation
- Key rotation procedures
- Signature validation logs

#### 3.3 Partition Checksums

**Controls to Verify**:

- [ ] Monthly partition checksums generated
- [ ] Checksum manifests signed
- [ ] Checksum verification automated
- [ ] Anomaly detection operational

**Test Procedures**:

```bash
# Verify checksum generation
pnpm tsx scripts/verify-partition-checksums.ts --all

# Test checksum validation
pnpm tsx scripts/audit/test-checksum-validation.ts

# Simulate partition corruption
pnpm tsx scripts/audit/simulate-partition-corruption.ts
```

**Evidence Required**:

- Checksum manifest files
- Verification logs
- Anomaly detection alerts

### 4. Input Validation and Sanitization

#### 4.1 Report Submission

**Controls to Verify**:

- [ ] Server-side validation for all inputs
- [ ] SQL injection prevention
- [ ] XSS prevention in free-text fields
- [ ] File upload validation (evidence)

**Test Procedures**:

```bash
# Test SQL injection prevention
pnpm tsx scripts/audit/test-sql-injection.ts

# Test XSS prevention
pnpm tsx scripts/audit/test-xss-prevention.ts

# Test file upload validation
pnpm tsx scripts/audit/test-file-upload-validation.ts
```

**Evidence Required**:

- Validation schema definitions
- Security test results
- WAF configuration (if applicable)

#### 4.2 API Input Validation

**Controls to Verify**:

- [ ] Zod schemas for all API inputs
- [ ] Rate limiting configured
- [ ] Request size limits enforced
- [ ] Content-Type validation

**Test Procedures**:

```bash
# Test input validation
pnpm tsx scripts/audit/test-api-input-validation.ts

# Test rate limiting
pnpm tsx scripts/audit/test-rate-limiting.ts

# Test request size limits
pnpm tsx scripts/audit/test-request-size-limits.ts
```

**Evidence Required**:

- API validation schemas
- Rate limiting configuration
- Request size limit settings

### 5. Secrets Management

#### 5.1 Environment Variables

**Controls to Verify**:

- [ ] No secrets in version control
- [ ] Environment variables encrypted
- [ ] Access to secrets restricted
- [ ] Secrets rotation documented

**Test Procedures**:

```bash
# Scan git history for secrets
pnpm tsx scripts/audit/scan-git-secrets.ts

# Verify environment variable security
pnpm tsx scripts/audit/verify-env-security.ts

# Test secrets access control
pnpm tsx scripts/audit/test-secrets-access.ts
```

**Evidence Required**:

- Git history scan results
- Secrets management documentation
- Access control logs

#### 5.2 API Keys and Tokens

**Controls to Verify**:

- [ ] API keys stored in secure vault
- [ ] Token expiration configured
- [ ] Key rotation procedures documented
- [ ] Compromised key revocation process

**Test Procedures**:

```bash
# Verify API key storage
pnpm tsx scripts/audit/verify-api-key-storage.ts

# Test token expiration
pnpm tsx scripts/audit/test-token-expiration.ts

# Test key rotation
pnpm tsx scripts/audit/test-key-rotation-procedure.ts
```

**Evidence Required**:

- API key storage configuration
- Token expiration settings
- Key rotation documentation

### 6. Network Security

#### 6.1 API Security

**Controls to Verify**:

- [ ] HTTPS enforced for all APIs
- [ ] CORS configured correctly
- [ ] API versioning implemented
- [ ] Deprecated endpoints disabled

**Test Procedures**:

```bash
# Test HTTPS enforcement
pnpm tsx scripts/audit/test-https-enforcement.ts

# Verify CORS configuration
pnpm tsx scripts/audit/verify-cors-config.ts

# Test deprecated endpoints
pnpm tsx scripts/audit/test-deprecated-endpoints.ts
```

**Evidence Required**:

- API security configuration
- CORS policy documentation
- Endpoint deprecation logs

#### 6.2 Third-Party Integrations

**Controls to Verify**:

- [ ] Commission DB API connection secured
- [ ] ODS API connection secured
- [ ] Age verification provider connection secured
- [ ] Certificate pinning (where applicable)

**Test Procedures**:

```bash
# Test Commission DB connection security
pnpm tsx scripts/audit/test-dsa-api-security.ts

# Test ODS connection security
pnpm tsx scripts/audit/test-ods-api-security.ts

# Verify certificate validation
pnpm tsx scripts/audit/verify-certificate-validation.ts
```

**Evidence Required**:

- Third-party API security configurations
- Certificate validation logs
- Connection security test results

### 7. Incident Response

#### 7.1 Detection and Monitoring

**Controls to Verify**:

- [ ] Security monitoring operational
- [ ] Anomaly detection configured
- [ ] Alert thresholds set
- [ ] Incident response plan documented

**Test Procedures**:

```bash
# Test security monitoring
pnpm tsx scripts/audit/test-security-monitoring.ts

# Test anomaly detection
pnpm tsx scripts/audit/test-anomaly-detection.ts

# Simulate security incident
pnpm tsx scripts/audit/simulate-security-incident.ts
```

**Evidence Required**:

- Monitoring configuration
- Alert definitions
- Incident response plan

#### 7.2 Breach Notification

**Controls to Verify**:

- [ ] Breach detection procedures documented
- [ ] Notification timelines defined (72 hours)
- [ ] DPO contact information current
- [ ] Supervisory authority contact information current

**Test Procedures**:

```bash
# Verify breach detection procedures
pnpm tsx scripts/audit/verify-breach-procedures.ts

# Test notification workflow
pnpm tsx scripts/audit/test-breach-notification.ts
```

**Evidence Required**:

- Breach notification procedures
- Contact information verification
- Notification templates

### 8. Compliance Controls

#### 8.1 DSA Compliance

**Controls to Verify**:

- [ ] All DSA articles implemented
- [ ] SLA monitoring operational
- [ ] Transparency reporting configured
- [ ] Audit trail completeness verified

**Test Procedures**:

```bash
# Run DSA compliance validation
pnpm tsx scripts/validate-dsa-compliance.ts

# Verify SLA monitoring
pnpm tsx scripts/audit/verify-sla-monitoring.ts

# Test transparency reporting
pnpm tsx scripts/audit/test-transparency-reporting.ts
```

**Evidence Required**:

- DSA compliance validation report
- SLA monitoring configuration
- Transparency report samples

#### 8.2 GDPR Compliance

**Controls to Verify**:

- [ ] Lawful bases documented
- [ ] Data minimization implemented
- [ ] Retention schedules enforced
- [ ] Subject rights procedures operational

**Test Procedures**:

```bash
# Verify lawful bases
pnpm tsx scripts/audit/verify-lawful-bases.ts

# Test data minimization
pnpm tsx scripts/audit/test-data-minimization.ts

# Test subject rights procedures
pnpm tsx scripts/audit/test-subject-rights.ts
```

**Evidence Required**:

- Lawful bases matrix
- Data minimization documentation
- Subject rights request logs

## Penetration Testing Scope

### 1. Authentication and Session Management

**Test Scenarios**:

- Brute force attack on login
- Session hijacking attempts
- Token manipulation
- MFA bypass attempts
- Password reset vulnerabilities

**Tools**:

- Burp Suite
- OWASP ZAP
- Custom scripts

### 2. Authorization and Access Control

**Test Scenarios**:

- Vertical privilege escalation (regular user → moderator)
- Horizontal privilege escalation (moderator A → moderator B data)
- RLS policy bypass attempts
- API endpoint authorization bypass

**Tools**:

- Burp Suite
- Postman
- Custom scripts

### 3. Input Validation

**Test Scenarios**:

- SQL injection in all input fields
- XSS in free-text fields
- Command injection
- Path traversal
- File upload vulnerabilities

**Tools**:

- SQLMap
- XSS Hunter
- Burp Suite
- Custom payloads

### 4. API Security

**Test Scenarios**:

- Rate limiting bypass
- API key enumeration
- Mass assignment vulnerabilities
- IDOR (Insecure Direct Object References)
- API versioning bypass

**Tools**:

- Postman
- Burp Suite
- Custom scripts

### 5. Data Protection

**Test Scenarios**:

- PII leakage in API responses
- Sensitive data in logs
- Unencrypted data transmission
- Database backup security

**Tools**:

- Wireshark
- Burp Suite
- Custom scripts

### 6. Audit Trail Tampering

**Test Scenarios**:

- Direct database modification attempts
- Signature bypass attempts
- Checksum manipulation
- Partition corruption

**Tools**:

- Database clients
- Custom scripts

## Vulnerability Severity Classification

### Critical

- Authentication bypass
- Privilege escalation to admin
- SQL injection with data exfiltration
- PII leakage in Commission DB submissions
- Audit trail tampering successful

**Response Time**: Immediate (< 4 hours)

### High

- XSS with session hijacking
- Unauthorized data access
- Rate limiting bypass
- Sensitive data in logs

**Response Time**: 24 hours

### Medium

- Information disclosure
- CSRF vulnerabilities
- Weak password policy
- Missing security headers

**Response Time**: 1 week

### Low

- Verbose error messages
- Missing HTTPS on non-sensitive endpoints
- Outdated dependencies (no known exploits)

**Response Time**: 1 month

## Security Audit Report Template

```markdown
# Security Audit Report - Moderation System

**Audit Date**: [DATE]
**Auditor**: [NAME/ORGANIZATION]
**Scope**: [DESCRIPTION]

## Executive Summary

[OVERVIEW OF FINDINGS]

## Findings

### Critical Findings

#### Finding 1: [TITLE]

- **Severity**: Critical
- **Description**: [DESCRIPTION]
- **Impact**: [IMPACT]
- **Recommendation**: [RECOMMENDATION]
- **Evidence**: [EVIDENCE]

### High Findings

[...]

### Medium Findings

[...]

### Low Findings

[...]

## Compliance Assessment

### DSA Compliance

- [ ] Art. 16 - Notice-and-Action
- [ ] Art. 17 - Statement of Reasons
- [ ] Art. 20 - Internal Complaints
- [ ] Art. 21 - ODS
- [ ] Art. 22 - Trusted Flaggers
- [ ] Art. 23 - Misuse Prevention
- [ ] Art. 24(5) - SoR Database
- [ ] Art. 28 - Age Verification
- [ ] Art. 15 & 24 - Transparency

### GDPR Compliance

- [ ] Art. 5 - Data Protection Principles
- [ ] Art. 6 - Lawful Bases
- [ ] Art. 25 - Privacy by Design
- [ ] Art. 32 - Security of Processing
- [ ] Art. 33/34 - Breach Notification

## Recommendations

### Immediate Actions

1. [ACTION]
2. [ACTION]

### Short-term Actions (1-3 months)

1. [ACTION]
2. [ACTION]

### Long-term Actions (3-12 months)

1. [ACTION]
2. [ACTION]

## Conclusion

[OVERALL ASSESSMENT]

**Sign-off**:

- Auditor: **\*\*\*\***\_\_\_**\*\*\*\***
- Date: **\*\*\*\***\_\_\_**\*\*\*\***
```

## Post-Audit Actions

### 1. Remediation Tracking

```bash
# Create remediation tickets
pnpm tsx scripts/audit/create-remediation-tickets.ts --report=[REPORT_FILE]

# Track remediation progress
pnpm tsx scripts/audit/track-remediation.ts
```

### 2. Re-testing

```bash
# Re-test critical findings
pnpm tsx scripts/audit/retest-findings.ts --severity=critical

# Verify remediation
pnpm tsx scripts/audit/verify-remediation.ts --finding-id=[ID]
```

### 3. Documentation Updates

- Update security documentation
- Update runbooks
- Update incident response procedures
- Update compliance documentation

## Audit Schedule

- **Initial Audit**: Before production deployment
- **Regular Audits**: Annually
- **Penetration Testing**: Annually
- **Compliance Audits**: Quarterly
- **Ad-hoc Audits**: After major changes or incidents

## References

- OWASP Top 10
- OWASP API Security Top 10
- GDPR Art. 32 - Security of Processing
- DSA Security Requirements
- NIST Cybersecurity Framework
- ISO 27001 Controls
