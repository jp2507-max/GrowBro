# Requirements Document

## Introduction

This feature implements comprehensive security hardening measures and incident response capabilities for the GrowBro mobile application. The system will protect sensitive user data through encryption, detect compromised devices, secure network communications, monitor security threats, validate PII handling, and establish clear workflows for vulnerability management and breach response. This is critical for maintaining user trust and regulatory compliance (GDPR, AI Act) in a privacy-sensitive application dealing with cannabis cultivation data.

**Scope Boundary:** This feature covers client-side security measures. Backend security controls, policy runbooks, and infrastructure monitoring are referenced where needed (Supabase, alerting systems) but implemented separately.

**Internationalization:** All user-facing warnings, modals, error messages, and notifications are localized in English (EN) and German (DE).

**Privacy & Data Minimization:** Security telemetry adheres to data minimization principles, including only necessary metadata without PII.

## Requirements

### Requirement 1: Secure Storage with MMKV Encryption

**User Story:** As a security-conscious user, I want my locally stored data to be encrypted at rest, so that my cultivation data remains protected even if my device is compromised.

#### Acceptance Criteria

1. WHEN the app initializes MMKV storage THEN it SHALL use react-native-mmkv with encryptionKey and store the key using react-native-keychain for platform-secure storage
2. WHEN the encryption key is generated THEN it SHALL be a 32-byte random key via platform CSPRNG and SHALL never be hardcoded or derived from user secrets
3. WHEN storing the key on Android THEN the system SHALL prefer hardware-backed Keystore
4. WHEN storing the key on iOS THEN the system SHALL set Keychain accessibility to AfterFirstUnlockThisDeviceOnly
5. WHEN sensitive data (auth tokens, user preferences, sync metadata) is stored THEN it SHALL be written to encrypted MMKV instances
6. WHEN key rotation is needed THEN the system SHALL support rekey via MMKV recrypt without data loss and log the rotation event without exposing key material
7. IF device compromise is suspected THEN the system SHALL trigger rekey on next launch
8. WHEN the app performs a security audit THEN an automated static scan SHALL verify that no sensitive keys or values are stored in AsyncStorage or unencrypted files
9. WHEN the app starts THEN a runtime self-check SHALL assert that MMKV instances are initialized with encryptionKey before the first sensitive write
10. IF encryption initialization fails THEN the system SHALL block access to sensitive areas, present a localized security-block screen with retry option, and capture a non-PII Sentry event
11. WHEN unit tests run THEN they SHALL verify encryption key generation path, recrypt call, and fallback behavior
12. WHEN audit evidence is requested THEN a one-click audit script SHALL output JSON proving encrypted instances are used for auth tokens, session, and sync metadata

### Requirement 2: Device Integrity Detection (Jailbreak/Root)

**User Story:** As a platform operator, I want to detect compromised devices, so that I can warn users about security risks and optionally restrict sensitive features.

#### Acceptance Criteria

1. WHEN the app launches THEN it SHALL perform jailbreak/root detection using a maintained detection library (e.g., react-native-root-detection) plus lightweight custom checks for suspicious paths and writable system directories
2. WHEN a jailbroken iOS device is detected THEN the system SHALL identify common indicators (Cydia, suspicious file paths, sandbox violations)
3. WHEN a rooted Android device is detected THEN the system SHALL identify common indicators (su binary, Magisk, unlocked bootloader)
4. WHEN high-assurance mode is enabled THEN the system SHALL optionally integrate Play Integrity API and Apple App Attest via backend attestation (feature-flagged)
5. WHEN detection completes THEN the system SHALL document that detection is best-effort and evasible, and should be combined with server-side attestation for high-risk scenarios
6. WHEN integrity status is determined THEN it SHALL be stored with a timestamp and expire after 24 hours, triggering a re-check
7. IF device integrity is compromised THEN the system SHALL display a localized warning modal (EN/DE) with security implications
8. WHEN the user acknowledges the warning THEN the system SHALL log a Sentry security event with coarse device metadata (no PII), integrity state, and active feature flags
9. WHEN a feature flag determines behavior THEN the system SHALL either hard-block sensitive actions (export, account linking) or warn-only based on configuration
10. WHEN unit tests run THEN they SHALL mock compromised and clean states, ensure state persistence, and verify re-check scheduling

### Requirement 3: TLS Certificate Pinning

**User Story:** As a security engineer, I want to prevent man-in-the-middle attacks on API communications, so that user data cannot be intercepted during transmission.

#### Acceptance Criteria

1. WHEN certificate pinning is implemented THEN it SHALL use a maintained native module with Expo config plugin support compatible with React Native 0.81 and Expo SDK 54
2. WHEN the app is built THEN pinning SHALL require EAS prebuild or custom dev client (not supported in Expo Go)
3. WHEN pins are configured THEN the system SHALL pin by SPKI hashes with at least one primary and one backup pin, preferring intermediate CA SPKI over leaf certificates when feasible
4. WHEN the app makes HTTPS requests to Supabase endpoints THEN it SHALL validate the server certificate against pinned SPKI hashes
5. IF a certificate validation fails THEN the system SHALL reject the connection, log a Sentry security event, and display a localized error message (EN/DE) advising users not to use insecure networks
6. WHEN certificate pins need updating THEN the system SHALL support OTA rotation via remote-config of allowed SPKI hashes with integrity enforcement (signed config or bundled fallback)
7. WHEN remote pin config is loaded THEN it SHALL use cache TTL and fail-closed only after bundle fallback check
8. WHEN the app is in development or staging mode THEN certificate pinning SHALL be bypassable via environment configuration
9. WHEN QA builds are tested THEN they SHALL test both strict pinning and bypassed flows
10. WHEN certificate expiry monitoring runs THEN a background job SHALL check cert chain validity weekly and log Sentry warnings 30 days before expiration
11. WHEN E2E tests run THEN a lab MITM attack SHALL lead to blocked requests and a Sentry event
12. WHEN pins are updated via remote-config THEN the update SHALL take effect without an app update, and fallback SHALL still allow connections when hashes match bundle pins

### Requirement 4: Threat Monitoring & Anomaly Detection

**User Story:** As a security operations team member, I want to monitor security-related events in real-time, so that I can detect and respond to potential threats quickly.

#### Acceptance Criteria

1. WHEN security events are defined THEN the system SHALL standardize event types: auth_failed, integrity_compromised, pin_violation, rate_limit_hit, session_anomaly, storage_rekey
2. WHEN a security event occurs THEN it SHALL be logged to Sentry with appropriate severity using a dedicated security logger category
3. WHEN multiple failed authentication attempts occur THEN the system SHALL implement exponential backoff client-side, cap attempts, and display a lockout timer
4. WHEN login attempts are logged THEN the system SHALL log the pattern without PII
5. WHEN suspicious API usage patterns are detected (rate limit violations, unusual endpoints) THEN the system SHALL flag them for review
6. WHEN token reuse from a different device is detected THEN the backend (Supabase Edge Function with refresh-token IP/device hints) SHALL flag the session anomaly
7. IF the server flags a session anomaly THEN the client SHALL react by signing out and displaying a notification to the user
8. WHEN security breadcrumbs are sent to Sentry THEN they SHALL use sampling to avoid noise and SHALL never include PII
9. WHEN critical security events occur THEN Sentry alerting SHALL trigger notifications to Slack or PagerDuty (configured externally)
10. WHEN unit tests run THEN they SHALL verify backoff logic and event payload redaction

### Requirement 5: Sentry PII Scrubbing Validation

**User Story:** As a privacy officer, I want to ensure that no personally identifiable information is sent to error tracking services, so that we remain GDPR compliant.

#### Acceptance Criteria

1. WHEN Sentry is initialized THEN it SHALL set sendDefaultPii to false
2. WHEN Sentry is configured THEN it SHALL set attachScreenshot to false for React Native to prevent PII leakage (or redact screenshots if later enabled)
3. WHEN Sentry processes events THEN it SHALL use beforeSend and beforeBreadcrumb hooks to strip emails, IP addresses, tokens, userId, cultivation notes, and EXIF data
4. WHEN HTTP requests are logged THEN the system SHALL mask Authorization headers and cookies, and drop request bodies for authentication endpoints
5. IF custom user context is added THEN it SHALL only include hashedId and non-PII device category
6. WHEN the Sentry project is configured THEN IP address collection SHALL be disabled in project settings
7. WHEN unit tests run THEN they SHALL simulate error capture and assert that scrubbing took effect
8. WHEN CI runs THEN a "leak sentinel" test SHALL fail if any event contains patterns like email addresses, IPv4/IPv6 addresses, or JWT-like strings
9. WHEN a PII leak is detected in Sentry THEN a documented playbook script SHALL enable bulk-deletion of affected issues by release or environment
10. WHEN the app sends error reports THEN it SHALL include a privacy-safe device fingerprint for debugging without exposing user identity
11. WHEN audit evidence is requested THEN the system SHALL provide configuration snapshots and passing test results

### Requirement 6: Vulnerability Management Workflow

**User Story:** As a development team lead, I want a structured process for identifying and remediating security vulnerabilities, so that we can maintain a secure codebase.

#### Acceptance Criteria

1. WHEN pull requests are created THEN the CI SHALL run pnpm audit and OSV/Dependabot scans (Snyk optional if licensed)
2. WHEN CI runs THEN it SHALL generate an SBOM in CycloneDX format and archive it as a build artifact
3. WHEN a vulnerability is discovered THEN it SHALL be triaged by severity with defined SLAs: Critical (24h), High (7d), Medium (30d), Low (90d)
4. IF a vulnerability cannot be immediately fixed THEN deferrals SHALL be documented with compensating controls
5. IF a critical vulnerability is found THEN the system SHALL automatically create a high-priority ticket tagged with CVE, ecosystem, and affected versions, and notify the security team within 24 hours
6. WHEN a vulnerability is remediated THEN the fix SHALL be documented with CVE references, linked to the commit, and include testing evidence
7. WHEN JavaScript-only security patches are released THEN they SHALL be deployed via Expo Updates OTA
8. WHEN native security patches are required THEN the system SHALL trigger an expedited EAS build and app store submission process
9. WHEN vulnerability scans complete THEN CI SHALL produce an audit report JSON and SBOM stored under build/reports/security with commit hash
10. WHEN a release is prepared THEN the release checklist SHALL include a "security delta" section documenting vulnerability changes

### Requirement 7: Breach Escalation Playbook

**User Story:** As an incident response coordinator, I want a clear playbook for handling security breaches, so that we can respond quickly and minimize user impact.

#### Acceptance Criteria

1. WHEN a potential breach is detected THEN the system SHALL trigger the incident response playbook
2. WHEN the playbook is activated THEN it SHALL define clear roles: Incident Commander, Technical Lead, Communications Lead, with designated deputies
3. WHEN user notification is required THEN the system SHALL provide localized notification templates (EN/DE) for users, partners, and data protection authorities
4. WHEN a breach timeline is tracked THEN the system SHALL monitor the 72-hour GDPR notification clock
5. IF user data is compromised THEN the system SHALL provide scripts for user notification within GDPR timelines
6. WHEN a breach is confirmed THEN the system SHALL document the timeline, affected users, data types, and impact in an incident report
7. IF credentials are compromised THEN the system SHALL force token invalidation, password resets (if applicable), and rotate API keys
8. WHEN evidence is preserved THEN the system SHALL export audit logs, preserve Sentry events, and capture device integrity statistics
9. IF the breach involves third-party services (Supabase, Sentry) THEN the playbook SHALL include vendor contacts, escalation paths, and contract IDs for coordination
10. WHEN the breach is contained THEN the system SHALL conduct a root-cause analysis with CWE references and track follow-up actions
11. WHEN the post-incident review completes THEN security controls SHALL be updated based on lessons learned
12. WHEN regulatory notification is required THEN the playbook SHALL include templates for data protection authority reporting
13. WHEN the playbook is maintained THEN the runbook document SHALL be stored in the repository with an executable table-top checklist
14. WHEN playbook readiness is verified THEN the team SHALL conduct drills at least annually

### Requirement 8: Security Audit & Compliance Reporting

**User Story:** As a compliance auditor, I want to generate security audit reports, so that I can verify adherence to security policies and regulatory requirements.

#### Acceptance Criteria

1. WHEN a security audit is requested THEN a scripted audit SHALL generate a signed JSON report including: MMKV encryption status, pinning status, PII scrubbing config snapshot, integrity check result cache, vulnerability scan summary, library versions, and timestamps
2. WHEN the audit runs THEN it SHALL verify encryption status, certificate pinning configuration, PII scrubbing settings, and device integrity check results
3. IF any security control fails validation THEN the report SHALL highlight the failure with remediation steps and links to documentation or playbooks
4. WHEN compliance reporting is needed THEN the system SHALL export audit logs in standardized formats (JSON and CSV)
5. WHEN reports are generated THEN they SHALL be written to build/reports/security with a content hash for integrity verification
6. WHEN the audit completes THEN it SHALL include timestamps, test results, configuration snapshots, and evidence artifacts
7. IF screenshots are needed for evidence THEN they SHALL be redacted before storage to prevent PII exposure
8. IF the app is preparing for a security review THEN the system SHALL provide a compliance checklist with evidence artifacts
9. WHEN the audit script runs locally or in CI THEN it SHALL exit with a non-zero code on blocking failures
10. WHEN the audit is executed THEN it SHALL be runnable both locally and in CI environments

## Cross-Cutting Concerns

### Privacy & Internationalization

- All user-visible strings, notifications, warnings, and error messages SHALL be localized in English (EN) and German (DE)
- Security telemetry SHALL adhere to data minimization principles, including only necessary metadata without PII
- User-facing security policies and runbooks SHALL be documented under docs/compliance and linked from audit reports

### Feature Flags & Environment Configuration

- Security strictness controls (warn-only vs. block) SHALL be managed via typed feature flags
- Certificate pinning bypass SHALL be configurable for development and staging environments
- Environment-specific security configurations SHALL be validated at build time

### Observability & Monitoring

- Security events SHALL use a dedicated Sentry logger category with appropriate sampling
- Critical security events SHALL always be sampled regardless of global sampling rates
- Security metrics SHALL be aggregated for threat intelligence dashboards and alerting

## Known Risks & Dependencies

1. **TLS Pinning Limitation**: Certificate pinning with Expo requires EAS prebuild and a compatible config plugin; it is not supported in Expo Go
2. **Device Integrity Detection**: Client-side detection is best-effort and evasible; high-assurance scenarios require Play Integrity API or Apple App Attest with backend verification
3. **OTA Pin Rotation**: Over-the-air pin rotation requires secure remote-config (signed or integrity-verified) to prevent downgrade attacks
4. **Platform Keystore Variability**: MMKV key protection depends on platform keystore/keychain configuration; certain Android devices may lack hardware-backed storage
5. **Backend Dependencies**: Session anomaly detection and token reuse prevention require backend implementation in Supabase Edge Functions
6. **Third-Party Coordination**: Breach response involving Supabase or Sentry requires established vendor contacts and escalation procedures
