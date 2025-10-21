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
   -- Set new key as primary
   ALTER DATABASE postgres SET app.audit_signing_key = 'new-key-hex-string';

   -- Keep old key for verification during transition
   ALTER DATABASE postgres SET app.audit_signing_key_v1 = 'old-key-hex-string';
   ```

3. **Update Signing Function**

   ```sql
   -- Modify generate_audit_signature function to support dual keys during transition
   CREATE OR REPLACE FUNCTION generate_audit_signature(
     p_event_type TEXT,
     p_actor_id UUID,
     p_target_type TEXT,
     p_target_id UUID,
     p_action TEXT,
     p_metadata JSONB,
     p_timestamp TIMESTAMPTZ
   )
   RETURNS TEXT AS $$
   DECLARE
     primary_key TEXT;
     fallback_key TEXT;
     payload TEXT;
   BEGIN
     -- Get primary key (new)
     primary_key := current_setting('app.audit_signing_key', true);

     -- Construct payload
     payload := p_event_type || '|' || p_actor_id || '|' || p_target_type || '|' ||
                p_target_id || '|' || p_action || '|' || p_metadata::TEXT || '|' ||
                p_timestamp::TEXT;

     -- Try primary key first
     IF primary_key IS NOT NULL AND primary_key != '' THEN
       RETURN encode(hmac(payload::bytea, primary_key::bytea, 'sha256'), 'hex');
     END IF;

     -- Fallback to old key during transition
     fallback_key := current_setting('app.audit_signing_key_v1', true);
     IF fallback_key IS NOT NULL AND fallback_key != '' THEN
       RETURN encode(hmac(payload::bytea, fallback_key::bytea, 'sha256'), 'hex');
     END IF;

     -- Emergency fallback (should not happen in production)
     RAISE EXCEPTION 'No audit signing key configured';
   END;
   $$ LANGUAGE plpgsql SECURITY DEFINER;
   ```

4. **Update Partition Checksum Function**
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

3. **Run Compliance Audit**
   - Execute signature verification procedures
   - Check partition integrity
   - Validate audit trail continuity

### Phase 4: Cleanup (After 30 days)

1. **Remove Old Key**

   ```sql
   -- Remove old key from configuration
   ALTER DATABASE postgres RESET app.audit_signing_key_v1;
   ```

2. **Update Documentation**
   - Update key rotation date in this document
   - Store old key in long-term archive
   - Update key expiry notifications

3. **Schedule Next Rotation**
   - Set calendar reminder for next quarterly rotation
   - Update monitoring alerts if key is approaching expiry

## Monitoring and Alerts

### Automated Monitoring

- Daily signature verification health checks
- Partition integrity validation
- Alert on signature verification failures

### Manual Verification

```sql
-- Daily verification query
SELECT
  COUNT(*) as total_events,
  COUNT(*) FILTER (WHERE signature IS NOT NULL) as signed_events,
  COUNT(*) FILTER (WHERE verify_audit_signature(id)) as valid_signatures
FROM audit_events
WHERE created_at >= CURRENT_DATE - INTERVAL '1 day';
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

## Security Considerations

- Keys must be generated using cryptographically secure random generators
- Never log or expose keys in application logs
- Store keys in dedicated key management systems
- Implement principle of least privilege for key access
- Regular security audits of key management procedures

## Compliance Requirements

- **DSA Art. 24(6)**: Audit trail integrity and tamper detection
- **GDPR Art. 5(1)(f)**: Integrity and confidentiality of processing
- **ISO 27001**: Cryptographic key management controls

## Version History

| Date       | Version | Key ID      | Rotated By | Notes       |
| ---------- | ------- | ----------- | ---------- | ----------- |
| 2025-01-01 | v1      | key-2025-01 | System     | Initial key |
| YYYY-MM-DD | v2      | key-YYYY-MM | [Name]     | [Notes]     |
