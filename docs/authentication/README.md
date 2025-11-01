# Authentication

GrowBro uses Supabase Auth for secure, privacy-focused authentication with support for email/password and OAuth providers (Apple/Google).

## Features

- **Email/Password Authentication**: Secure sign up and sign in with email verification
- **OAuth Sign In**: Sign in with Apple or Google (iOS and Android)
- **Password Reset**: Self-service password recovery via email
- **Session Management**: Persistent sessions with offline support (up to 30 days)
- **Device Tracking**: View and manage active sessions across devices
- **Brute-Force Protection**: Account lockout after 5 failed login attempts
- **Privacy-First**: Consent-aware telemetry and PII sanitization
- **Offline Support**: Continue using the app offline with cached sessions

## Quick Start

### 1. Environment Variables

Add OAuth credentials to your `.env` files (optional, only if using OAuth):

```bash
# .env.production
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key

# OAuth (optional)
APPLE_CLIENT_SECRET=your-apple-jwt-secret
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

See [OAuth Setup Guide](./oauth-setup.md) for detailed provider configuration.

### 2. Supabase Configuration

Update `supabase/config.toml`:

```toml
[auth]
site_url = "https://growbro.app"
additional_redirect_urls = [
  "growbro://auth/callback",
  "growbro://verify-email",
  "growbro://reset-password"
]
enable_signup = true
email_confirm_required = true
password_min_length = 8
```

### 3. Deep Link Configuration

Update `app.config.cjs`:

```javascript
module.exports = {
  scheme: process.env.APP_ENV === 'production' ? 'growbro' : 'growbro-dev',
  ios: {
    usesAppleSignIn: true,
    bundleIdentifier: 'com.growbro.app',
  },
  android: {
    package: 'com.growbro.app',
  },
};
```

### 4. Database Migrations

Migrations are automatically applied via Supabase. The following tables are created:

- `user_sessions` - Device tracking and session management
- `auth_lockouts` - Brute-force protection
- `auth_audit_log` - Security audit trail (admin-only)

## Usage

### Sign In with Email/Password

```typescript
import { useSignIn } from '@/api/auth';

function LoginScreen() {
  const signIn = useSignIn();

  const handleSignIn = async () => {
    await signIn.mutateAsync({
      email: 'user@example.com',
      password: 'SecurePassword123',
    });
  };

  return (
    <Button onPress={handleSignIn} loading={signIn.isPending}>
      Sign In
    </Button>
  );
}
```

### Sign In with OAuth

```typescript
import { useSignInWithOAuth } from '@/api/auth';

function LoginScreen() {
  const signInWithOAuth = useSignInWithOAuth();

  const handleAppleSignIn = async () => {
    await signInWithOAuth.mutateAsync({ provider: 'apple' });
  };

  const handleGoogleSignIn = async () => {
    await signInWithOAuth.mutateAsync({ provider: 'google' });
  };

  return (
    <>
      <Button onPress={handleAppleSignIn}>Sign in with Apple</Button>
      <Button onPress={handleGoogleSignIn}>Sign in with Google</Button>
    </>
  );
}
```

### Sign Up

```typescript
import { useSignUp } from '@/api/auth';

function SignUpScreen() {
  const signUp = useSignUp();

  const handleSignUp = async () => {
    await signUp.mutateAsync({
      email: 'user@example.com',
      password: 'SecurePassword123',
    });
    // Verification email sent automatically
  };

  return (
    <Button onPress={handleSignUp} loading={signUp.isPending}>
      Sign Up
    </Button>
  );
}
```

### Password Reset

```typescript
import { useResetPassword, useConfirmPasswordReset } from '@/api/auth';

// Request reset email
function ForgotPasswordScreen() {
  const resetPassword = useResetPassword();

  const handleReset = async () => {
    await resetPassword.mutateAsync({ email: 'user@example.com' });
    // Reset email sent
  };

  return <Button onPress={handleReset}>Reset Password</Button>;
}

// Confirm new password (after clicking email link)
function ResetPasswordConfirmScreen({ tokenHash }) {
  const confirmReset = useConfirmPasswordReset();

  const handleConfirm = async () => {
    await confirmReset.mutateAsync({
      tokenHash,
      newPassword: 'NewSecurePassword123',
    });
  };

  return <Button onPress={handleConfirm}>Set New Password</Button>;
}
```

### Check Auth State

```typescript
import { useAuth } from '@/lib/auth';

function ProtectedScreen() {
  const { user, session, status, offlineMode } = useAuth();

  if (status === 'signOut') {
    return <Redirect href="/login" />;
  }

  if (offlineMode === 'blocked') {
    return <OfflineBlockedBanner />;
  }

  return (
    <View>
      <Text>Welcome, {user?.email}</Text>
      {offlineMode === 'readonly' && <ReadOnlyBanner />}
    </View>
  );
}
```

### Manage Sessions

```typescript
import { useSessions, useRevokeSession } from '@/api/auth/use-sessions';

function ActiveSessionsScreen() {
  const { data: sessions } = useSessions();
  const revokeSession = useRevokeSession();

  const handleRevoke = async (sessionKey: string) => {
    await revokeSession.mutateAsync({ sessionKey });
  };

  return (
    <FlatList
      data={sessions}
      renderItem={({ item }) => (
        <SessionItem
          session={item}
          onRevoke={() => handleRevoke(item.session_key)}
        />
      )}
    />
  );
}
```

## Authentication Flows

### Email/Password Flow

1. User enters email and password
2. System checks for account lockout (5 failed attempts = 15 min lockout)
3. Credentials validated via Supabase Auth
4. Session tokens stored in MMKV (encrypted)
5. Auth state updated in Zustand
6. User redirected to app

### OAuth Flow

1. User taps "Sign in with Apple/Google"
2. OAuth provider authentication (native or web)
3. Authorization code exchanged for session
4. If email exists and verified, account is linked
5. Session tokens stored in MMKV
6. User redirected to app

### Password Reset Flow

1. User requests password reset
2. Reset email sent (always shows success to prevent enumeration)
3. User clicks link in email
4. Deep link opens app with token
5. User enters new password
6. Password updated and user signed in

### Email Verification Flow

1. User signs up with email/password
2. Verification email sent automatically
3. User clicks link in email
4. Deep link opens app with token
5. Email marked as verified
6. Verification banner dismissed

## Offline Session Handling

Sessions remain valid offline based on age:

- **0-7 days**: Full read/write access
- **7-30 days**: Read-only mode (mutations queued)
- **30+ days**: Forced re-authentication required

Users see banners indicating offline mode:

- "Offline - changes will sync later" (read-only)
- "Session expired - please reconnect to continue" (blocked)

## Security Features

### Brute-Force Protection

- 5 failed login attempts within 15 minutes triggers lockout
- Account locked for 15 minutes
- Email notification sent on lockout
- Generic error messages (no account enumeration)

### Session Security

- Access tokens expire after 1 hour
- Refresh tokens expire after 7 days
- Tokens automatically refreshed before expiry
- Session revocation available (per-device or global)

### PII Protection

- Emails hashed (SHA-256) in analytics
- IP addresses truncated to /24 subnet
- Passwords never logged or sent to analytics
- Device IDs replaced with session IDs
- All logging respects user consent

### Storage Security

- **Android**: MMKV with encrypted-at-rest storage
- **iOS**: MMKV with OS-level encryption (Data Protection API)
- **Encryption keys**: Stored in Expo SecureStore (hardware-backed)
- **Consent state**: Stored in SecureStore

## Deep Link Handling

The app handles the following deep links:

- `growbro://auth/callback` - OAuth callback
- `growbro://verify-email?token_hash=...` - Email verification
- `growbro://reset-password?token_hash=...` - Password reset

Deep links are validated against an allowlist:

- `/settings/*`
- `/plants/*`
- `/feed/*`
- `/calendar/*`
- `/(app)/*`

External domains and unrecognized paths are rejected.

## Error Handling

All authentication errors are mapped to localized i18n keys:

- `auth.error_invalid_credentials` - Invalid email or password
- `auth.error_email_exists` - Email already registered
- `auth.error_email_not_verified` - Email not verified
- `auth.error_network` - Network connection issue
- `auth.error_server` - Server error (5xx)
- `auth.error_account_locked` - Too many failed attempts
- `auth.error_rate_limit` - Rate limit exceeded
- `auth.error_invalid_token` - Invalid or expired token

Errors are logged to Sentry (if crash diagnostics consented) with PII sanitized.

## Troubleshooting

### Session Not Persisting

**Symptoms**: User signed out after app restart

**Solutions**:

- Check MMKV initialization in device logs
- Verify SecureStore is available (may fail on emulators)
- Ensure Supabase client has `persistSession: true`
- Review auth store hydration logic

### OAuth Not Working

**Symptoms**: OAuth redirect fails or doesn't open app

**Solutions**:

- Verify redirect URIs in OAuth provider console match Supabase config
- Check `app.config.cjs` has correct scheme
- Rebuild app with `npx expo prebuild --clean`
- Test deep link: `npx uri-scheme open growbro://auth/callback --ios`
- See [OAuth Setup Guide](./oauth-setup.md) for detailed troubleshooting

### Deep Links Not Opening App

**Symptoms**: Email verification/password reset links open browser but not app

**Solutions**:

- Verify custom URL scheme in `app.config.cjs`
- Check `additional_redirect_urls` in Supabase config
- Rebuild app after config changes
- Test manually: `npx uri-scheme open growbro://verify-email --ios`

### Account Locked

**Symptoms**: "Too many failed attempts" error

**Solutions**:

- Wait 15 minutes for automatic unlock
- Check email for lockout notification
- Verify lockout logic in `auth_lockouts` table
- Contact support if lockout persists

### Offline Mode Issues

**Symptoms**: App blocks access when offline

**Solutions**:

- Check session age (30+ days requires re-auth)
- Verify `lastValidatedAt` timestamp in storage
- Test with airplane mode to reproduce
- Review session manager logs

## Migration

If upgrading from legacy token-based auth, see [Migration Guide](./migration-guide.md) for:

- Token format changes
- Storage migration (AsyncStorage → MMKV)
- Backward compatibility notes
- Rollback instructions

## Documentation

- [Migration Guide](./migration-guide.md) - Upgrade from legacy auth
- [OAuth Setup Guide](./oauth-setup.md) - Configure Apple/Google sign in
- [Design Document](../../.kiro/specs/23.%20authentication-account-lifecycle/design.md) - Technical architecture
- [Requirements](../../.kiro/specs/23.%20authentication-account-lifecycle/requirements.md) - Feature requirements

## API Reference

### Hooks

- `useSignIn()` - Sign in with email/password
- `useSignUp()` - Create new account
- `useSignInWithOAuth()` - Initiate OAuth flow
- `useSignInWithIdToken()` - Native OAuth (Apple/Google)
- `useResetPassword()` - Request password reset email
- `useConfirmPasswordReset()` - Set new password
- `useVerifyEmail()` - Verify email with token
- `useResendVerificationEmail()` - Resend verification email
- `useSignOut()` - Sign out (local device)
- `useSignOutGlobal()` - Sign out all devices
- `useSessions()` - Fetch active sessions
- `useRevokeSession()` - Revoke specific session
- `useRevokeAllOtherSessions()` - Revoke all except current

### Auth Store

```typescript
interface AuthState {
  token: TokenType | null; // Legacy compatibility
  status: 'idle' | 'signOut' | 'signIn';
  user: User | null;
  session: Session | null;
  lastValidatedAt: number | null;
  offlineMode: 'full' | 'readonly' | 'blocked';

  signIn: (session: Session, user: User) => void;
  signOut: () => void;
  updateSession: (session: Session) => void;
  setOfflineMode: (mode: OfflineMode) => void;
}
```

## Testing

### Unit Tests

```bash
# Test auth hooks
pnpm test src/api/auth

# Test auth store
pnpm test src/lib/auth

# Test session manager
pnpm test src/lib/auth/session-manager
```

### E2E Tests

```bash
# Run Maestro tests
maestro test .maestro/auth/sign-in.yaml
maestro test .maestro/auth/sign-up.yaml
maestro test .maestro/auth/password-reset.yaml
maestro test .maestro/auth/revoke-session.yaml
```

### Manual Testing

1. Test sign in/sign up flows
2. Test OAuth flows (Apple and Google)
3. Test password reset flow
4. Test email verification
5. Test offline mode (airplane mode)
6. Test session revocation
7. Test deep link handling

## Support

For issues or questions:

1. Check troubleshooting section above
2. Review [OAuth Setup Guide](./oauth-setup.md) for provider configuration
3. Check Supabase Auth logs in dashboard
4. Review device logs for client-side errors
5. See [Migration Guide](./migration-guide.md) for upgrade issues

## Version Requirements

- **Expo SDK**: 54+
- **React Native**: 0.81.4+
- **Supabase JS**: 2.57.4+
- **MMKV**: 3.1.0+
- **Node**: 18+
