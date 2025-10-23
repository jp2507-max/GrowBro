# Audit Signer Key Rotation Standard Operating Procedure

## Overview

This document outlines the procedure for rotating the audit event signing key used for cryptographic integrity verification of audit trails. The signing key is used to generate HMAC-SHA256 signatures on all audit events and partition manifests to ensure tamper detection.

## Key Details

- **Algorithm**: HMAC-SHA256
- **Storage**: Supabase configuration setting `app.audit_signing_key`
- **Usage**: Signs audit events and partition manifests for tamper detection
- **Rotation Frequency**: Quarterly or after security incidents

## Prerequisites

- Administrative access to Supabase project
- Access to backup systems for key recovery
- Understanding of cryptographic key management
- Testing environment for validation

## Key Rotation Procedure

### Phase 1: Preparation (1-2 weeks before)

1. **Generate New Key**

   ```bash
   # Generate a cryptographically secure random key
   openssl rand -hex 32  # Produces 64-character hex string
   # Example output: a1b2c3d4e5f6789abcdef0123456789abcdef0123456789abcdef0123456789abc
   ```

2. **Store New Key Securely**
   - Store in secure key management system (AWS KMS, HashiCorp Vault, etc.)
   - Create backup copies in multiple secure locations
   - Document key generation date and responsible party

3. **Update Key Versioning**
   - Update `app.audit_signing_key_v2` setting in Supabase
   - Keep old key as `app.audit_signing_key_v1` during transition

### Phase 2: Transition Period (Maintenance Window)

1. **Schedule Maintenance Window**
   - Notify stakeholders of 4-hour maintenance window
   - Prepare rollback plan
   - Ensure monitoring systems are active

2. **Update Application Configuration**

   ```sql
   -- Add signing_key_version column to audit_events table
   ALTER TABLE public.audit_events
   ADD COLUMN IF NOT EXISTS signing_key_version TEXT NOT NULL DEFAULT 'v1.0';

   -- Update existing records to use v1.0 as baseline
   UPDATE public.audit_events
   SET signing_key_version = 'v1.0'
   WHERE signing_key_version IS NULL OR signing_key_version = '';

   -- Set new key as primary
   ALTER DATABASE postgres SET app.audit_signing_key = 'new-key-hex-string';

   -- Keep old key for verification during transition
   ALTER DATABASE postgres SET app.audit_signing_key_v1 = 'old-key-hex-string';
   ```

3. **Update Signing Function**

   ```sql
   -- Modify generate_audit_signature function to support dual keys during transition
   -- Returns both signature and key version used
   CREATE OR REPLACE FUNCTION generate_audit_signature(
     p_event_type TEXT,
     p_actor_id UUID,
     p_target_type TEXT,
     p_target_id UUID,
     p_action TEXT,
     p_metadata JSONB,
     p_timestamp TIMESTAMPTZ
   )
   RETURNS TABLE(signature TEXT, key_version TEXT) AS $$
   DECLARE
     primary_key TEXT;
     fallback_key TEXT;
     payload TEXT;
     used_key_version TEXT;
     computed_signature TEXT;
   BEGIN
     -- Get primary key (new)
     primary_key := current_setting('app.audit_signing_key', true);

     -- Construct payload
     payload := p_event_type || '|' || p_actor_id || '|' || p_target_type || '|' ||
                p_target_id || '|' || p_action || '|' || p_metadata::TEXT || '|' ||
                p_timestamp::TEXT;

     -- Try primary key first (current active key version)
     IF primary_key IS NOT NULL AND primary_key != '' THEN
       computed_signature := encode(hmac(payload::bytea, primary_key::bytea, 'sha256'), 'hex');
       used_key_version := current_setting('app.audit_signing_key_version', true);
       IF used_key_version IS NULL OR used_key_version = '' THEN
         used_key_version := 'v2.0'; -- Default for new primary key
       END IF;
       RETURN QUERY SELECT computed_signature, used_key_version;
       RETURN;
     END IF;

     -- Fallback to old key during transition
     fallback_key := current_setting('app.audit_signing_key_v1', true);
     IF fallback_key IS NOT NULL AND fallback_key != '' THEN
       computed_signature := encode(hmac(payload::bytea, fallback_key::bytea, 'sha256'), 'hex');
       used_key_version := current_setting('app.audit_signing_key_v1_version', true);
       IF used_key_version IS NULL OR used_key_version = '' THEN
         used_key_version := 'v1.0'; -- Default for fallback key
       END IF;
       RETURN QUERY SELECT computed_signature, used_key_version;
       RETURN;
     END IF;

     -- Emergency fallback (should not happen in production)
     RAISE EXCEPTION 'No audit signing key configured';
   END;
   $$ LANGUAGE plpgsql SECURITY DEFINER;
   ```

4. **Update Audit Trigger**

   ```sql
   -- Update the set_audit_signature trigger to record key version
   CREATE OR REPLACE FUNCTION set_audit_signature()
   RETURNS TRIGGER AS $$
   DECLARE
     sig_result RECORD;
   BEGIN
     -- Generate signature and get key version if not provided
     IF NEW.signature IS NULL OR NEW.signature = '' THEN
       SELECT * INTO sig_result FROM generate_audit_signature(
         NEW.event_type,
         NEW.actor_id,
         NEW.target_id,
         NEW.action,
         NEW.metadata,
         NEW.timestamp
       );
       NEW.signature := sig_result.signature;
       NEW.signing_key_version := sig_result.key_version;
     END IF;

     RETURN NEW;
   END;
   $$ LANGUAGE plpgsql SECURITY DEFINER;
   ```

5. **Update Partition Checksum Function**

   ```sql
   -- Similarly update generate_partition_checksum function
   CREATE OR REPLACE FUNCTION generate_partition_checksum(TEXT)
   RETURNS TABLE(record_count BIGINT, checksum TEXT) AS $$
   -- ... existing logic ...
   BEGIN
     -- Use same key selection logic as above
     v_signing_key := current_setting('app.audit_signing_key', true);
     IF v_signing_key IS NULL OR v_signing_key = '' THEN
       v_signing_key := current_setting('app.audit_signing_key_v1', true);
     END IF;
     -- ... rest of function ...
   END;
   $$ LANGUAGE plpgsql;
   ```

6. **Implement Signature Verification Function**

   ```sql
   -- Function to verify audit event signature with key versioning support
   CREATE OR REPLACE FUNCTION verify_audit_signature(
     p_event_id UUID
   )
   RETURNS TABLE(
     is_valid BOOLEAN,
     key_version TEXT,
     verification_method TEXT,
     verified_at TIMESTAMPTZ
   ) AS $$
   DECLARE
     v_event RECORD;
     v_key_record RECORD;
     v_expected_signature TEXT;
     v_verification_result BOOLEAN := FALSE;
     v_used_key_version TEXT;
     v_signing_key TEXT;
     v_payload TEXT;
   BEGIN
     -- Retrieve event with stored key version
     SELECT * INTO v_event
     FROM public.audit_events
     WHERE id = p_event_id;

     IF NOT FOUND THEN
       RETURN QUERY SELECT FALSE, NULL::TEXT, 'event_not_found'::TEXT, NOW();
       RETURN;
     END IF;

     -- Get the signing key for this event's key version from audit_signing_keys table
     SELECT public_key_hash INTO v_signing_key
     FROM public.audit_signing_keys
     WHERE version = v_event.signing_key_version
       AND activated_at IS NOT NULL
       AND (deactivated_at IS NULL OR deactivated_at > v_event.timestamp); -- Allow verification during overlap

     IF NOT FOUND THEN
       -- Fallback to current settings for backward compatibility during transition
       IF v_event.signing_key_version = 'v2.0' THEN
         v_signing_key := current_setting('app.audit_signing_key', true);
       ELSIF v_event.signing_key_version = 'v1.0' THEN
         v_signing_key := COALESCE(
           current_setting('app.audit_signing_key_v1', true),
           current_setting('app.audit_signing_key', true) -- Fallback if old key not set
         );
       END IF;
     END IF;

     -- Check if we have a key for verification
     IF v_signing_key IS NULL OR v_signing_key = '' THEN
       RETURN QUERY SELECT FALSE, v_event.signing_key_version, 'key_unavailable'::TEXT, NOW();
       RETURN;
     END IF;

     -- Construct payload (must match generate_audit_signature exactly)
     v_payload := v_event.event_type || '|' || v_event.actor_id::TEXT || '|' ||
                  v_event.target_type || '|' || v_event.target_id || '|' ||
                  v_event.action || '|' || v_event.metadata::TEXT || '|' ||
                  v_event.timestamp::TEXT;

     -- Compute expected signature
     v_expected_signature := encode(hmac(v_payload::bytea, v_signing_key::bytea, 'sha256'), 'hex');

     -- Verify signature matches
     v_verification_result := (v_event.signature = v_expected_signature);

     -- Return verification results
     RETURN QUERY SELECT
       v_verification_result,
       v_event.signing_key_version,
       CASE
         WHEN v_verification_result THEN 'signature_valid'
         ELSE 'signature_invalid'
       END::TEXT,
       NOW();
   END;
   $$ LANGUAGE plpgsql SECURITY DEFINER;
   ```

### Phase 3: Validation and Cleanup

1. **Test Signature Verification**

   ```sql
   -- Test that new signatures can be verified
   SELECT
     event_id,
     event_type,
     generate_audit_signature(event_type, actor_id, target_type, target_id, action, metadata, timestamp) as new_signature
   FROM audit_events
   WHERE created_at >= NOW() - INTERVAL '1 hour'
   LIMIT 5;
   ```

2. **Verify Partition Integrity**

   ```sql
   -- Check that partition manifests can still be verified
   SELECT
     table_name,
     partition_name,
     verification_status,
     last_verified_at
   FROM partition_manifests
   WHERE verification_status != 'valid'
    OR last_verified_at < NOW() - INTERVAL '24 hours';
   ```

3. **Verify Historical Signatures**

   ```sql
   -- Verify that signatures created with old keys remain verifiable after rotation
   -- This test checks events created before the rotation cutoff (>24 hours ago)
   -- Any FALSE results indicate signature verification failures that need investigation

   SELECT
     event_id,
     signature as stored_signature,
     generate_audit_signature(event_type, actor_id, target_id, action, metadata, timestamp) as regenerated_signature,
     (signature = generate_audit_signature(event_type, actor_id, target_id, action, metadata, timestamp)) as signature_valid
   FROM audit_events
   WHERE created_at < NOW() - INTERVAL '24 hours'
     AND signature IS NOT NULL
     AND signature != ''
   ORDER BY created_at DESC
   LIMIT 100;

   -- Note: If any rows show signature_valid = FALSE, investigate immediately:
   -- - Check if the event was created during the rotation window
   -- - Re-sign the event with current key material if needed
   -- - Rollback rotation if widespread failures are detected (>10% of sampled events)
   -- - Escalate to security team for root cause analysis
   ```

4. **Run Compliance Audit**
   - Execute signature verification procedures
   - Check partition integrity
   - Validate audit trail continuity

### Phase 4: Cleanup and Key Archiving (After 30 days)

**Rationale for 30-day Grace Period:**

- Aligns with audit event retention policy (default 5 years) allowing sufficient time for async verification jobs to complete
- Accounts for replication lag and pending transaction backlog in distributed systems
- Provides buffer for incident response if signature verification issues are discovered post-rotation

1. **Pre-Cleanup Validation Safeguards**

   **Critical:** Before removing any keys, verify all application instances have restarted with the new key and all historical signatures remain verifiable.

   ```sql
   -- Verify no unverified events exist before key removal
   SELECT
     COUNT(*) as total_events_last_30_days,
     COUNT(*) FILTER (WHERE signature IS NULL OR signature = '') as unsigned_events,
     COUNT(*) FILTER (WHERE NOT (verify_audit_signature(id)).is_valid) as invalid_signatures
   FROM audit_events
   WHERE created_at >= NOW() - INTERVAL '30 days';

   -- Block cleanup if any issues found (expect 0 for all counts)
   -- This query should return no rows before proceeding
   SELECT 'BLOCKED: Unverified events exist' as status
   WHERE EXISTS (
     SELECT 1 FROM audit_events
     WHERE created_at >= NOW() - INTERVAL '30 days'
       AND (signature IS NULL OR signature = '' OR NOT (verify_audit_signature(id)).is_valid)
   );
   ```

   **Application Deployment Verification:**
   - Confirm all application instances have restarted with new key configuration
   - Verify via deployment logs, health checks, or application metrics
   - Test signature generation with new key on all instances:

   ```sql
   -- Test query to verify new key is active across all instances
   SELECT
     current_setting('app.audit_signing_key_version') as active_version,
     encode(sha256(current_setting('app.audit_signing_key')::bytea), 'hex') as key_hash,
     NOW() as verification_timestamp;
   ```

2. **Archive Old Signing Key**

   **Key Archiving Strategy:**
   - **Option A (Recommended for High Security):** Archive old keys securely with access controls, maintaining verification capability for historical audit events. This ensures that signatures created with previous keys remain verifiable indefinitely.
   - **Option B (Simplified):** Re-sign all historical events with the new key material, then permanently delete old keys. This simplifies key management but requires re-signing all historical data.

   **For Option A - Secure Key Archiving:**

   ```sql
   -- Update audit_signing_keys table to mark key as archived
   UPDATE public.audit_signing_keys
   SET
     deactivated_at = NOW(),
     is_active = FALSE,
     metadata = metadata || jsonb_build_object(
       'archived_at', NOW(),
       'archive_reason', 'key_rotation_completed',
       'retention_period_years', 7,
       'access_level', 'restricted_audit_admin'
     )
   WHERE version = 'v1.0' AND deactivated_at IS NULL;

   -- Move key material to secure archive (external key management system)
   -- Implementation depends on your KMS/HSM solution
   -- Example: Store in HashiCorp Vault with path: audit/keys/archived/v1.0/YYYY-MM-DD
   ```

   **Retention Requirements:**
   - **Minimum Retention:** 7 years (aligns with audit_events retention per GDPR and DSA requirements)
   - **Access Controls:** Restricted to audit administrators only, with multi-factor authentication and audit logging
   - **Storage:** Encrypted HSM/KMS with integrity verification and audit logging
   - **Backup:** Multiple geographically distributed copies with independent access controls

   **For Option B - Re-signing Historical Events:**

   ```sql
   -- Re-sign all historical events with new key (expensive operation)
   UPDATE public.audit_events
   SET
     signature = (SELECT signature FROM generate_audit_signature(
       event_type, actor_id, target_type, target_id, action, metadata, timestamp
     )),
     signing_key_version = (SELECT key_version FROM generate_audit_signature(
       event_type, actor_id, target_type, target_id, action, metadata, timestamp
     )),
     updated_at = NOW()
   WHERE signing_key_version = 'v1.0'
     AND created_at < NOW() - INTERVAL '30 days';

   -- Then safely delete old key
   DELETE FROM public.audit_signing_keys WHERE version = 'v1.0';
   ```

3. **Remove Active Key Configuration**

   ```sql
   -- Remove old key from active configuration (keep archived copy for Option A)
   ALTER DATABASE postgres RESET app.audit_signing_key_v1;
   ALTER DATABASE postgres RESET app.audit_signing_key_v1_version;

   -- Verify old key is no longer active
   SELECT name, setting FROM pg_settings
   WHERE name LIKE 'app.audit_signing_key%'
   ORDER BY name;
   ```

4. **Re-verify Historical Signatures**

   ```sql
   -- Comprehensive verification of all signatures before cleanup
   SELECT
     signing_key_version,
     COUNT(*) as total_events,
     COUNT(*) FILTER (WHERE (verify_audit_signature(id)).is_valid) as valid_signatures,
     COUNT(*) FILTER (WHERE NOT (verify_audit_signature(id)).is_valid) as invalid_signatures
   FROM audit_events
   WHERE created_at < NOW() - INTERVAL '30 days'  -- Events before rotation
   GROUP BY signing_key_version
   ORDER BY signing_key_version;

   -- Alert if any signatures fail verification
   SELECT ae.id, ae.event_type, ae.created_at, v.verification_method
   FROM audit_events ae
   CROSS JOIN LATERAL verify_audit_signature(ae.id) v
   WHERE ae.created_at < NOW() - INTERVAL '30 days'
     AND NOT v.is_valid;
   ```

5. **Rollback Path if Verification Fails**

   If signature verification fails after rotation (>1% failure rate or critical events affected):

   ```sql
   -- Immediate rollback: Reactivate old key
   ALTER DATABASE postgres SET app.audit_signing_key = 'old-key-hex-string';
   ALTER DATABASE postgres SET app.audit_signing_key_version = 'v1.0';

   -- Mark new key as failed
   UPDATE public.audit_signing_keys
   SET
     deactivated_at = NOW(),
     metadata = metadata || jsonb_build_object(
       'rollback_at', NOW(),
       'rollback_reason', 'verification_failure'
     )
   WHERE version = 'v2.0' AND is_active = TRUE;

   -- Verify rollback success
   SELECT
     COUNT(*) as recent_events,
     COUNT(*) FILTER (WHERE (verify_audit_signature(id)).is_valid) as verifiable
   FROM audit_events
   WHERE created_at >= NOW() - INTERVAL '1 hour';
   ```

6. **Update Documentation**
   - Update key rotation date and archived key references in this document
   - Document archived key locations and access procedures
   - Update key expiry notifications and monitoring alerts

7. **Schedule Next Rotation**
   - Set calendar reminder for next quarterly rotation (3 months from now)
   - Update monitoring alerts for new active key expiry
   - Review and update key rotation runbook based on lessons learned

## Monitoring and Alerts

### Automated Monitoring

- Daily signature verification health checks
- Partition integrity validation
- Alert on signature verification failures

### Manual Verification

```sql
-- Daily verification query with key versioning
SELECT
  COUNT(*) as total_events,
  COUNT(*) FILTER (WHERE signature IS NOT NULL) as signed_events,
  COUNT(*) FILTER (WHERE (verify_audit_signature(id)).is_valid) as valid_signatures,
  COUNT(*) FILTER (WHERE NOT (verify_audit_signature(id)).is_valid) as invalid_signatures,
  array_agg(DISTINCT (verify_audit_signature(id)).key_version) FILTER (WHERE (verify_audit_signature(id)).key_version IS NOT NULL) as key_versions_used
FROM audit_events
WHERE created_at >= CURRENT_DATE - INTERVAL '1 day';

-- Detailed verification for troubleshooting
SELECT
  ae.id,
  ae.event_type,
  ae.created_at,
  v.is_valid,
  v.key_version,
  v.verification_method
FROM audit_events ae
CROSS JOIN LATERAL verify_audit_signature(ae.id) v
WHERE ae.created_at >= CURRENT_DATE - INTERVAL '1 day'
  AND NOT v.is_valid
ORDER BY ae.created_at DESC
LIMIT 10;
```

## Emergency Procedures

### Key Compromise Response

1. **Immediate**: Generate emergency key and rotate immediately
2. **Investigation**: Log security incident and investigate compromise
3. **Notification**: Notify affected parties per incident response plan
4. **Recovery**: Restore from secure backups if needed

### Key Loss Recovery

1. **Assess Impact**: Determine which signatures are affected
2. **Recovery**: Use backup keys from secure storage
3. **Validation**: Verify all signatures after recovery
4. **Documentation**: Document incident and recovery steps

### Key Rotation Rollback Procedures

#### When to Rollback

- Signature verification fails for >1% of events after rotation
- Critical system components cannot verify audit signatures
- New key shows signs of compromise during validation phase
- Business continuity requires immediate rollback

#### Rollback Steps

1. **Immediate Suspension of New Key**

   ```sql
   -- Suspend new key usage immediately
   ALTER DATABASE postgres SET app.audit_signing_key_v2 = 'new-key-hex-string-suspended';
   ALTER DATABASE postgres RESET app.audit_signing_key;

   -- Reactivate old key as primary
   ALTER DATABASE postgres SET app.audit_signing_key = 'old-key-hex-string';
   ALTER DATABASE postgres SET app.audit_signing_key_version = 'v1.0';
   ```

2. **Verification of Rollback**

   ```sql
   -- Test that signatures can be verified with rolled-back key
   SELECT
     COUNT(*) as total_recent_events,
     COUNT(*) FILTER (WHERE (verify_audit_signature(id)).is_valid) as verifiable_events
   FROM audit_events
   WHERE created_at >= NOW() - INTERVAL '1 hour';

   -- Should show 100% verifiable events
   ```

3. **Clean Up Failed Rotation**

   ```sql
   -- Mark new key as failed in audit_signing_keys table
   UPDATE public.audit_signing_keys
   SET
     deactivated_at = NOW(),
     metadata = metadata || jsonb_build_object(
       'rotation_status', 'failed_rollback',
       'rollback_at', NOW(),
       'failure_reason', 'verification_failure'
     )
   WHERE version = 'v2.0' AND deactivated_at IS NULL;

   -- Remove suspended key settings
   ALTER DATABASE postgres RESET app.audit_signing_key_v2;
   ```

4. **Incident Documentation**
   - Document rollback reason and timeline
   - Update key rotation history table
   - Schedule follow-up rotation attempt (minimum 30 days delay)
   - Review and update rotation procedures based on failure analysis

#### Access Controls for Key Operations

**Production Key Management:**

- **Key Generation:** Restricted to Security Team leads only
- **Key Activation:** Requires dual authorization (Security + DevOps)
- **Key Archival:** Restricted to Audit Administrators
- **Key Deletion:** Never permitted - keys are archived indefinitely

**Access Control Implementation:**

```sql
-- Example: Create role for key management operations
CREATE ROLE audit_key_admin;
GRANT SELECT, UPDATE ON public.audit_signing_keys TO audit_key_admin;
-- Additional grants for key settings management

-- Audit all key operations
CREATE POLICY audit_key_changes ON public.audit_signing_keys
FOR ALL USING (auth.jwt() ->> 'role' = 'audit_key_admin');
```

#### Key Retention Requirements

**Active Keys:**

- **Retention:** Indefinite (never delete)
- **Storage:** HSM/KMS with audit logging
- **Access:** Security team only
- **Backup:** Real-time replication to geographically distributed HSMs

**Archived Keys:**

- **Retention Period:** 7 years minimum (aligns with audit_events retention)
- **Storage:** Encrypted archive with integrity verification
- **Access:** Audit administrators only, logged and monitored
- **Backup:** Multiple encrypted copies in separate security zones

**Key Verification:**

- **Daily:** Automated verification that archived keys can still verify signatures
- **Monthly:** Full audit trail verification using archived keys
- **Quarterly:** Key integrity and storage medium verification
- **Annual:** Complete key lifecycle audit and compliance review

## Security Considerations

- Keys must be generated using cryptographically secure random generators
- Never log or expose keys in application logs
- Store keys in dedicated key management systems
- Implement principle of least privilege for key access
- Regular security audits of key management procedures

## Compliance Requirements

This key rotation procedure implements specific controls to satisfy the following compliance requirements. Each requirement includes the specific controls implemented and evidence from the procedure steps.

- **DSA Art. 24(6)**: Audit trail integrity and tamper detection
  - _Requirement_: Platforms must implement measures to safeguard the integrity of information, including audit trails, and prevent tampering with audit logs and records.
  - _How satisfied_: Implements HMAC-SHA256 cryptographic signatures with key versioning to detect any tampering attempts. Dual-key transition period ensures no audit gaps during rotation. Verification functions validate signature integrity continuously.
  - _Evidence_: Steps 3.2-3.6 (signature generation with versioning), Step 6 (verification function), Phase 3.1-3.3 (validation queries), Monitoring section (daily verification queries), Emergency procedures (compromise detection).

- **GDPR Art. 5(1)(f)**: Integrity and confidentiality of processing
  - _Requirement_: Personal data must be processed in a manner that ensures appropriate security, including integrity and confidentiality through appropriate technical and organizational measures.
  - _How satisfied_: Keys are cryptographically secure (32-byte hex), stored in secure key management systems, and protected with access controls. Key material is never exposed in logs, with principle of least privilege enforced.
  - _Evidence_: Step 1.1 (secure key generation), Step 1.2 (secure storage requirements), Phase 4.1 (application deployment verification), Access Controls section (role-based access), Security Considerations (cryptographic requirements).

- **ISO 27001**: Cryptographic key management controls
  - _Requirement_: A.12.3.1 - Information security policy on the use of cryptographic controls; A.12.3.2 - Key management policy covering generation, distribution, storage, use, and destruction.
  - _How satisfied_: Implements complete key lifecycle management including generation, versioning, transition, archival, and retention. Keys are never deleted (archival approach), with 7-year minimum retention matching audit data retention. Automated monitoring and manual verification procedures ensure ongoing compliance.
  - _Evidence_: Phase 1 (key generation and storage), Phase 4.2-4.4 (archival procedures), Key Retention Requirements (7-year retention), Monitoring section (automated verification), Emergency Procedures (key compromise response).

## Version History

| 2025-01-01 | v1 | key-2025-01 | System | Initial key |
| 2025-10-21 | v1.1 | N/A | System | Added key versioning and verification strategy |
| YYYY-MM-DD | v2 | key-YYYY-MM | [Name] | [Notes] |
