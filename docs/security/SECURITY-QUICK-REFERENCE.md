# Security Quick Reference Guide

**Last Updated**: 2025-10-31  
**For**: Development Team

---

## Critical Security Implementations (2025-10-31)

### ✅ 1. Server-Side Lockout Enforcement

**What**: Database trigger that blocks authentication attempts when account is locked  
**Why**: Prevents bypass of client-side lockout checks  
**Location**: `supabase/migrations/20251031_add_lockout_trigger.sql`

**Key Points**:

- Triggers on `auth.users` INSERT operations
- Checks `auth_lockout` table before allowing sign-in
- Raises exception if account is locked
- Works alongside Edge Function for defense-in-depth

**Testing**:

```bash
# Attempt to bypass Edge Function (should fail)
curl -X POST "https://<your-project>.supabase.co/auth/v1/signup" \
  -H "apikey: SUPABASE_ANON_KEY" \
  -d '{"email":"locked@example.com","password":"test123"}'
```

---

### ✅ 2. Encryption Key Rotation (90-Day)

**What**: Automated encryption key rotation with versioning  
**Why**: Limits impact of key compromise, meets compliance requirements  
**Location**: `src/lib/auth/key-rotation.ts`

**Key Points**:

- Keys rotate every 90 days automatically
- Background task checks daily for rotation needs
- Notifications sent 7 days before expiry
- Data migrated seamlessly during rotation
- Old keys retained for 30 days for recovery

**Usage**:

```typescript
// Check if rotation is needed
import { checkKeyRotationStatus } from '@/lib/auth/key-rotation';
const status = await checkKeyRotationStatus();

// Perform rotation (usually automatic)
import { rotateEncryptionKey } from '@/lib/auth/key-rotation';
const result = await rotateEncryptionKey();
```

**Monitoring**:

```sql
-- Check current key status
SELECT * FROM public.encryption_keys WHERE status = 'active';

-- View rotation history
SELECT version, status, created_at, expires_at
FROM public.encryption_keys
ORDER BY created_at DESC;
```

---

### ✅ 3. OAuth Provider Configuration

**What**: Complete setup guide for Apple and Google Sign-In  
**Why**: Ensures secure OAuth implementation with proper credentials  
**Location**: `docs/security/oauth-provider-setup.md`

**Key Points**:

- Apple: Requires Services ID, Team ID, Key ID, Private Key
- Google: Requires Web, Android, and iOS Client IDs
- Nonce must be hashed before sending to Apple
- Redirect URIs must match exactly

**Quick Setup**:

1. Follow `docs/security/oauth-provider-setup.md`
2. Configure providers in Apple Developer / Google Cloud Console
3. Add credentials to Supabase Dashboard
4. Update environment variables in app
5. Test on real devices (not simulators)

**Critical Security Check**:

```typescript
// ✅ CORRECT: Hash nonce for Apple
const { rawNonce, hashedNonce } = await createNoncePair();
const credential = await AppleAuthentication.signInAsync({
  nonce: hashedNonce, // Send hashed to Apple
});
signInWithIdToken.mutate({
  nonce: rawNonce, // Send raw to Supabase
});
```

---

## Security Checklist for Production

### Pre-Deployment

- [ ] Database migrations applied (`supabase db push`)
- [ ] Lockout trigger verified (`SELECT * FROM pg_trigger WHERE tgname = 'enforce_lockout_trigger'`)
- [ ] Key rotation initialized (`SELECT * FROM public.encryption_keys`)
- [ ] OAuth providers configured in Supabase Dashboard
- [ ] Environment variables set (Apple/Google credentials)
- [ ] Security tests passed
- [ ] Documentation reviewed

### Post-Deployment

- [ ] Test lockout enforcement with locked account
- [ ] Verify key rotation status query works
- [ ] Test Apple Sign-In on iOS device
- [ ] Test Google Sign-In on Android and iOS
- [ ] Monitor error logs for first 24 hours
- [ ] Set up alerts for security events

---

## Monitoring & Alerts

### Key Metrics

**Lockout Enforcement**:

```sql
-- Daily lockout events
SELECT COUNT(*)
FROM public.auth_audit_log
WHERE event_type = 'lockout_enforcement'
AND created_at > now() - interval '24 hours';
```

**Key Rotation**:

```sql
-- Days until next rotation
SELECT
  version,
  EXTRACT(DAY FROM (expires_at - now())) as days_remaining
FROM public.encryption_keys
WHERE status = 'active';
```

**OAuth Errors**:

```sql
-- OAuth failures in last 24 hours
SELECT COUNT(*)
FROM public.auth_audit_log
WHERE event_type = 'sign_in'
AND (metadata->>'provider') IN ('apple', 'google')
AND (metadata->>'success')::boolean = false
AND created_at > now() - interval '24 hours';
```

### Recommended Alerts

1. **Lockout Bypass Attempts**: Alert if lockout enforcement blocks > 10 attempts/hour
2. **Key Rotation Failure**: Alert if rotation fails or key expires
3. **OAuth Failures**: Alert if OAuth success rate < 95%
4. **Suspicious Activity**: Alert on unusual lockout patterns

---

## Troubleshooting

### Lockout Not Working

**Symptoms**: Users can sign in despite being locked  
**Check**:

1. Verify trigger exists: `SELECT * FROM pg_trigger WHERE tgname = 'enforce_lockout_trigger'`
2. Check lockout table: `SELECT * FROM public.auth_lockout WHERE email_hash = 'hash'`
3. Verify Edge Function is being used (not direct GoTrue calls)

**Fix**:

```sql
-- Re-create trigger if missing
DROP TRIGGER IF EXISTS enforce_lockout_trigger ON auth.users;
CREATE TRIGGER enforce_lockout_trigger
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_lockout_on_auth();
```

### Key Rotation Failed

**Symptoms**: Data inaccessible after rotation  
**Check**:

1. Check key version: `SELECT * FROM public.encryption_keys WHERE status = 'active'`
2. Verify SecureStore has key: Check app logs for key retrieval errors
3. Check migration logs for data migration failures

**Fix**:

```typescript
// Restore previous key version
import { rotateEncryptionKey } from '@/lib/auth/key-rotation';
// Manual rollback may be needed - contact security team
```

### OAuth Not Working

**Symptoms**: OAuth sign-in fails with errors  
**Check**:

1. Verify credentials in Supabase Dashboard
2. Check redirect URIs match exactly
3. Test on real device (not simulator)
4. Review provider-specific logs (Apple Developer, Google Cloud Console)

**Fix**: See `docs/security/oauth-provider-setup.md` troubleshooting section

---

## Emergency Procedures

### Revoke Encryption Key

```sql
-- Emergency key revocation
SELECT public.revoke_encryption_key(
  1, -- version to revoke
  'Security incident - key compromise suspected',
  '{"incident_id": "INC-2025-001"}'::jsonb
);
```

### Disable Lockout Temporarily

```sql
-- Temporarily disable lockout trigger (emergency only)
ALTER TABLE auth.users DISABLE TRIGGER enforce_lockout_trigger;

-- Re-enable after incident
ALTER TABLE auth.users ENABLE TRIGGER enforce_lockout_trigger;
```

### Reset User Lockout

```sql
-- Reset lockout for specific user
UPDATE public.auth_lockout
SET is_locked = false, failed_attempts = 0
WHERE email_hash = 'user_email_hash';
```

---

## Support Contacts

**Security Issues**: security@growbro.app  
**Production Incidents**: oncall@growbro.app  
**Documentation Questions**: dev@growbro.app

---

## Additional Resources

- **Full Security Documentation**: `docs/security/security-implementation-summary.md`
- **OAuth Setup Guide**: `docs/security/oauth-provider-setup.md`
- **Security Audit Report**: `docs/security/auth-security-audit.md`
- **Task 12 Summary**: `docs/testing/task-12-completion-summary.md`

---

**Document Version**: 1.0  
**Next Review**: 2026-01-31
