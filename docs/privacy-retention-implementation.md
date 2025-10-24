# Privacy and Data Retention Implementation

## Overview

This document describes the implementation of GDPR-compliant data privacy and retention features for the GrowBro moderation system. The implementation covers:

1. **Data Minimization** (GDPR Art. 5(1)(c))
2. **Automated Data Retention and Deletion** (GDPR Art. 5(1)(e))
3. **User Data Access and Export** (GDPR Art. 15, 20)
4. **Privacy Notice Delivery and Consent Management** (GDPR Art. 7, 13)

## Architecture

### Core Services

#### 1. Data Minimization Service

**Location**: `src/lib/moderation/data-minimization-service.ts`

**Purpose**: Enforces GDPR data minimization principles by defining and validating what data can be collected for each purpose.

**Key Features**:

- Defines minimization rules for each data category
- Validates data collection against rules
- Filters data to only allowed fields
- Supports automatic anonymization based on data age
- Documents legal basis for data processing

**Data Categories**:

- `identity`: User identification data
- `contact`: Communication data
- `content`: User-generated content
- `behavioral`: Usage patterns
- `technical`: IP addresses, device info
- `moderation`: Reports, decisions, appeals
- `audit`: Audit logs and signatures

**Example Usage**:

```typescript
import { dataMinimizationService } from '@/lib/moderation/data-minimization-service';

// Validate data collection
const validation = dataMinimizationService.validateDataCollection('identity', [
  'user_id',
  'created_at',
  'email',
]);

if (!validation.isValid) {
  console.error('Violations:', validation.violations);
}

// Filter data to only allowed fields
const filtered = dataMinimizationService.filterData('identity', userData);

// Check if data should be anonymized
if (dataMinimizationService.shouldAnonymize('behavioral', ageInDays)) {
  const anonymized = dataMinimizationService.anonymizeData('behavioral', data);
}
```

#### 2. Data Retention Service

**Location**: `src/lib/moderation/data-retention-service.ts`

**Purpose**: Implements automated data retention and deletion workflows with legal hold support.

**Key Features**:

- Configurable retention periods by data category
- Two-stage deletion (logical → physical)
- Legal hold management
- Grace period before physical deletion
- Automated cleanup of expired records

**Retention Periods**:

- Identity/Contact/Content: 5 years (1825 days)
- Behavioral: 1 year (365 days)
- Technical: 90 days
- Moderation: 5 years (regulatory requirement)
- Audit: 7 years (2555 days)

**Grace Period**: 30 days (tombstone period)

**Example Usage**:

```typescript
import { dataRetentionService } from '@/lib/moderation/data-retention-service';

// Check if data has expired
const isExpired = dataRetentionService.isExpired('technical', createdAt);

// Create legal hold
await dataRetentionService.createLegalHold({
  targetType: 'report',
  targetId: reportId,
  reason: 'Active investigation',
  legalBasis: 'Criminal investigation request',
  createdBy: moderatorId,
  reviewDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
});

// Process expired records
const result = await dataRetentionService.processExpiredRecords(
  'content_reports',
  'moderation',
  50 // batch size
);

// Process tombstoned records for physical deletion
const physicalResult = await dataRetentionService.processTombstonedRecords(
  'content_reports',
  50
);
```

#### 3. User Data Export Service

**Location**: `src/lib/moderation/user-data-export-service.ts`

**Purpose**: Implements GDPR right to access (Art. 15) and data portability (Art. 20).

**Key Features**:

- Create data subject access requests
- Export user data by category
- Multiple export formats (JSON, CSV, XML)
- Verification token system
- Anonymized behavioral data export

**Supported Export Formats**:

- JSON: Structured data export
- CSV: Tabular data export
- XML: Structured markup export
- PDF: (Planned) Human-readable export

**Example Usage**:

```typescript
import { userDataExportService } from '@/lib/moderation/user-data-export-service';

// Create access request
const request = await userDataExportService.createAccessRequest(
  userId,
  'access'
);

// Export user data
const dataPackage = await userDataExportService.exportUserData({
  userId,
  format: 'json',
  includeCategories: ['identity', 'content', 'moderation'],
  dateRange: {
    from: new Date('2023-01-01'),
    to: new Date('2024-01-01'),
  },
});

// Format for download
const exportFile = await userDataExportService.formatDataPackage(
  dataPackage,
  'json'
);

// Complete request
await userDataExportService.completeAccessRequest(request.id, exportUrl);
```

#### 4. Privacy Consent Service

**Location**: `src/lib/moderation/privacy-consent-service.ts`

**Purpose**: Manages user consent and privacy notice delivery.

**Key Features**:

- Privacy notice versioning
- Consent recording and withdrawal
- Consent history tracking
- Consent validation for data processing
- Bulk consent renewal

**Consent Purposes**:

- `content_moderation`: Processing reports and decisions (legal obligation)
- `behavioral_analytics`: Usage pattern analysis (requires consent)
- `gps_location`: Precise GPS location (requires explicit consent)
- `device_fingerprinting`: Device fingerprinting (ePrivacy 5(3) consent)
- `marketing_communications`: Marketing emails (requires consent)

**Example Usage**:

```typescript
import { privacyConsentService } from '@/lib/moderation/privacy-consent-service';

// Deliver privacy notice
const { notice, delivered } = await privacyConsentService.deliverPrivacyNotice(
  userId,
  'en'
);

// Record consent
await privacyConsentService.recordConsent(
  userId,
  'gps_location',
  'consent',
  notice.version,
  true
);

// Check consent
const hasConsent = await privacyConsentService.hasConsent(
  userId,
  'gps_location'
);

// Withdraw consent
await privacyConsentService.withdrawConsent(userId, 'gps_location');

// Validate consent requirements
const validation = await privacyConsentService.validateConsentRequirements(
  userId,
  ['gps_location', 'behavioral_analytics']
);

if (!validation.valid) {
  console.log('Missing consents:', validation.missingConsents);
}
```

## Database Schema

### Tables

#### `legal_holds`

Stores legal holds preventing data deletion during investigations.

```sql
CREATE TABLE legal_holds (
  id UUID PRIMARY KEY,
  target_type TEXT NOT NULL,
  target_id UUID NOT NULL,
  reason TEXT NOT NULL,
  legal_basis TEXT NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  review_date TIMESTAMPTZ NOT NULL,
  released_at TIMESTAMPTZ,
  metadata JSONB
);
```

#### `data_deletion_records`

Audit trail of all data deletions (logical and physical).

```sql
CREATE TABLE data_deletion_records (
  id UUID PRIMARY KEY,
  target_type TEXT NOT NULL,
  target_id UUID NOT NULL,
  deletion_type TEXT NOT NULL, -- 'logical' or 'physical'
  deleted_at TIMESTAMPTZ NOT NULL,
  deleted_by TEXT NOT NULL,
  reason TEXT NOT NULL,
  retention_policy TEXT NOT NULL,
  tombstone_until TIMESTAMPTZ,
  metadata JSONB
);
```

#### `privacy_notices`

Privacy policy versions for GDPR transparency.

```sql
CREATE TABLE privacy_notices (
  id UUID PRIMARY KEY,
  version TEXT NOT NULL,
  effective_date TIMESTAMPTZ NOT NULL,
  content TEXT NOT NULL,
  language TEXT NOT NULL,
  data_categories TEXT[] NOT NULL,
  legal_bases TEXT[] NOT NULL,
  retention_periods JSONB NOT NULL,
  third_party_processors TEXT[]
);
```

#### `consent_records`

User consent records for GDPR compliance.

```sql
CREATE TABLE consent_records (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  purpose TEXT NOT NULL,
  legal_basis TEXT NOT NULL,
  consent_given BOOLEAN NOT NULL,
  consent_date TIMESTAMPTZ NOT NULL,
  withdrawn_date TIMESTAMPTZ,
  version TEXT NOT NULL,
  metadata JSONB
);
```

#### `data_subject_requests`

GDPR data subject access requests (Art. 15-22).

```sql
CREATE TABLE data_subject_requests (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  request_type TEXT NOT NULL,
  status TEXT NOT NULL,
  requested_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  export_url TEXT,
  verification_token TEXT NOT NULL,
  metadata JSONB
);
```

### Two-Stage Deletion

All moderation tables support two-stage deletion:

1. **Logical Deletion**: Record is marked as deleted with `deleted_at` timestamp and `tombstone_until` date
2. **Physical Deletion**: Record is permanently removed after tombstone period expires

**Added Columns**:

```sql
ALTER TABLE [table_name] ADD COLUMN deleted_at TIMESTAMPTZ;
ALTER TABLE [table_name] ADD COLUMN tombstone_until TIMESTAMPTZ;
```

## Automated Workflows

### Daily Retention Cleanup Job

**Recommended Schedule**: Daily at 2:00 AM UTC

```typescript
// Pseudo-code for scheduled job
async function dailyRetentionCleanup() {
  const tables = [
    { name: 'content_reports', category: 'moderation' },
    { name: 'posts', category: 'content' },
    { name: 'comments', category: 'content' },
    { name: 'user_activity', category: 'behavioral' },
  ];

  for (const table of tables) {
    // Process expired records (logical deletion)
    const expiredResult = await dataRetentionService.processExpiredRecords(
      table.name,
      table.category,
      100 // batch size
    );

    console.log(
      `Processed ${expiredResult.deleted} expired records in ${table.name}`
    );

    // Process tombstoned records (physical deletion)
    const tombstoneResult = await dataRetentionService.processTombstonedRecords(
      table.name,
      100
    );

    console.log(
      `Physically deleted ${tombstoneResult.deleted} records in ${table.name}`
    );
  }
}
```

### Legal Hold Review Job

**Recommended Schedule**: Weekly

```typescript
async function reviewLegalHolds() {
  const { data: holds } = await supabase
    .from('legal_holds')
    .select('*')
    .is('released_at', null)
    .lt('review_date', new Date().toISOString());

  // Notify administrators to review holds
  for (const hold of holds || []) {
    await notifyAdministrator({
      type: 'legal_hold_review_required',
      holdId: hold.id,
      reason: hold.reason,
      reviewDate: hold.review_date,
    });
  }
}
```

## Compliance Checklist

### GDPR Art. 5(1)(c) - Data Minimization

- [x] Define minimization rules for each data category
- [x] Validate data collection against rules
- [x] Filter collected data to only necessary fields
- [x] Document legal basis for each data category
- [x] Prohibit collection of sensitive data (SSN, passport, etc.)

### GDPR Art. 5(1)(e) - Storage Limitation

- [x] Define retention periods for each data category
- [x] Implement automated deletion workflows
- [x] Support legal holds for active investigations
- [x] Implement two-stage deletion (logical → physical)
- [x] Grace period before physical deletion
- [x] Audit trail for all deletions

### GDPR Art. 15 - Right to Access

- [x] Data subject access request system
- [x] Export user data by category
- [x] Multiple export formats (JSON, CSV, XML)
- [x] Verification token system
- [x] Anonymize behavioral data in exports

### GDPR Art. 20 - Right to Data Portability

- [x] Machine-readable export formats
- [x] Structured data export (JSON, XML)
- [x] Include all user-provided data
- [x] Exclude derived/inferred data

### GDPR Art. 7 - Conditions for Consent

- [x] Record consent with timestamp
- [x] Link consent to privacy policy version
- [x] Support consent withdrawal
- [x] Consent history tracking
- [x] Validate consent before processing

### GDPR Art. 13 - Information to be Provided

- [x] Privacy notice versioning
- [x] Deliver privacy notice to users
- [x] Track notice acknowledgment
- [x] Support multiple languages
- [x] Include data categories and legal bases

## Testing

### Unit Tests

**Location**: `src/lib/moderation/__tests__/data-privacy-services.test.ts`

**Coverage**:

- Data minimization validation
- Data filtering and anonymization
- Retention period calculation
- Expiry detection with grace periods
- Data export formatting
- Consent management

**Run Tests**:

```bash
pnpm test data-privacy-services
```

### Integration Tests

**Recommended Tests**:

1. End-to-end data subject access request
2. Automated retention cleanup workflow
3. Legal hold preventing deletion
4. Consent withdrawal cascading effects
5. Privacy notice delivery and acknowledgment

## Production Deployment

### Environment Variables

Add to `.env.production`:

```env
# Data retention configuration
DATA_RETENTION_GRACE_PERIOD_DAYS=30
DATA_RETENTION_AUDIT_DAYS=2555

# PII scrubbing (for transparency reporting)
PII_SCRUBBING_SALT=<generate-cryptographically-secure-salt>
PII_SALT_VERSION=v1.0
```

#### PII Scrubbing Salt Security Requirements

The `PII_SCRUBBING_SALT` must be a cryptographically strong random value of at least 32 bytes (256 bits) to ensure adequate entropy for PII anonymization. This salt is used in HMAC-based hashing to create irreversible anonymized identifiers for transparency reporting.

**Generation Commands:**

Generate using OpenSSL (Linux/macOS):

```bash
openssl rand -hex 32
```

Generate using PowerShell (Windows):

```powershell
[System.Web.Security.Membership]::GeneratePassword(64, 0)
```

Generate using Node.js (cross-platform):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Storage Requirements:**

- **Never store in version control** - even encrypted repositories
- Store in a secrets manager (AWS Secrets Manager, Azure Key Vault, HashiCorp Vault) or encrypted environment variables
- Implement strict access controls - only application runtime should have read access
- Use separate salts per environment (development, staging, production)

**Salt Rotation Strategy:**

- **Periodic Rotation**: Rotate salts every 90-180 days or annually based on risk assessment
- **Compromise Response**: Immediately rotate on suspected key compromise
- **Migration Approach**:
  - Generate new salt and increment `PII_SALT_VERSION` (e.g., v1.0 → v1.1)
  - Maintain old salts in secure storage for verification of historical data
  - Re-scrub existing anonymized data with new salt during low-traffic windows
  - Update application code to use new salt version for future scrubbing
  - Archive old salts with timestamps for compliance audit trails

**PII_SALT_VERSION Tracking:**

The `PII_SALT_VERSION` is tracked separately to enable deterministic algorithm and salt upgrades. This versioning allows:

- **Reprocessing**: Historical data can be re-anonymized with newer algorithms/salts
- **Migration Safety**: Prevents ambiguous salt usage during deployment rollouts
- **Audit Compliance**: Maintains chain of custody for data transformations
- **Rollback Capability**: Applications can revert to previous salt versions if needed

### Database Migration

Apply the privacy schema migration:

```bash
# Using Supabase CLI
supabase db push

# Or apply directly
psql -h <host> -U <user> -d <database> -f supabase/migrations/20251023_create_privacy_retention_schema.sql
```

### Scheduled Jobs

Set up the following scheduled jobs:

1. **Daily Retention Cleanup**: 2:00 AM UTC
2. **Weekly Legal Hold Review**: Monday 9:00 AM UTC
3. **Monthly Consent Renewal Check**: 1st of month, 10:00 AM UTC

### Monitoring

Monitor the following metrics:

- Records deleted per day (by table and category)
- Legal holds created/released
- Data subject access requests (pending/completed)
- Consent withdrawal rate
- Privacy notice delivery rate

## Security Considerations

1. **Access Control**: Only moderators and admins can access privacy management features
2. **Audit Logging**: All privacy-related actions are logged immutably
3. **Encryption**: Sensitive data encrypted at rest and in transit
4. **Verification**: Data subject requests require verification token
5. **Legal Holds**: Prevent accidental deletion during investigations

## Future Enhancements

1. **PDF Export**: Human-readable data export format
2. **Differential Privacy**: Enhanced anonymization for analytics
3. **Automated Consent Renewal**: Proactive consent management
4. **Data Breach Response**: Automated notification workflows
5. **Cross-Border Transfer Controls**: GDPR Chapter V compliance

## References

- [GDPR Full Text](https://gdpr-info.eu/)
- [ICO Data Protection Guide](https://ico.org.uk/for-organisations/guide-to-data-protection/)
- [EDPB Guidelines](https://edpb.europa.eu/our-work-tools/general-guidance/guidelines-recommendations-best-practices_en)
- [DSA Compliance](https://digital-strategy.ec.europa.eu/en/policies/digital-services-act-package)
