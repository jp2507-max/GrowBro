# Authentication Edge Functions

This directory contains Supabase Edge Functions for authentication and session management.

## Functions

### 1. `send-lockout-notification`

Sends email notifications when an account is locked due to too many failed login attempts.

**Requirements**: 8.5, 8.7

**Request Body**:

```json
{
  "email": "user@example.com",
  "lockedUntil": "2025-10-29T12:30:00Z",
  "ipAddress": "192.168.1.0",
  "userAgent": "Mozilla/5.0...",
  "failedAttempts": 5
}
```

**Environment Variables**:

- `RESEND_API_KEY`: API key for Resend email service (optional - will log if missing)
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key for database access

**Features**:

- Sends localized emails (EN/DE) with lockout details
- Includes timestamp, IP address, and failed attempts count
- Logs lockout event to `auth_audit_log` table
- Graceful degradation if email service is unavailable

**Example Usage**:

```bash
curl -X POST https://your-project.supabase.co/functions/v1/send-lockout-notification \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "lockedUntil": "2025-10-29T12:30:00Z",
    "ipAddress": "192.168.1.0",
    "userAgent": "Mozilla/5.0...",
    "failedAttempts": 5
  }'
```

---

### 2. `revoke-session`

Revokes a specific user session by marking it as revoked in the database.

**Requirements**: 6.3, 6.5

**Request Body**:

```json
{
  "sessionKey": "abc123..."
}
```

**Headers**:

- `Authorization: Bearer <user_access_token>`: User's access token (required)

**Features**:

- Validates user authentication before revoking
- Updates `revoked_at` timestamp in `user_sessions` table
- Logs session revocation to `auth_audit_log`
- Prevents users from revoking other users' sessions

**Example Usage**:

```bash
curl -X POST https://your-project.supabase.co/functions/v1/revoke-session \
  -H "Authorization: Bearer USER_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionKey": "abc123..."
  }'
```

---

### 3. `revoke-all-sessions-except`

Revokes all user sessions except the current one.

**Requirements**: 6.4, 6.5

**Request Body**:

```json
{
  "currentSessionKey": "xyz789..."
}
```

**Headers**:

- `Authorization: Bearer <user_access_token>`: User's access token (required)

**Features**:

- Revokes all sessions except the specified current session
- Updates `revoked_at` timestamp for all revoked sessions
- Logs bulk revocation to `auth_audit_log` with affected device details
- Returns count of revoked sessions

**Example Usage**:

```bash
curl -X POST https://your-project.supabase.co/functions/v1/revoke-all-sessions-except \
  -H "Authorization: Bearer USER_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "currentSessionKey": "xyz789..."
  }'
```

---

## Security Considerations

### Session Revocation Flow

1. When a session is revoked, its `revoked_at` timestamp is set in the `user_sessions` table
2. The mobile app checks `revoked_at` on startup via the session key (SHA-256 hash of refresh token)
3. If the current session is revoked, the app forces sign out and clears local data
4. This approach works because:
   - Session keys are derived from refresh tokens (stable identifiers)
   - Apps check revocation status before allowing access
   - Natural token expiry provides additional security layer

### IP Address Privacy

- IP addresses are truncated before storage (last octet masked for IPv4, last 64 bits for IPv6)
- Example: `192.168.1.100` becomes `192.168.1.0`
- Email hashes (SHA-256) are used in audit logs instead of plain emails

### Rate Limiting

- Supabase Auth provides built-in rate limiting (60 requests/hour per IP)
- Custom lockout logic adds account-level protection (5 failed attempts in 15 minutes)
- Lockout period: 15 minutes (configurable via `auth_lockouts` RPC functions)

---

## Testing

Integration tests are available in `__tests__/auth-edge-functions.test.ts`.

**Run tests**:

```bash
cd supabase/functions
deno test --allow-net --allow-env __tests__/auth-edge-functions.test.ts
```

**Test Coverage**:

- Device metadata capture on sign in (Requirement 6.1)
- Lockout enforcement after 5 failed attempts (Requirement 8.1)
- Lockout notification email delivery (Requirement 8.5)
- Session revocation (Requirements 6.3, 6.5)
- Bulk session revocation (Requirements 6.4, 6.5)

---

## Setup

### 1. Environment Variables

Create a `.env` file in your Supabase project with:

```env
RESEND_API_KEY=re_xxx  # Optional: for email notifications
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 2. Database Migrations

Ensure the following migrations are applied:

- `20251029_create_auth_lockouts_table.sql`
- `20251029_create_auth_audit_log_table.sql`
- `20251029_create_user_sessions_table.sql`

### 3. Deploy Functions

```bash
# Deploy all functions
supabase functions deploy send-lockout-notification
supabase functions deploy revoke-session
supabase functions deploy revoke-all-sessions-except

# Or deploy all at once
supabase functions deploy
```

---

## Monitoring

### Audit Logs

All authentication events are logged to the `auth_audit_log` table:

```sql
SELECT
  event_type,
  user_id,
  ip_address,
  metadata,
  created_at
FROM auth_audit_log
WHERE event_type IN ('lockout', 'session_revoked')
ORDER BY created_at DESC
LIMIT 100;
```

### Lockout Status

Check current lockout status:

```sql
SELECT
  email,
  failed_attempts,
  locked_until,
  updated_at
FROM auth_lockouts
WHERE locked_until > NOW()
ORDER BY updated_at DESC;
```

### Active Sessions

View active user sessions:

```sql
SELECT
  u.email,
  s.device_name,
  s.os,
  s.app_version,
  s.last_active_at,
  s.revoked_at
FROM user_sessions s
JOIN auth.users u ON u.id = s.user_id
WHERE s.revoked_at IS NULL
ORDER BY s.last_active_at DESC;
```

---

## Troubleshooting

### Email notifications not sending

1. Check `RESEND_API_KEY` is set in environment variables
2. Verify Resend API key is valid and has send permissions
3. Check function logs: `supabase functions logs send-lockout-notification`

### Session revocation not working

1. Verify mobile app checks `revoked_at` on startup
2. Ensure session keys match (SHA-256 hash of refresh token)
3. Check `user_sessions` table has correct session records

### Lockout not triggering

1. Verify `auth_lockouts` table exists and RPC functions are deployed
2. Check `enforce-auth-lockout` Edge Function is being used instead of direct `signInWithPassword`
3. Review audit logs for failed sign-in attempts

---

## Future Enhancements

- [ ] MFA support (TOTP, backup codes)
- [ ] Suspicious activity detection (unusual IP/location)
- [ ] Session analytics dashboard
- [ ] Email templates with custom branding
- [ ] SMS notifications for critical security events
