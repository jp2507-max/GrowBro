# Sentry PII Scrubbing - Security Audit Evidence

## Overview

This document provides audit evidence for the Sentry PII scrubbing baseline implementation (Task 6 of Security Hardening feature). This implementation satisfies Requirement 5 acceptance criteria for app review compliance.

## Configuration Summary

### Sentry Initialization Settings

**File**: `src/app/_layout.tsx`

```typescript
Sentry.init({
  dsn: Env.SENTRY_DSN,
  sendDefaultPii: false, // ✓ Requirement 5.1
  attachScreenshot: false, // ✓ Requirement 5.2
  beforeSend: beforeSendHook, // ✓ Requirement 5.3
  beforeBreadcrumb: beforeBreadcrumbHook, // ✓ Requirement 5.3
  // ... other config
});
```

### PII Scrubbing Patterns

**File**: `src/lib/sentry-utils.ts`

The following PII patterns are automatically scrubbed from all Sentry events and breadcrumbs:

- **Email addresses**: `test@example.com` → `[EMAIL_REDACTED]`
- **Phone numbers**: `+1-555-123-4567` → `[PHONE_REDACTED]`
- **IPv4 addresses**: `192.168.1.1` → `[IP_REDACTED]`
- **IPv6 addresses**: `2001:0db8:85a3::` → `[IP_REDACTED]`
- **JWT tokens**: `eyJhbGciOi...` → `[JWT_REDACTED]`
- **UUIDs**: `550e8400-e29b-41d4-a716-446655440000` → `[UUID_REDACTED]`
- **API keys**: `sk_live_<REDACTED>` → `[API_KEY_REDACTED]`
- **Credit cards**: `1234-5678-9012-3456` → `[CARD_REDACTED]`
- **SSN**: `123-45-6789` → `[SSN_REDACTED]`
- **Addresses**: `123 Main Street` → `[ADDRESS_REDACTED]`

### HTTP Header Redaction

**Requirement**: 5.4 - Mask Authorization headers and cookies

The following HTTP headers are automatically redacted:

- `Authorization` → `[REDACTED]`
- `Cookie` → `[REDACTED]`
- `Set-Cookie` → `[REDACTED]`
- `X-API-Key` → `[REDACTED]`
- `Api-Key` → `[REDACTED]`

### Request Body Filtering

**Requirement**: 5.4 - Drop request bodies for authentication endpoints

Request bodies are automatically dropped for the following endpoint patterns:

- `/auth/login`
- `/auth/signup`
- `/auth/register`
- `/profile/*`
- `/user/*`
- `/password/*`

### User Context Configuration

**Requirement**: 5.5 - Custom user context with non-PII only

**File**: `src/lib/sentry-utils.ts` - `setPrivacySafeUserContext()`

User context includes **only**:

- `hashedId`: SHA-256 hash of user ID with app-specific salt (non-reversible)
- `deviceCategory`: Generic device type (e.g., `ios-phone`, `android-tablet`)

**Excluded fields** (PII):

- Email
- Username
- Full name
- Phone number
- IP address

### Device Fingerprint Implementation

**Requirement**: 5.10 - Privacy-safe device fingerprint

**File**: `src/lib/security/device-fingerprint.ts`

- **Install ID**: Random UUID generated per installation
- **Hashed ID**: SHA-256 hash using app-specific salt (`DEVICE_FINGERPRINT_SALT`)
- **Salt constant**: `growbro_device_fp_v1_2025` (never logged, stored in code)
- **Device Category**: Non-identifying type (e.g., `ios-phone`)

## Testing Evidence

### Unit Tests

**File**: `src/lib/sentry-utils.test.ts`

Tests cover:

- Text sanitization for all PII patterns
- Object sanitization with nested structures
- Circular reference handling
- Array, Map, and Set handling
- Axios error object scrubbing
- Primitive type preservation

**Run tests**:

```bash
pnpm test src/lib/sentry-utils.test.ts
```

### CI Leak Sentinel Test

**Requirement**: 5.8 - CI test that fails on PII leakage

**File**: `src/lib/__tests__/sentry-pii-leak-sentinel.test.ts`

This test generates synthetic Sentry events with PII and verifies all patterns are scrubbed. It covers:

- Email scrubbing in exception messages
- IPv4/IPv6 scrubbing in breadcrumbs
- JWT token scrubbing
- UUID scrubbing in extra data
- Phone number scrubbing
- Authorization header redaction
- Cookie header redaction
- Request body dropping for auth endpoints
- User email redaction
- Comprehensive pattern coverage

**Run leak sentinel**:

```bash
pnpm test src/lib/__tests__/sentry-pii-leak-sentinel.test.ts
```

### Sentry Initialization Test

**File**: `src/app/__tests__/sentry-init.test.tsx`

Verifies Sentry configuration at initialization:

- `sendDefaultPii` is `false`
- `attachScreenshot` is `false`
- `beforeSend` hook is configured
- `beforeBreadcrumb` hook is configured

## Sentry Project Configuration Checklist

**Requirement**: 5.6 - IP address collection disabled in project settings

### Manual Steps (Sentry Dashboard)

These settings must be configured in the Sentry project dashboard:

1. **Navigate to**: Project Settings → Security & Privacy
2. **Set**: "Prevent Storing of IP Addresses" → **Enabled**
3. **Verify**: "Data Scrubbing" → **Enabled**
4. **Configure**: Additional sensitive field names if needed

### Verification

To verify IP collection is disabled:

1. Trigger a test error in the app
2. Check the Sentry event detail page
3. Confirm that the "IP Address" field shows as "not collected" or is absent
4. Verify user context does not include IP address

**Evidence Location**: Screenshots stored in `docs/security/sentry-ip-disabled-evidence.png` (to be captured)

## Compliance Summary

### Requirement 5 Acceptance Criteria Status

| Criterion                       | Status        | Evidence                                                         |
| ------------------------------- | ------------- | ---------------------------------------------------------------- |
| 5.1 - `sendDefaultPii: false`   | ✅ Complete   | `src/app/_layout.tsx:110`                                        |
| 5.2 - `attachScreenshot: false` | ✅ Complete   | `src/app/_layout.tsx:112`                                        |
| 5.3 - PII scrubbing hooks       | ✅ Complete   | `beforeSend` and `beforeBreadcrumb` in `src/lib/sentry-utils.ts` |
| 5.4 - Header/body masking       | ✅ Complete   | Authorization, Cookie redaction + auth endpoint body drop        |
| 5.5 - Non-PII user context      | ✅ Complete   | `setPrivacySafeUserContext()` with hashedId only                 |
| 5.6 - IP collection disabled    | ⚠️ Manual     | Requires Sentry dashboard configuration (checklist above)        |
| 5.7 - Unit tests                | ✅ Complete   | `sentry-utils.test.ts` passes                                    |
| 5.8 - CI leak sentinel          | ✅ Complete   | `sentry-pii-leak-sentinel.test.ts` covers all patterns           |
| 5.9 - Bulk-deletion playbook    | 📋 Documented | See "Incident Response" section below                            |
| 5.10 - Privacy-safe fingerprint | ✅ Complete   | `device-fingerprint.ts` with salted hash                         |
| 5.11 - Audit evidence           | ✅ Complete   | This document                                                    |

Legend:

- ✅ Complete: Implemented and tested
- ⚠️ Manual: Requires manual configuration
- 📋 Documented: Process documented, no code needed

## Incident Response: PII Leak Handling

**Requirement**: 5.9 - Bulk-deletion playbook for PII leaks

### If PII is detected in Sentry events:

1. **Immediate Action**:
   - Identify affected release version or time range
   - Note the issue ID or search query pattern

2. **Bulk Deletion** (Sentry Dashboard):
   - Navigate to: Issues → Select affected issues
   - Use bulk actions: "Delete" or "Merge & Delete"
   - Filter by release: `release:com.growbro@X.Y.Z`
   - Filter by environment: `environment:production`

3. **API-based Deletion** (for large datasets):

   ```bash
   # Using Sentry CLI
   sentry-cli releases delete com.growbro@X.Y.Z --confirm

   # Or use Sentry API
   curl -X DELETE \
   -H "Authorization: Bearer [REDACTED_AUTH_TOKEN]" \
     "https://sentry.io/api/0/projects/ORG/PROJECT/events/EVENT_ID/"
   ```

4. **Root Cause Analysis**:
   - Identify which scrubbing pattern failed
   - Add test case to `sentry-pii-leak-sentinel.test.ts`
   - Update `SENSITIVE_PATTERNS` in `sentry-utils.ts`
   - Deploy hotfix via Expo OTA update

5. **Prevention**:
   - Run CI leak sentinel on all changes to security code
   - Review Sentry events weekly for new PII patterns
   - Update patterns as new services are integrated

## Verification Commands

Run these commands to verify the implementation:

```bash
# Type check
pnpm tsc --noEmit

# Lint security code
pnpm lint src/lib/sentry-utils.ts src/lib/security/**

# Run all tests
pnpm test src/lib/sentry-utils.test.ts
pnpm test src/lib/__tests__/sentry-pii-leak-sentinel.test.ts
pnpm test src/app/__tests__/sentry-init.test.tsx

# Run with coverage
pnpm test src/lib/sentry-utils.test.ts --coverage
```

## References

- **Design Spec**: `.kiro/specs/25. security-hardening-incident-response/design.md` (Task 6)
- **Requirements**: `.kiro/specs/25. security-hardening-incident-response/requirements.md` (Requirement 5)
- **Sentry Documentation**: https://docs.sentry.io/platforms/react-native/data-management/sensitive-data/

## Audit Sign-off

**Implementation Date**: 2025-11-06

**Components Verified**:

- ✅ Sentry initialization with privacy settings
- ✅ beforeSend hook with comprehensive PII scrubbing
- ✅ beforeBreadcrumb hook for breadcrumb sanitization
- ✅ HTTP header and request body filtering
- ✅ Privacy-safe user context with hashed IDs
- ✅ Device fingerprint with salted hashing
- ✅ Unit tests with full pattern coverage
- ✅ CI leak sentinel test

**Pending Manual Steps**:

- ⚠️ Sentry project IP collection must be disabled in dashboard
- ⚠️ Screenshot evidence of IP setting to be captured

**Compliance Status**: **READY FOR APP REVIEW** (pending manual Sentry config)
