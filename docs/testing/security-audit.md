# Security Audit - AI Photo Diagnosis Integration

**Version**: 1.0  
**Last Updated**: October 26, 2025  
**Task**: 12.2 - Security Audit

---

## Table of Contents

1. [Overview](#overview)
2. [Data Handling](#data-handling)
3. [Privacy Controls](#privacy-controls)
4. [Authentication & Authorization](#authentication--authorization)
5. [Image Security](#image-security)
6. [Database Security](#database-security)
7. [API Security](#api-security)
8. [Testing Procedures](#testing-procedures)

---

## Overview

### Scope

This audit covers security aspects of the AI Photo Diagnosis integration:

- Assessment data handling
- Image redaction and privacy
- User authentication and authorization
- Database access controls (local WatermelonDB)
- API endpoint security
- Data deletion and cascades

**Storage Architecture**: Assessments are stored locally in WatermelonDB with encryption and access controls. The `redactAssessmentForCommunity` and `computeFilenameKey` functions operate on local WatermelonDB collections rather than Supabase tables.

### Security Principles

1. **Privacy by Design**: User data protected by default
2. **Least Privilege**: Minimum necessary access
3. **Defense in Depth**: Multiple security layers
4. **Secure by Default**: Safe defaults, explicit opt-ins
5. **Audit Trail**: All actions logged

---

## Data Handling

### Assessment Data Storage

**Requirement**: Assessment data must be stored securely with proper access controls

**Architecture**: Assessments are stored locally in WatermelonDB with encryption and access controls. The `redactAssessmentForCommunity` and `computeFilenameKey` functions operate on local WatermelonDB collections rather than Supabase tables.

#### Checklist

- [ ] **Local Storage (WatermelonDB)**
  - [ ] Database encrypted at rest
  - [ ] No sensitive data in plain text
  - [ ] Proper field sanitization
  - [ ] No PII in assessment records

- [ ] **Server Storage (Supabase)**
  - [ ] RLS policies enforce user-scoped access
  - [ ] No cross-user data leakage
  - [ ] Proper foreign key constraints
  - [ ] Cascade deletes configured

#### Test Procedure

```typescript
// Test local access control - WatermelonDB assessments
import { database } from '@/lib/watermelon';
import { Q } from '@nozbe/watermelondb';

// As user A, try to access user B's assessments
const assessments = await database.collections
  .get('assessments')
  .query(Q.where('user_id', 'user-b-id'))
  .fetch();
// Expected: 0 rows (access denied - only own data visible)

// Test cascade deletes (when user deleted, assessments remain locally)
// Note: Local data is not automatically deleted with user account
// User must explicitly delete local data or use account deletion flow
```

#### Verification

```typescript
// Test local access control
import { database } from '@/lib/watermelon';

// Attempt to query another user's data
const assessments = await database.collections
  .get('assessments')
  .query(Q.where('user_id', 'other-user-id'))
  .fetch();

console.log('Cross-user access:', assessments.length);
// Expected: 0 (should only see own data)
```

---

### Personal Information

**Requirement**: No PII stored in assessment records

#### Sensitive Data to Avoid

- ❌ GPS coordinates
- ❌ Device identifiers (IMEI, serial numbers)
- ❌ User's real name
- ❌ Email addresses
- ❌ Phone numbers
- ❌ Home addresses
- ❌ Precise timestamps (use relative)

#### Allowed Data

- ✅ User ID (UUID)
- ✅ Plant ID (UUID)
- ✅ Assessment class
- ✅ Confidence scores
- ✅ Model version
- ✅ Inference mode (device/cloud)
- ✅ Relative timestamps

#### Checklist

- [ ] Review AssessmentModel fields
- [ ] Verify no PII in plant_context
- [ ] Check action_plan doesn't leak data
- [ ] Confirm metadata is sanitized
- [ ] Test JSON fields for PII

---

## Privacy Controls

### User Consent

**Requirement**: Explicit consent for data usage

#### Checklist

- [ ] **Training Data Consent**
  - [ ] `consented_for_training` field exists
  - [ ] Default value is `false`
  - [ ] UI clearly explains usage
  - [ ] User can revoke consent

- [ ] **Community Sharing**
  - [ ] Opt-in for sharing assessments
  - [ ] Clear privacy notice
  - [ ] Images redacted before sharing
  - [ ] User controls visibility

#### Test Procedure

```typescript
// Verify default consent is false
const assessment = await createAssessment({...});
expect(assessment.consentedForTraining).toBe(false);

// Verify consent can be changed
await assessment.update(a => {
  a.consentedForTraining = true;
});
expect(assessment.consentedForTraining).toBe(true);
```

---

### Data Retention

**Requirement**: User can delete their data

#### Checklist

- [ ] **Deletion Flows**
  - [ ] User can delete individual assessments
  - [ ] User can delete all assessments
  - [ ] Account deletion removes all data
  - [ ] Cascade deletes work correctly

- [ ] **Retention Policies**
  - [ ] Deleted data purged within 30 days
  - [ ] Backups exclude deleted data after 90 days
  - [ ] No "soft deletes" for sensitive data

#### Test Procedure

```typescript
// Test assessment deletion
const assessment = await createAssessment({...});
await assessment.markAsDeleted();

// Verify not accessible
const found = await getAssessmentById(assessment.id);
expect(found).toBeNull();

// Test cascade delete
await deleteUser(userId);
const userAssessments = await getAssessmentsByUserId(userId);
expect(userAssessments).toHaveLength(0);
```

---

## Authentication & Authorization

### JWT Validation

**Requirement**: All API requests must have valid JWT

#### Checklist

- [ ] **Token Validation**
  - [ ] JWT signature verified
  - [ ] Token expiration checked
  - [ ] Issuer validated
  - [ ] Audience validated

- [ ] **Token Refresh**
  - [ ] Refresh token flow secure
  - [ ] Old tokens invalidated
  - [ ] Rate limiting on refresh

#### Test Procedure

```bash
# Test with invalid token
curl -H "Authorization: Bearer invalid-token" \
  https://api.growbro.app/assessments

# Expected: 401 Unauthorized

# Test with expired token
curl -H "Authorization: Bearer expired-token" \
  https://api.growbro.app/assessments

# Expected: 401 Unauthorized

# Test with valid token
curl -H "Authorization: Bearer valid-token" \
  https://api.growbro.app/assessments

# Expected: 200 OK with user's assessments
```

---

### Local Database Access Control

**Requirement**: WatermelonDB access controls prevent unauthorized data access

#### Access Control Implementation

1. **Assessment Collections**
   - User-scoped queries filter by `user_id`
   - No cross-user data access in application code
   - Database operations use authenticated user context

2. **Assessment Classes**
   - Shared read-only reference data
   - No user-specific restrictions needed

#### Checklist

- [ ] Application code uses user-scoped queries
- [ ] No direct cross-user data access
- [ ] User context properly validated
- [ ] Local database encrypted at rest

#### Test Procedure

```typescript
// Test as user A - WatermelonDB access control
import { database } from '@/lib/watermelon';
import { Q } from '@nozbe/watermelondb';

// User A's assessments (when authenticated as user A)
const userAQuery = database.collections
  .get('assessments')
  .query(Q.where('user_id', 'user-a-id'));

const userAData = await userAQuery.fetch();
console.log('User A sees:', userAData.length);
// Expected: Only user A's assessments

// Attempt cross-user access (should be prevented by application logic)
const crossUserQuery = database.collections
  .get('assessments')
  .query(Q.where('user_id', 'user-b-id'));

const crossUserData = await crossUserQuery.fetch();
console.log('Cross-user access:', crossUserData.length);
// Expected: 0 (application should prevent this query)
```

---

## Image Security

### EXIF Data Stripping

**Requirement**: All images shared to community must have EXIF data removed

#### EXIF Data to Remove

- GPS coordinates (latitude, longitude, altitude)
- Device make and model
- Software version
- Timestamp (original, digitized)
- Camera settings (ISO, aperture, shutter speed)
- User comments
- Copyright information
- Thumbnail images

#### Checklist

- [ ] **Redaction Process**
  - [ ] EXIF data stripped before upload
  - [ ] GPS coordinates removed
  - [ ] Device info removed
  - [ ] Timestamps randomized
  - [ ] Verification automated

- [ ] **Implementation**
  - [ ] Uses `expo-image-manipulator`
  - [ ] No EXIF preserved
  - [ ] Re-encoding strips metadata
  - [ ] Filenames randomized

#### Test Procedure

```typescript
// Test EXIF stripping using actual implementation
import { redactAssessmentForCommunity } from '@/lib/assessment/assessment-redaction';
import { stripExifAndGeolocation } from '@/lib/media/exif';

// Original image with EXIF
const originalUri = 'file:///path/to/image-with-exif.jpg';

// Verify EXIF stripping via re-encoding (expo-image-manipulator)
const stripResult = await stripExifAndGeolocation(originalUri);
console.log('EXIF stripping successful:', stripResult.didStrip);

// Redacted image for community sharing
const { redactedImageUri } = await redactAssessmentForCommunity(
  originalUri,
  plantContext
);

// Verify re-encoding produced a different file
expect(redactedImageUri).not.toBe(originalUri);

// Note: Direct EXIF verification not possible without external tools
// since expo-image-manipulator strips EXIF during re-encoding.
// Manual verification should be done with exiftool as described below.
```

#### Manual Verification

1. Take photo with GPS-enabled device
2. Complete assessment
3. Share to community
4. Download shared image
5. Check EXIF with tool: `exiftool downloaded-image.jpg`
6. Verify no sensitive data present

---

### Filename Security

**Requirement**: Filenames must not be linkable to users or assessments

#### Checklist

- [ ] **Filename Generation**
  - [ ] Uses HMAC-SHA256
  - [ ] Content-addressable
  - [ ] No user IDs in filename
  - [ ] No sequential IDs
  - [ ] No timestamps in filename

- [ ] **Collision Handling**
  - [ ] Hash collisions detected
  - [ ] Unique filenames guaranteed
  - [ ] No overwrites possible

#### Test Procedure

```typescript
// Test filename generation
import { computeFilenameKey } from '@/lib/assessment/image-storage';

const filename1 = await computeFilenameKey(imageData1);
const filename2 = await computeFilenameKey(imageData2);

// Verify no user ID in filename
expect(filename1).not.toContain(userId);
expect(filename2).not.toContain(userId);

// Verify randomness
expect(filename1).not.toEqual(filename2);

// Verify same content = same filename (content-addressable)
const filename1Again = await computeFilenameKey(imageData1);
expect(filename1).toEqual(filename1Again);
```

---

## Database Security

### SQL Injection Prevention

**Requirement**: All queries must be parameterized

#### Checklist

- [ ] **WatermelonDB Queries**
  - [ ] Uses query builder (no raw SQL)
  - [ ] Parameters properly escaped
  - [ ] No string concatenation in queries

- [ ] **Supabase Queries**
  - [ ] Uses client library (not raw SQL)
  - [ ] Parameters passed as objects
  - [ ] No dynamic SQL construction

#### Test Procedure

```typescript
// Bad: SQL injection vulnerable
const plantId = "'; DROP TABLE assessments; --";
const query = `SELECT * FROM assessments WHERE plant_id = '${plantId}'`;
// DON'T DO THIS!

// Good: Parameterized query
const assessments = await database.collections
  .get('assessments')
  .query(Q.where('plant_id', plantId))
  .fetch();
// Safe from injection
```

---

### Data Encryption

**Requirement**: Sensitive data encrypted at rest and in transit

#### Checklist

- [ ] **At Rest**
  - [ ] WatermelonDB database encrypted
  - [ ] Supabase storage encrypted (AES-256)
  - [ ] Backup encryption enabled

- [ ] **In Transit**
  - [ ] HTTPS/TLS 1.2+ for all API calls
  - [ ] Certificate pinning (optional)
  - [ ] No mixed content

#### Test Procedure

```bash
# Verify HTTPS
curl -v https://api.growbro.app/assessments 2>&1 | grep "SSL"

# Expected: TLS 1.2 or higher

# Test HTTP (should redirect or fail)
curl -v http://api.growbro.app/assessments

# Expected: 301 redirect to HTTPS or connection refused
```

---

## API Security

### Rate Limiting

**Requirement**: API endpoints must have rate limiting

#### Checklist

- [x] **Assessment Creation**
  - [x] Max 10 assessments per hour per user
  - [x] 429 status code on limit
  - [x] Retry-After header present
  - [x] Implemented in `ai-inference` Edge Function
  - [x] Uses atomic DB counter with TTL

- [x] **Task Creation**
  - [x] Max 50 tasks per hour per user
  - [x] Batch creation counted correctly
  - [x] Implemented in `sync-push` Edge Function
  - [x] Increments by batch size

- [x] **Community Posts**
  - [x] Max 5 posts per hour per user
  - [x] Implemented in `create-post` Edge Function
  - [x] Rate limit enforced before insert

#### Test Procedure

```typescript
// Test rate limiting
for (let i = 0; i < 15; i++) {
  try {
    await createAssessment({...});
  } catch (error) {
    if (i >= 10) {
      expect(error.status).toBe(429);
      expect(error.headers['retry-after']).toBeDefined();
    }
  }
}
```

---

### Input Validation

**Requirement**: All inputs must be validated

#### Checklist

- [ ] **Assessment Data**
  - [ ] Plant ID format validated (UUID)
  - [ ] Confidence scores in range [0, 1]
  - [ ] Model version format checked
  - [ ] Image count limited (max 3)

- [ ] **Task Data**
  - [ ] Title length limited (max 200 chars)
  - [ ] Description length limited (max 1000 chars)
  - [ ] Due date in valid range
  - [ ] Timezone validated (IANA)

- [ ] **Community Post**
  - [ ] Title length limited
  - [ ] Body length limited
  - [ ] Tag count limited (max 5)
  - [ ] Image size limited (max 10MB each)

#### Test Procedure

```typescript
// Test invalid inputs
await expect(
  createAssessment({
    plantId: 'invalid-uuid',
    confidence: 1.5, // Out of range
  })
).rejects.toThrow();

// Test XSS prevention
await expect(
  createTask({
    title: '<script>alert("xss")</script>',
  })
).rejects.toThrow();
```

---

## Testing Procedures

### Automated Security Tests

```typescript
// security.test.ts
describe('Security Tests', () => {
  describe('Authentication', () => {
    it('should reject requests without JWT', async () => {
      // Test implementation
    });

    it('should reject expired JWT', async () => {
      // Test implementation
    });
  });

  describe('Authorization', () => {
    it('should prevent cross-user data access', async () => {
      // Test implementation
    });

    it('should enforce RLS policies', async () => {
      // Test implementation
    });
  });

  describe('Data Privacy', () => {
    it('should strip EXIF data from images', async () => {
      // Test implementation
    });

    it('should generate non-linkable filenames', async () => {
      // Test implementation
    });
  });

  describe('Input Validation', () => {
    it('should reject invalid UUIDs', async () => {
      // Test implementation
    });

    it('should sanitize user input', async () => {
      // Test implementation
    });
  });
});
```

---

### Manual Security Testing

#### Penetration Testing Checklist

- [ ] **Authentication Bypass**
  - [ ] Try accessing API without token
  - [ ] Try using another user's token
  - [ ] Try modifying JWT payload

- [ ] **Authorization Bypass**
  - [ ] Try accessing other users' assessments
  - [ ] Try modifying other users' data
  - [ ] Try deleting other users' data

- [ ] **Data Leakage**
  - [ ] Check API responses for PII
  - [ ] Check error messages for sensitive info
  - [ ] Check logs for data exposure

- [ ] **Injection Attacks**
  - [ ] SQL injection attempts
  - [ ] XSS attempts in text fields
  - [ ] Path traversal attempts

---

## Security Findings

### Critical Issues (Immediate Fix Required)

| Issue | Severity | Description | Status | Fix |
| ----- | -------- | ----------- | ------ | --- |
|       |          |             |        |     |

### High Priority Issues

| Issue | Severity | Description | Status | Fix |
| ----- | -------- | ----------- | ------ | --- |
|       |          |             |        |     |

### Medium Priority Issues

| Issue | Severity | Description | Status | Fix |
| ----- | -------- | ----------- | ------ | --- |
|       |          |             |        |     |

### Low Priority Issues

| Issue | Severity | Description | Status | Fix |
| ----- | -------- | ----------- | ------ | --- |
|       |          |             |        |     |

---

## Sign-Off

### Audit Completion

- [ ] All checklist items reviewed
- [ ] Automated tests passing
- [ ] Manual testing complete
- [ ] No critical issues found
- [ ] High priority issues resolved
- [ ] Medium priority issues documented
- [ ] Low priority issues tracked

### Auditor Sign-Off

**Auditor Name**: **\*\***\_\_\_**\*\***  
**Date**: **\*\***\_\_\_**\*\***  
**Signature**: **\*\***\_\_\_**\*\***

**Summary**:

---

---

---

---

**Last Updated**: October 26, 2025  
**Version**: 1.0  
**Status**: Ready for Audit
