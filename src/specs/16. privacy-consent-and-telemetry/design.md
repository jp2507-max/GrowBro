# Privacy, Consent, and Telemetry Design

## Overview

This document outlines the privacy, consent, and telemetry architecture for GrowBro, ensuring compliance with data protection regulations while providing valuable insights for product improvement.

## Consent Management

### User Consent Purposes

```typescript
export const ConsentPurpose = {
  analytics: 'analytics',
  crashReporting: 'crashReporting',
  personalizedData: 'personalizedData',
  sessionReplay: 'sessionReplay',
} as const;

export type ConsentPurpose =
  (typeof ConsentPurpose)[keyof typeof ConsentPurpose];
```

### Processing Purposes

```typescript
export const ProcessingPurpose = {
  // User-controlled consent purposes
  analytics: 'analytics',
  crashReporting: 'crashReporting',
  personalizedData: 'personalizedData',
  sessionReplay: 'sessionReplay',
  // Essential processing purposes (not controlled by user consent)
  diagnosis: 'diagnosis',
  aiInference: 'aiInference',
  aiTraining: 'aiTraining',
} as const;

export type ProcessingPurpose =
  (typeof ProcessingPurpose)[keyof typeof ProcessingPurpose];
```

**Note:** `diagnosis`, `aiInference`, and `aiTraining` are essential processing purposes required for the core functionality of plant health assessment. These purposes are not controlled by user consent but are still governed by retention rules to ensure data minimization and compliance.

## Data Retention Policies

### Retention Policy Structure

```typescript
export interface RetentionPolicy {
  purpose: ProcessingPurpose;
  retentionPeriod: number; // in days
  retentionReason: string;
  legalBasis?: string;
}
```

### Default Retention Policies

```typescript
export const DEFAULT_RETENTION: Record<ProcessingPurpose, RetentionPolicy> = {
  [ProcessingPurpose.analytics]: {
    purpose: ProcessingPurpose.analytics,
    retentionPeriod: 365, // 1 year
    retentionReason: 'User behavior analysis and product improvement',
    legalBasis: 'User consent',
  },
  [ProcessingPurpose.crashReporting]: {
    purpose: ProcessingPurpose.crashReporting,
    retentionPeriod: 180, // 6 months
    retentionReason: 'Application stability and debugging',
    legalBasis: 'User consent',
  },
  [ProcessingPurpose.personalizedData]: {
    purpose: ProcessingPurpose.personalizedData,
    retentionPeriod: 365, // 1 year
    retentionReason: 'Personalized user experience',
    legalBasis: 'User consent',
  },
  [ProcessingPurpose.sessionReplay]: {
    purpose: ProcessingPurpose.sessionReplay,
    retentionPeriod: 90, // 3 months
    retentionReason: 'User interaction analysis and debugging',
    legalBasis: 'User consent',
  },
  [ProcessingPurpose.diagnosis]: {
    purpose: ProcessingPurpose.diagnosis,
    retentionPeriod: 730, // 2 years
    retentionReason: 'Plant health assessment and historical analysis',
    legalBasis: 'Contract performance (essential functionality)',
  },
  [ProcessingPurpose.aiInference]: {
    purpose: ProcessingPurpose.aiInference,
    retentionPeriod: 730, // 2 years
    retentionReason: 'AI model inference and plant health assessment',
    legalBasis: 'Contract performance (essential functionality)',
  },
  [ProcessingPurpose.aiTraining]: {
    purpose: ProcessingPurpose.aiTraining,
    retentionPeriod: 730, // 2 years
    retentionReason:
      'AI model training, validation, and continuous improvement',
    legalBasis: 'Contract performance (essential functionality)',
  },
};
```

### Custom Retention Policies

```typescript
export const CUSTOM_RETENTION_POLICIES: RetentionPolicy[] = [
  {
    purpose: ProcessingPurpose.diagnosis,
    retentionPeriod: 1095, // 3 years
    retentionReason: 'Extended retention for research and model validation',
    legalBasis: 'Contract performance (essential functionality)',
  },
  {
    purpose: ProcessingPurpose.aiInference,
    retentionPeriod: 1095, // 3 years
    retentionReason:
      'Extended retention for AI inference research and model validation',
    legalBasis: 'Contract performance (essential functionality)',
  },
  {
    purpose: ProcessingPurpose.aiTraining,
    retentionPeriod: 1095, // 3 years
    retentionReason: 'Extended retention for AI model improvement and research',
    legalBasis: 'Contract performance (essential functionality)',
  },
];
```

## Data Processing Categories

### Essential Processing (Not Consent-Controlled)

**Diagnosis Processing:**

- Plant image analysis for health assessment
- Issue detection and classification
- Actionable recommendations generation
- Historical analysis for treatment effectiveness

**AI Inference Processing:**

- Machine learning model inference
- Confidence scoring and uncertainty estimation
- Model validation and feedback collection

**AI Training Processing:**

- AI model training with user data
- Continuous learning from user interactions
- Model improvement and validation

### Consent-Controlled Processing

**Analytics:**

- User behavior tracking
- Feature usage statistics
- Performance metrics collection

**Crash Reporting:**

- Application error collection
- Stack trace analysis
- Device and system information

#### PII Redaction Requirements

**Default Behavior:** All crash reports must automatically redact PII and sensitive fields by default with no opt-out mechanism. Redaction must be applied before any data transmission or storage.

**Minimal Blacklist:** The following fields must always be redacted or hashed:

- User IDs (hash using SHA-256 with salt)
- Email addresses (redact domain and username separately)
- Phone numbers (complete redaction)
- IP addresses (complete redaction or anonymization)
- Device identifiers (IMEI, MAC addresses, etc. - complete redaction)
- Authentication tokens and API keys (complete redaction)
- Full file contents and attachments (complete redaction)
- Location data (coordinates, addresses - complete redaction)
- Sensitive configuration values (database credentials, API secrets)

**Redaction Strategy:**

- **Identifiers:** Hash with SHA-256 + salt or complete redaction
- **Free Text:** Redact using pattern matching or NLP-based detection
- **Stack Traces:** Remove filesystem paths and classnames containing usernames
- **Metadata:** Anonymize timestamps to day-level granularity

**Implementation Requirements:**

- All logs and third-party crash reporters (Sentry, etc.) must apply identical redaction rules
- Configurable safe allowlist for additional non-PII fields when explicitly required for debugging
- Redaction must be applied at the source before any network transmission
- Failed redaction attempts must result in report rejection, not transmission

**Testing & Validation:**

- Include unit tests for redaction patterns and hash generation
- Implement telemetry schema versioning to ensure redaction behavior consistency
- Regular audits of crash reports to verify no PII leakage

**Personalized Data:**

- User profile information
- Preference data
- Behavioral insights

**Session Replay:**

- User interaction recording
- UI/UX analysis
- Bug reproduction assistance
- **Default masking**: Blur/redact all text inputs, images of people/plants, and system toasts; capture layouts only
- **Sensitive screens exclusion**: Authentication flows, settings pages, photo uploads automatically excluded
- **User controls**: In-app "pause recording" toggle and granular opt-in controls
- **Technical safeguards**: Real-time content detection to prevent accidental PII capture

## Implementation Guidelines

### Data Collection

1. **Essential Data**: Diagnosis and aiInference data is collected automatically as part of core functionality without requiring user consent, as these are critical for app stability and user experience optimization.

2. **Non-Essential Telemetry Gating**: All non-essential telemetry (analytics, usage tracking, performance monitoring, crash reporting, aiTraining, and other consented processing purposes) must be gated until explicit user consent is granted. SDK initialization for crash reporting and other consented processing purposes must be deferred until explicit user consent is obtained.

3. **Pre-Consent Event Handling**:

   - **Buffering Strategy**: Non-essential telemetry events generated before consent may be buffered locally on-device for a maximum of 24 hours
   - **Drop Policy**: Events older than 24 hours or exceeding buffer capacity must be dropped without transmission
   - **Consent Requirement for Reuse**: Buffered events may only be transmitted after explicit consent is granted; no automatic transmission occurs
   - **Buffer Limits**: Implement device storage limits (max 10MB) with automatic cleanup of oldest events when exceeded

4. **SDK Initialization Requirements**:

   - **Essential SDKs**: May initialize immediately as part of core app functionality (diagnosis)
   - **Non-Essential SDKs**: Must not initialize or transmit any data until explicit user consent is granted
   - **Deferred Initialization**: Non-essential SDKs should implement lazy initialization patterns triggered only after consent
   - **No Pre-Consent Transmission**: Under no circumstances should non-essential telemetry be transmitted before consent, even if buffered

5. **Consent Data**: All other data collection requires explicit, informed user consent with clear purpose disclosure
6. **Data Minimization**: Only collect data necessary for the stated purpose
7. **Purpose Limitation**: Data collected for one purpose cannot be used for another without additional consent

### Data Retention

1. **Automatic Deletion**: Implement automatic data deletion based on retention policies
2. **User Deletion**: Allow users to request deletion of their data at any time
3. **Audit Trail**: Maintain audit logs for data processing and deletion activities
4. **Compliance**: Ensure retention periods comply with applicable data protection laws

### User Rights

1. **Access**: Users can access all data collected about them
2. **Rectification**: Users can correct inaccurate data
3. **Erasure**: Users can request deletion of their data
4. **Portability**: Users can export their data in a portable format
5. **Objection**: Users can object to data processing based on legitimate interests

## Technical Implementation

### Database Schema

```sql
-- Prerequisites
CREATE EXTENSION IF NOT EXISTS pgcrypto;        -- for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pg_cron;         -- for scheduled cleanup

-- Enum for processing purposes (aligned with privacy-consent.ts)
CREATE TYPE processing_purpose_enum AS ENUM (
  'analytics', 'crashReporting', 'personalizedData', 'sessionReplay', 'diagnosis', 'aiInference', 'aiTraining'
);

-- Data processing tracking (dedicated schema for governance)
CREATE SCHEMA IF NOT EXISTS privacy;

CREATE TABLE privacy.data_processing_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  processing_purpose processing_purpose_enum NOT NULL,
  data_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  retention_until TIMESTAMPTZ NOT NULL,
  consent_applicable BOOLEAN NOT NULL DEFAULT TRUE,  -- false for essential purposes
  consent_given BOOLEAN,                             -- null when not applicable
  consent_timestamp TIMESTAMPTZ
);

-- Performance indexes
CREATE INDEX idx_dpe_user ON privacy.data_processing_events (user_id);
CREATE INDEX idx_dpe_retention ON privacy.data_processing_events (retention_until);
CREATE INDEX idx_dpe_purpose ON privacy.data_processing_events (processing_purpose);
CREATE INDEX idx_dpe_created_at ON privacy.data_processing_events (created_at);

-- Row Level Security
ALTER TABLE privacy.data_processing_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_can_manage_own_events"
  ON privacy.data_processing_events
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Automatic cleanup function
CREATE OR REPLACE FUNCTION privacy.cleanup_expired_data()
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM privacy.data_processing_events
  WHERE retention_until < NOW();
END;
$$;

-- Schedule daily cleanup at 02:00 UTC
SELECT cron.schedule(
  'privacy_cleanup_dpe',
  '0 2 * * *',
  $$SELECT privacy.cleanup_expired_data();$$
);
```

### Application Code Structure

```typescript
// lib/privacy/
export * from './consent-manager';
export * from './retention-manager';
export * from './data-processing-tracker';

// components/
export * from './privacy-settings';
export * from './data-rights-manager';
```

## Compliance Considerations

### GDPR Compliance

- **Lawful Basis**: Consent for user-controlled processing, contract performance for essential processing
- **Data Minimization**: Only collect necessary data
- **Storage Limitation**: Implement retention policies
- **Purpose Limitation**: Use data only for intended purposes
- **User Rights**: Implement all GDPR user rights

### Privacy by Design

- **Data Protection**: Built into system architecture
- **Privacy Defaults**: Privacy-friendly default settings
- **Transparency**: Clear privacy information and policies
- **Security**: Appropriate technical and organizational measures

## Testing Strategy

### Unit Tests

```typescript
describe('ProcessingPurpose', () => {
  it('should include all required processing purposes', () => {
    expect(Object.values(ProcessingPurpose)).toContain('diagnosis');
    expect(Object.values(ProcessingPurpose)).toContain('aiInference');
    expect(Object.values(ProcessingPurpose)).toContain('aiTraining');
  });
});

describe('RetentionPolicy', () => {
  it('should reference ProcessingPurpose instead of ConsentPurpose', () => {
    const policy = DEFAULT_RETENTION[ProcessingPurpose.diagnosis];
    expect(policy.purpose).toBe(ProcessingPurpose.diagnosis);
  });
});
```

### Integration Tests

- Consent management flow
- Data retention enforcement
- User rights implementation
- Audit logging verification

## Future Considerations

### Enhanced Privacy Features

- **Zero-Knowledge Processing**: Process data without accessing content
- **Federated Learning**: Train AI models without centralizing user data
- **Local Processing**: Move more processing to device for better privacy

### Advanced Compliance

- **Automated Compliance**: Automated compliance checking and reporting
- **Privacy Impact Assessment**: Regular privacy impact assessments
- **Data Protection Officer**: Integration with DPO workflows
