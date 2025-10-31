# OAuth Provider Setup Guide

This guide walks you through configuring Apple Sign In and Google Sign In for GrowBro.

## Overview

GrowBro supports OAuth authentication with:

- **Apple Sign In** (iOS and Android)
- **Google Sign In** (iOS and Android)

OAuth provides a seamless sign-in experience without requiring users to create and remember passwords.

## Prerequisites

Before starting, ensure you have:

- [ ] Apple Developer Account ($99/year) for Apple Sign In
- [ ] Google Cloud Platform account (free) for Google Sign In
- [ ] Supabase project with Auth enabled
- [ ] App deployed or running locally with correct bundle identifier

## Apple Sign In Setup

### Step 1: Configure App ID

1. Go to [Apple Developer Portal](https://developer.apple.com/account/)
2. Navigate to **Certificates, Identifiers & Profiles**
3. Select **Identifiers** → **App IDs**
4. Find your app ID (e.g., `com.growbro.app`)
5. Click **Edit** and enable **Sign In with Apple**
6. Click **Save**

### Step 2: Create Services ID

1. In **Identifiers**, click **+** to create a new identifier
2. Select **Services IDs** and click **Continue**
3. Enter:
   - **Description**: GrowBro Web Auth
   - **Identifier**: `com.growbro.app.web` (must be different from App ID)
4. Click **Continue** and **Register**
5. Click on the newly created Services ID
6. Enable **Sign In with Apple**
7. Click **Configure** next to Sign In with Apple

### Step 3: Configure Redirect URLs

In the Services ID configuration:

1. **Primary App ID**: Select your main App ID (`com.growbro.app`)
2. **Website URLs**:
   - **Domains**: Add your Supabase project domain
     ```
     <your-project-ref>.supabase.co
     ```
   - **Return URLs**: Add Supabase callback URL
     ```
     https://<your-project-ref>.supabase.co/auth/v1/callback
     ```
3. Click **Save** and **Continue**

**Example**:

```
Domain: abcdefgh.supabase.co
Return URL: https://abcdefgh.supabase.co/auth/v1/callback
```

### Step 4: Create Sign In with Apple Key

1. Navigate to **Keys** in Apple Developer Portal
2. Click **+** to create a new key
3. Enter:
   - **Key Name**: GrowBro Apple Sign In Key
   - Enable **Sign In with Apple**
4. Click **Configure** and select your **Primary App ID**
5. Click **Save** and **Continue**
6. Click **Register**
7. **Download the key file** (.p8) - you can only download this once!
8. Note the **Key ID** (e.g., `ABC123XYZ`)

### Step 5: Get Team ID

1. In Apple Developer Portal, click your name in the top right
2. Note your **Team ID** (e.g., `DEF456ABC`)

### Step 6: Generate Client Secret

Apple requires a JWT as the client secret. You can generate this using the script provided:

```bash
# In your project root
node generate-apple-secret.js
```

Or manually using the following Node.js script:

```javascript
// generate-apple-secret.js
const jwt = require('jsonwebtoken');
const fs = require('fs');

const TEAM_ID = 'YOUR_TEAM_ID'; // From Step 5
const CLIENT_ID = 'com.growbro.app.web'; // Your Services ID
const KEY_ID = 'YOUR_KEY_ID'; // From Step 4
const KEY_FILE = './AuthKey_YOUR_KEY_ID.p8'; // Downloaded in Step 4

const privateKey = fs.readFileSync(KEY_FILE, 'utf8');

const token = jwt.sign(
  {
    iss: TEAM_ID,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 86400 * 180, // 6 months
    aud: 'https://appleid.apple.com',
    sub: CLIENT_ID,
  },
  privateKey,
  {
    algorithm: 'ES256',
    keyid: KEY_ID,
  }
);

console.log('Apple Client Secret (JWT):');
console.log(token);
```

Run:

```bash
npm install jsonwebtoken
node generate-apple-secret.js
```

**Important**: The JWT expires after 6 months. You'll need to regenerate it periodically.

### Step 7: Configure Supabase

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Navigate to **Authentication** → **Providers**
4. Find **Apple** and click **Enable**
5. Enter:
   - **Client ID**: Your Services ID (e.g., `com.growbro.app.web`)
   - **Client Secret**: The JWT generated in Step 6
6. Click **Save**

### Step 8: Update Environment Variables

Add to your `.env` files:

```bash
# .env.production
APPLE_CLIENT_SECRET=eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IkFCQzEyM1hZWiJ9...

# .env.staging
APPLE_CLIENT_SECRET=eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IkFCQzEyM1hZWiJ9...
```

### Step 9: Test Apple Sign In

1. Build and run the app on a physical iOS device (Apple Sign In doesn't work on simulator)
2. Navigate to the login screen
3. Tap **Sign in with Apple**
4. Complete the Apple authentication flow
5. Verify you're signed into the app

**Testing on Android**:

- Apple Sign In works on Android using web-based OAuth flow
- Test on a physical Android device or emulator

## Google Sign In Setup

### Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click **Select a project** → **New Project**
3. Enter:
   - **Project name**: GrowBro
   - **Organization**: (optional)
4. Click **Create**

### Step 2: Configure OAuth Consent Screen

1. Navigate to **APIs & Services** → **OAuth consent screen**
2. Select **External** user type (unless you have Google Workspace)
3. Click **Create**
4. Fill in:
   - **App name**: GrowBro
   - **User support email**: your email
   - **Developer contact email**: your email
5. Click **Save and Continue**
6. **Scopes**: Click **Add or Remove Scopes**
   - Add: `email`, `profile`, `openid`
7. Click **Save and Continue**
8. **Test users** (optional): Add test emails for development
9. Click **Save and Continue**

### Step 3: Create OAuth Credentials

1. Navigate to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth client ID**
3. Select **Web application**
4. Enter:
   - **Name**: GrowBro Web Client
   - **Authorized JavaScript origins**: (leave empty)
   - **Authorized redirect URIs**: Add Supabase callback
     ```
     https://<your-project-ref>.supabase.co/auth/v1/callback
     ```
5. Click **Create**
6. **Copy the Client ID and Client Secret** - you'll need these

**Example**:

```
Client ID: 123456789-abcdefghijklmnop.apps.googleusercontent.com
Client Secret: GOCSPX-aBcDeFgHiJkLmNoPqRsTuVwXyZ
```

### Step 4: Create iOS OAuth Client (Optional)

For native Google Sign In on iOS (better UX):

1. Click **Create Credentials** → **OAuth client ID**
2. Select **iOS**
3. Enter:
   - **Name**: GrowBro iOS
   - **Bundle ID**: `com.growbro.app` (from app.config.cjs)
4. Click **Create**
5. Note the **iOS Client ID** (different from web client ID)

### Step 5: Create Android OAuth Client (Optional)

For native Google Sign In on Android:

1. Click **Create Credentials** → **OAuth client ID**
2. Select **Android**
3. Enter:
   - **Name**: GrowBro Android
   - **Package name**: `com.growbro.app`
   - **SHA-1 certificate fingerprint**: Get from your keystore

     ```bash
     # Debug keystore
     keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android

     # Production keystore
     keytool -list -v -keystore android/app/debug.keystore -alias androiddebugkey
     ```

4. Click **Create**

### Step 6: Configure Supabase

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Navigate to **Authentication** → **Providers**
4. Find **Google** and click **Enable**
5. Enter:
   - **Client ID**: Web Client ID from Step 3
   - **Client Secret**: Web Client Secret from Step 3
6. Click **Save**

### Step 7: Update Environment Variables

Add to your `.env` files:

```bash
# .env.production
GOOGLE_CLIENT_ID=123456789-abcdefghijklmnop.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-aBcDeFgHiJkLmNoPqRsTuVwXyZ

# .env.staging
GOOGLE_CLIENT_ID=123456789-abcdefghijklmnop.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-aBcDeFgHiJkLmNoPqRsTuVwXyZ
```

### Step 8: Test Google Sign In

1. Build and run the app
2. Navigate to the login screen
3. Tap **Sign in with Google**
4. Complete the Google authentication flow
5. Verify you're signed into the app

## Supabase Configuration

Update `supabase/config.toml` with OAuth settings:

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

[auth.external.apple]
enabled = true
client_id = "com.growbro.app.web"
secret = "env(APPLE_CLIENT_SECRET)"

[auth.external.google]
enabled = true
client_id = "env(GOOGLE_CLIENT_ID)"
secret = "env(GOOGLE_CLIENT_SECRET)"
```

Apply configuration:

```bash
# Using Supabase CLI
supabase db push

# Or using Supabase MCP tools (preferred)
# Use the mcp3_apply_migration tool
```

## App Configuration

Update `app.config.cjs`:

```javascript
module.exports = {
  // ... existing config

  scheme: process.env.APP_ENV === 'production' ? 'growbro' : 'growbro-dev',

  ios: {
    // ... existing iOS config
    usesAppleSignIn: true,
    bundleIdentifier: 'com.growbro.app',
  },

  android: {
    // ... existing Android config
    package: 'com.growbro.app',
  },
};
```

## Testing OAuth Flows

### Test Checklist

- [ ] Apple Sign In on iOS (physical device)
- [ ] Apple Sign In on Android
- [ ] Google Sign In on iOS
- [ ] Google Sign In on Android
- [ ] Account linking (sign in with OAuth when email already exists)
- [ ] Deep link redirect after OAuth callback
- [ ] Session persistence after OAuth sign in
- [ ] Sign out and sign in again with OAuth

### Testing on Development

For development testing:

1. Use `growbro-dev://` scheme for deep links
2. Add development redirect URLs to OAuth provider consoles
3. Test on physical devices (OAuth may not work on simulators)

### Common Test Scenarios

**Scenario 1: New User**

1. Tap "Sign in with Apple/Google"
2. Complete OAuth flow
3. User should be signed in
4. Email should be verified automatically

**Scenario 2: Existing User (Email Match)**

1. Create account with email/password
2. Verify email
3. Sign out
4. Tap "Sign in with Apple/Google" using same email
5. OAuth provider should be linked to existing account
6. User should be signed in

**Scenario 3: Existing User (Email Mismatch)**

1. Create account with email A
2. Sign out
3. Tap "Sign in with Apple/Google" using email B
4. New account should be created with email B

## Troubleshooting

### Apple Sign In Issues

**Issue**: "Invalid client" error

**Solution**:

- Verify Services ID matches Client ID in Supabase
- Check redirect URLs match exactly (including https://)
- Ensure JWT (client secret) hasn't expired (6 month limit)
- Regenerate JWT if needed

**Issue**: Deep link doesn't open app after OAuth

**Solution**:

- Verify `app.config.cjs` has correct scheme
- Check `additional_redirect_urls` in Supabase config includes custom scheme
- Rebuild app with `npx expo prebuild --clean`
- Test deep link manually: `npx uri-scheme open growbro://auth/callback --ios`

**Issue**: "Sign In with Apple" button not showing on iOS

**Solution**:

- Verify `usesAppleSignIn: true` in `app.config.cjs`
- Rebuild app with `npx expo prebuild`
- Check App ID has Sign In with Apple enabled in Apple Developer Portal

### Google Sign In Issues

**Issue**: "Redirect URI mismatch" error

**Solution**:

- Verify redirect URI in Google Cloud Console matches Supabase callback URL exactly
- Check for trailing slashes (should not have one)
- Ensure using HTTPS for redirect URI

**Issue**: "Access blocked: This app's request is invalid"

**Solution**:

- Complete OAuth consent screen configuration
- Add test users if app is in testing mode
- Verify scopes include `email`, `profile`, `openid`

**Issue**: Google Sign In works on iOS but not Android

**Solution**:

- Verify Android OAuth client is created in Google Cloud Console
- Check SHA-1 fingerprint matches your keystore
- Ensure package name matches `app.config.cjs`

### General OAuth Issues

**Issue**: OAuth callback returns to browser instead of app

**Solution**:

- This is expected for web-based OAuth flow
- App should handle deep link when browser redirects
- Verify deep link handler is set up correctly in `src/lib/auth/deep-link-handler.ts`

**Issue**: Session not persisting after OAuth sign in

**Solution**:

- Check MMKV storage is initialized
- Verify Supabase client has `persistSession: true`
- Review auth store hydration logic
- Check device logs for storage errors

**Issue**: "Invalid nonce" error with Apple Sign In

**Solution**:

- Ensure nonce is hashed before passing to Apple (SHA-256)
- Keep raw nonce for Supabase `signInWithIdToken`
- See memory: "hash the nonce before passing it to Apple and keep the raw nonce for Supabase signInWithIdToken"

## Security Considerations

### Client Secrets

- **Never commit secrets to git**
- Use environment variables for all secrets
- Rotate Apple JWT every 6 months
- Use different credentials for staging/production

### Redirect URIs

- Only add trusted redirect URIs
- Use HTTPS for production redirect URIs
- Validate redirect parameter in deep link handler
- Reject external domains

### PKCE Flow

Supabase automatically uses PKCE (Proof Key for Code Exchange) for OAuth flows:

- Prevents authorization code interception
- No additional configuration needed
- Works automatically with both Apple and Google

### State Parameter

Supabase handles CSRF protection via state parameter:

- Automatically generated and validated
- No manual implementation needed
- Protects against cross-site request forgery

## Production Checklist

Before launching OAuth in production:

- [ ] Apple Developer Account is active and paid
- [ ] Google Cloud project is set up correctly
- [ ] OAuth consent screen is verified (Google)
- [ ] Redirect URIs are configured for production domain
- [ ] Environment variables are set in production environment
- [ ] Client secrets are stored securely (not in git)
- [ ] Deep links are tested on physical devices
- [ ] Account linking works correctly
- [ ] Session persistence is verified
- [ ] Error handling is tested (network failures, user cancellation)
- [ ] Privacy policy and terms of service are linked in OAuth consent screens

## Monitoring

Monitor OAuth authentication in:

1. **Supabase Dashboard**:
   - Authentication → Users (see OAuth providers)
   - Authentication → Logs (OAuth events)

2. **Sentry** (if crash diagnostics consented):
   - OAuth errors are logged with sanitized details
   - Check for "OAuth" tag in error reports

3. **Analytics** (if telemetry consented):
   - Track `auth.sign_in` events with `method: 'apple'` or `method: 'google'`
   - Monitor OAuth conversion rates

## Resources

### Apple Sign In

- [Apple Developer Documentation](https://developer.apple.com/sign-in-with-apple/)
- [Supabase Apple Sign In Guide](https://supabase.com/docs/guides/auth/social-login/auth-apple)
- [Generate Apple Client Secret](https://github.com/supabase/supabase/discussions/1465)

### Google Sign In

- [Google OAuth Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Supabase Google Sign In Guide](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Google Cloud Console](https://console.cloud.google.com/)

### Supabase

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Supabase OAuth Providers](https://supabase.com/docs/guides/auth/social-login)
- [Supabase Deep Links](https://supabase.com/docs/guides/auth/auth-deep-linking)

## Support

For issues or questions:

1. Check [Migration Guide](./migration-guide.md) for setup instructions
2. Review Supabase Auth logs in dashboard
3. Check OAuth provider console for configuration errors
4. Review device logs for client-side errors
5. Test deep links with `npx uri-scheme` command
