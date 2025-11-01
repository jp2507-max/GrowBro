# Authentication Migration Guide

This guide helps you migrate from the legacy token-based authentication to the new Supabase Auth session-based system.

## Overview

The authentication system has been upgraded to provide:

- Full Supabase Auth integration with email/password and OAuth (Apple/Google)
- Enhanced session management with offline support
- Device tracking and session revocation
- Brute-force protection and account lockout
- Consent-aware telemetry and privacy controls

## Breaking Changes

### 1. Token Format Changes

**Before (Legacy)**:

```typescript
interface TokenType {
  access: string;
  refresh: string;
}
```

**After (New)**:

```typescript
interface Session {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user_id: string;
}

interface User {
  id: string;
  email: string;
  email_verified: boolean;
  created_at: string;
  last_sign_in_at: string;
  app_metadata: Record<string, any>;
  user_metadata: Record<string, any>;
}
```

### 2. Storage Changes

**Before**: AsyncStorage for session tokens
**After**: MMKV with encryption for session tokens

- **Android**: MMKV with encrypted-at-rest storage
- **iOS**: MMKV with OS-level encryption (Data Protection API)
- **Encryption keys**: Stored in Expo SecureStore (hardware-backed on supported devices)

### 3. Auth State Structure

**Before**:

```typescript
interface AuthState {
  token: TokenType | null;
  status: 'idle' | 'signOut' | 'signIn';
}
```

**After**:

```typescript
interface AuthState {
  token: TokenType | null; // Maintained for backward compatibility
  status: 'idle' | 'signOut' | 'signIn';
  user: User | null; // New
  session: Session | null; // New
  lastValidatedAt: number | null; // New
  offlineMode: 'full' | 'readonly' | 'blocked'; // New
}
```

## Migration Steps

### Step 1: Update Dependencies

No new dependencies are required. The system uses existing packages:

- `@supabase/supabase-js` (already installed)
- `react-native-mmkv` (already installed)
- `expo-secure-store` (already installed)

### Step 2: Environment Variables

Add OAuth provider credentials to your `.env` files (optional, only if using OAuth):

```bash
# .env.production
APPLE_CLIENT_SECRET=your-apple-secret
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-secret
```

Update `.env.example`:

```bash
# OAuth (optional)
APPLE_CLIENT_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

### Step 3: Supabase Configuration

Update `supabase/config.toml`:

```toml
[auth]
site_url = "https://growbro.app"
additional_redirect_urls = [
  "growbro://auth/callback",
  "growbro://verify-email",
  "growbro://reset-password",
  "growbro-dev://auth/callback",
  "growbro-dev://verify-email",
  "growbro-dev://reset-password"
]
enable_signup = true
email_confirm_required = true
password_min_length = 8

[auth.email]
enable_signup = true
double_confirm_changes_enabled = true
enable_confirmations = true

[auth.external.apple]
enabled = true
client_id = "com.growbro.app"
secret = "env(APPLE_CLIENT_SECRET)"

[auth.external.google]
enabled = true
client_id = "env(GOOGLE_CLIENT_ID)"
secret = "env(GOOGLE_CLIENT_SECRET)"
```

### Step 4: App Configuration

Update `app.config.cjs` to add deep link schemes:

```javascript
// Add custom scheme
scheme: process.env.APP_ENV === 'production' ? 'growbro' : 'growbro-dev',

// iOS: Enable Apple Sign In
ios: {
  ...existingIosConfig,
  usesAppleSignIn: true,
},
```

### Step 5: Database Migrations

Apply the new database migrations using Supabase MCP tools:

```bash
# The following migrations have been created:
# - user_sessions table (device tracking)
# - auth_lockouts table (brute-force protection)
# - auth_audit_log table (security audit trail)
```

These migrations are already in `supabase/migrations/` and will be applied automatically.

### Step 6: Code Migration (Automatic)

The new auth system maintains **backward compatibility**:

- Existing `TokenType` structure is preserved
- Existing `signIn`/`signOut` functions are extended, not replaced
- Existing auth state hydration logic is preserved
- Old tokens are automatically migrated to new session format on first app start

**No code changes required in your app!**

## Backward Compatibility

### TokenType Compatibility Layer

The legacy `TokenType` interface is maintained as a thin adapter:

```typescript
// Legacy code continues to work
const token = useAuth.getState().token;
if (token) {
  console.log(token.access); // Still works
}

// New code can use session
const session = useAuth.getState().session;
if (session) {
  console.log(session.access_token); // New way
}
```

### Automatic Token Migration

On app start, the system automatically:

1. Checks for legacy tokens in AsyncStorage
2. Migrates them to MMKV with encryption
3. Establishes a new Supabase session
4. Cleans up old AsyncStorage keys

**Migration is transparent to users** - they remain signed in.

## Offline Session Handling

The new system introduces offline session policies:

- **0-7 days**: Full read/write access (offline mode)
- **7-30 days**: Read-only mode (mutations queued for sync)
- **30+ days**: Forced re-authentication required

Users will see banners when in read-only or blocked mode:

- "Offline - changes will sync later" (read-only)
- "Session expired - please reconnect to continue" (blocked)

## New Features Available

### 1. OAuth Sign In

Users can now sign in with:

- Apple (iOS and Android)
- Google (iOS and Android)

OAuth accounts are automatically linked if the email matches an existing verified account.

### 2. Password Reset

Users can reset their password via email:

1. Tap "Forgot Password" on login screen
2. Enter email address
3. Receive reset link via email
4. Click link to open app and set new password

### 3. Email Verification

New accounts require email verification:

1. Sign up with email/password
2. Receive verification email
3. Click link to verify
4. Banner dismisses after verification

### 4. Device & Session Management

Users can view and manage active sessions:

- Navigate to Settings → Security → Active Sessions
- View all devices signed into account
- Revoke individual sessions
- Revoke all other sessions (sign out everywhere else)

### 5. Brute-Force Protection

Accounts are protected from brute-force attacks:

- 5 failed login attempts within 15 minutes triggers lockout
- Account locked for 15 minutes
- Email notification sent on lockout
- Generic error message shown (no account enumeration)

## Rollback Instructions

If you need to rollback to the legacy auth system:

### 1. Revert Code Changes

```bash
git revert <commit-hash-of-auth-upgrade>
```

### 2. Restore AsyncStorage Tokens

The legacy tokens are preserved in AsyncStorage with key `auth-legacy-backup` for 30 days after migration.

```typescript
// Emergency rollback script (run once)
import AsyncStorage from '@react-native-async-storage/async-storage';

async function rollbackAuth() {
  const backup = await AsyncStorage.getItem('auth-legacy-backup');
  if (backup) {
    await AsyncStorage.setItem('auth-token', backup);
    await AsyncStorage.removeItem('auth-legacy-backup');
    console.log('Auth rolled back to legacy tokens');
  }
}
```

### 3. Revert Database Migrations

Use Supabase MCP tools to revert migrations:

```bash
# Revert in reverse order
# - Drop auth_audit_log table
# - Drop auth_lockouts table
# - Drop user_sessions table
```

**Note**: Reverting migrations will lose session tracking and audit log data.

## Troubleshooting

### Issue: Users Signed Out After Update

**Cause**: Token migration failed or MMKV initialization error

**Solution**:

1. Check device logs for MMKV errors
2. Verify SecureStore is available (may fail on emulators without hardware encryption)
3. Fallback to ephemeral encryption key is automatic but less secure

### Issue: OAuth Sign In Not Working

**Cause**: Redirect URIs not configured correctly

**Solution**:

1. Verify `app.config.cjs` has correct scheme
2. Check Supabase `config.toml` has all redirect URLs
3. Verify OAuth provider console has matching redirect URIs
4. See [OAuth Setup Guide](./oauth-setup.md) for detailed instructions

### Issue: Deep Links Not Opening App

**Cause**: Custom URL scheme not registered

**Solution**:

1. Rebuild app with `npx expo prebuild --clean`
2. Verify scheme in `app.config.cjs` matches deep link URLs
3. Test with `npx uri-scheme open growbro://verify-email --ios` (or `--android`)

### Issue: Session Expires Too Quickly

**Cause**: Token refresh failing or network issues

**Solution**:

1. Check network connectivity
2. Verify Supabase project is not paused
3. Check for rate limiting (60 req/hour per IP)
4. Review session manager logs for refresh errors

### Issue: Offline Mode Not Working

**Cause**: `lastValidatedAt` timestamp not updating

**Solution**:

1. Verify MMKV storage is working
2. Check session manager is calling `validateSession()` on app start
3. Ensure network state listener is active
4. Review offline mode logic in `src/lib/auth/session-manager.ts`

## Testing Checklist

After migration, verify:

- [ ] Existing users remain signed in
- [ ] New sign ups work with email/password
- [ ] OAuth sign in works (Apple and Google)
- [ ] Password reset flow completes successfully
- [ ] Email verification links open app correctly
- [ ] Session persists across app restarts
- [ ] Offline mode works (test with airplane mode)
- [ ] Session revocation works from settings
- [ ] Brute-force protection triggers after 5 failed attempts
- [ ] Deep links open correct screens

## Support

For issues or questions:

1. Check [OAuth Setup Guide](./oauth-setup.md) for provider configuration
2. Review [Authentication Design Doc](<../../.kiro/specs/23.\ authentication-account-lifecycle/design.md>)
3. Check Supabase Auth logs in dashboard
4. Review device logs for client-side errors

## Version Compatibility

- **Minimum Expo SDK**: 54
- **Minimum React Native**: 0.81.4
- **Minimum Supabase JS**: 2.57.4
- **Minimum MMKV**: 3.1.0

## Security Notes

- MMKV encryption keys are stored in Expo SecureStore (hardware-backed on supported devices)
- Session tokens are encrypted at rest on Android
- iOS relies on OS-level encryption (Data Protection API)
- PII is sanitized in logs (emails hashed, IPs truncated, passwords redacted)
- Consent is required for telemetry and crash reporting
- All auth events respect privacy preferences

## Next Steps

1. Review [OAuth Setup Guide](./oauth-setup.md) to configure Apple/Google sign in
2. Test authentication flows on physical devices
3. Configure email templates in Supabase dashboard
4. Set up monitoring for auth errors in Sentry
5. Review security settings in Supabase dashboard
