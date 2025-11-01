# OAuth Provider Configuration Guide

**Date**: 2025-10-31  
**Status**: Production Ready  
**Providers**: Apple Sign-In, Google Sign-In

---

## Executive Summary

This document provides complete setup instructions for OAuth authentication providers (Apple and Google) in the GrowBro application. All configurations must be completed before production deployment to ensure secure and functional OAuth flows.

---

## Table of Contents

1. [Apple Sign-In Setup](#apple-sign-in-setup)
2. [Google Sign-In Setup](#google-sign-in-setup)
3. [Supabase Configuration](#supabase-configuration)
4. [Testing & Verification](#testing--verification)
5. [Security Considerations](#security-considerations)
6. [Troubleshooting](#troubleshooting)

---

## Apple Sign-In Setup

### Prerequisites

- Apple Developer Account (paid membership required)
- Access to Apple Developer Console
- App ID configured for your application

### Step 1: Configure App ID

1. **Navigate to Apple Developer Console**
   - Go to https://developer.apple.com/account
   - Sign in with your Apple Developer account

2. **Select Your App ID**
   - Go to **Certificates, Identifiers & Profiles**
   - Select **Identifiers** → **App IDs**
   - Find your app's Bundle ID (e.g., `com.growbro.app`)

3. **Enable Sign In with Apple**
   - Click on your App ID
   - Scroll to **Sign In with Apple** capability
   - Check the box to enable it
   - Click **Edit** to configure
   - Select **Enable as a primary App ID**
   - Click **Save**

### Step 2: Create Services ID

1. **Create New Services ID**
   - In **Identifiers**, click the **+** button
   - Select **Services IDs**
   - Click **Continue**

2. **Configure Services ID**
   - **Description**: `GrowBro Sign In with Apple`
   - **Identifier**: `com.growbro.app.signin` (must be unique)
   - Check **Sign In with Apple**
   - Click **Continue** → **Register**

3. **Configure Sign In with Apple**
   - Click on your newly created Services ID
   - Click **Configure** next to Sign In with Apple
   - **Primary App ID**: Select your app's Bundle ID
   - **Website URLs**:
     - **Domains**: `mgbekkpswaizzthgefbc.supabase.co` (your Supabase project domain)
     - **Return URLs**: `https://mgbekkpswaizzthgefbc.supabase.co/auth/v1/callback`
   - Click **Save** → **Continue** → **Save**

### Step 3: Create Sign In with Apple Key

1. **Navigate to Keys**
   - Go to **Certificates, Identifiers & Profiles** → **Keys**
   - Click the **+** button

2. **Register a New Key**
   - **Key Name**: `GrowBro Sign In with Apple Key`
   - Check **Sign In with Apple**
   - Click **Configure**
   - Select your **Primary App ID**
   - Click **Save** → **Continue** → **Register**

3. **Download Key**
   - **IMPORTANT**: Download the `.p8` key file immediately
   - Note the **Key ID** (10-character string)
   - **You cannot download this key again!**
   - Store it securely (you'll need it for Supabase configuration)

### Step 4: Get Team ID

1. **Find Your Team ID**
   - Go to **Membership** in Apple Developer Console
   - Note your **Team ID** (10-character alphanumeric string)
   - You'll need this for Supabase configuration

### Step 5: Configure Supabase

1. **Navigate to Supabase Dashboard**
   - Go to https://supabase.com/dashboard
   - Select your GrowBro project

2. **Configure Apple Provider**
   - Go to **Authentication** → **Providers**
   - Find **Apple** and click **Edit**
   - Enable Apple provider
   - Fill in the following:
     - **Services ID**: `com.growbro.app.signin` (from Step 2)
     - **Team ID**: Your 10-character Team ID (from Step 4)
     - **Key ID**: Your 10-character Key ID (from Step 3)
     - **Private Key**: Paste the contents of your `.p8` file (from Step 3)
   - Click **Save**

### Step 6: Configure Mobile App

The mobile app is already configured with Apple Sign-In. Verify the following in your code:

```typescript
// src/components/auth/login-form.tsx
const { rawNonce, hashedNonce } = await createNoncePair();
const credential = await AppleAuthentication.signInAsync({
  requestedScopes: [
    AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
    AppleAuthentication.AppleAuthenticationScope.EMAIL,
  ],
  nonce: hashedNonce, // ✅ Hashed nonce sent to Apple
});

// ✅ Raw nonce sent to Supabase for verification
signInWithIdToken.mutate({
  provider: 'apple',
  idToken: credential.identityToken,
  nonce: rawNonce,
});
```

### Apple Sign-In Checklist

- [ ] App ID configured with Sign In with Apple capability
- [ ] Services ID created and configured
- [ ] Sign In with Apple Key created and downloaded
- [ ] Team ID noted
- [ ] Supabase configured with all Apple credentials
- [ ] Redirect URLs match exactly
- [ ] Mobile app code verified
- [ ] Tested on iOS device (simulator may not work)

---

## Google Sign-In Setup

### Prerequisites

- Google Cloud Console account
- Access to Google Cloud Console
- OAuth 2.0 Client ID configured

### Step 1: Create Google Cloud Project

1. **Navigate to Google Cloud Console**
   - Go to https://console.cloud.google.com
   - Sign in with your Google account

2. **Create or Select Project**
   - Click on project dropdown (top left)
   - Click **New Project**
   - **Project Name**: `GrowBro`
   - Click **Create**

### Step 2: Configure OAuth Consent Screen

1. **Navigate to OAuth Consent Screen**
   - Go to **APIs & Services** → **OAuth consent screen**
   - Select **External** user type
   - Click **Create**

2. **Fill in App Information**
   - **App name**: `GrowBro`
   - **User support email**: Your support email
   - **App logo**: Upload your app logo (optional)
   - **Application home page**: `https://growbro.app` (or your domain)
   - **Application privacy policy**: Link to your privacy policy
   - **Application terms of service**: Link to your terms of service
   - **Authorized domains**: Add `supabase.co`
   - **Developer contact information**: Your email
   - Click **Save and Continue**

3. **Configure Scopes**
   - Click **Add or Remove Scopes**
   - Select the following scopes:
     - `openid`
     - `email`
     - `profile`
   - Click **Update** → **Save and Continue**

4. **Add Test Users** (for development)
   - Add your test user emails
   - Click **Save and Continue**

5. **Review and Submit**
   - Review your configuration
   - Click **Back to Dashboard**

### Step 3: Create OAuth 2.0 Client IDs

#### Android Client ID

1. **Create Android Credentials**
   - Go to **APIs & Services** → **Credentials**
   - Click **Create Credentials** → **OAuth client ID**
   - **Application type**: Android
   - **Name**: `GrowBro Android`
   - **Package name**: `com.growbro.app` (from app.json)
   - **SHA-1 certificate fingerprint**: Get from your keystore

2. **Get SHA-1 Fingerprint**

   ```bash
   # Debug keystore (for development)
   keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android

   # Production keystore
   keytool -list -v -keystore /path/to/your/keystore.jks -alias your-key-alias
   ```

   - Copy the **SHA-1** fingerprint
   - Paste into Google Cloud Console
   - Click **Create**

3. **Note Your Client ID**
   - Copy the **Client ID** (ends with `.apps.googleusercontent.com`)
   - You'll need this for Supabase and mobile app configuration

#### iOS Client ID

1. **Create iOS Credentials**
   - Click **Create Credentials** → **OAuth client ID**
   - **Application type**: iOS
   - **Name**: `GrowBro iOS`
   - **Bundle ID**: `com.growbro.app` (from app.json)
   - Click **Create**

2. **Note Your Client ID**
   - Copy the **Client ID**
   - You'll need this for Supabase and mobile app configuration

#### Web Client ID (for Supabase)

1. **Create Web Credentials**
   - Click **Create Credentials** → **OAuth client ID**
   - **Application type**: Web application
   - **Name**: `GrowBro Web (Supabase)`
   - **Authorized JavaScript origins**: Leave empty
   - **Authorized redirect URIs**:
     - `https://mgbekkpswaizzthgefbc.supabase.co/auth/v1/callback`
   - Click **Create**

2. **Note Your Credentials**
   - Copy the **Client ID**
   - Copy the **Client Secret**
   - You'll need both for Supabase configuration

### Step 4: Configure Supabase

1. **Navigate to Supabase Dashboard**
   - Go to https://supabase.com/dashboard
   - Select your GrowBro project

2. **Configure Google Provider**
   - Go to **Authentication** → **Providers**
   - Find **Google** and click **Edit**
   - Enable Google provider
   - Fill in the following:
     - **Client ID**: Your Web Client ID (from Step 3)
     - **Client Secret**: Your Web Client Secret (from Step 3)
     - **Authorized Client IDs**: Add both Android and iOS Client IDs (comma-separated)
   - Click **Save**

### Step 5: Configure Mobile App

Update your environment variables:

```bash
# .env
GOOGLE_WEB_CLIENT_ID=your-web-client-id.apps.googleusercontent.com
GOOGLE_IOS_CLIENT_ID=your-ios-client-id.apps.googleusercontent.com
GOOGLE_ANDROID_CLIENT_ID=your-android-client-id.apps.googleusercontent.com
```

Verify the configuration in your code:

```typescript
// src/app/_layout.tsx
GoogleSignin.configure({
  webClientId: Env.GOOGLE_WEB_CLIENT_ID,
  iosClientId: Env.GOOGLE_IOS_CLIENT_ID,
  offlineAccess: true,
});
```

### Google Sign-In Checklist

- [ ] Google Cloud project created
- [ ] OAuth consent screen configured
- [ ] Android OAuth client ID created with correct SHA-1
- [ ] iOS OAuth client ID created with correct Bundle ID
- [ ] Web OAuth client ID created for Supabase
- [ ] Supabase configured with Web credentials
- [ ] Authorized Client IDs added to Supabase
- [ ] Environment variables updated in mobile app
- [ ] Redirect URLs match exactly
- [ ] Tested on both Android and iOS devices

---

## Supabase Configuration

### Environment Variables

Ensure the following environment variables are set in Supabase:

```bash
# Apple Sign-In
APPLE_SERVICES_ID=com.growbro.app.signin
APPLE_TEAM_ID=YOUR_TEAM_ID
APPLE_KEY_ID=YOUR_KEY_ID
APPLE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----

# Google Sign-In
GOOGLE_CLIENT_ID=your-web-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-web-client-secret
```

### Redirect URLs

Verify the following redirect URLs are configured:

**Apple**:

- `https://mgbekkpswaizzthgefbc.supabase.co/auth/v1/callback`

**Google**:

- `https://mgbekkpswaizzthgefbc.supabase.co/auth/v1/callback`

### Deep Link Configuration

Ensure your app handles OAuth redirects:

```typescript
// src/lib/navigation/deep-link-allowlist.ts
export const ALLOWED_AUTH_HOSTS = [
  'auth',
  'verify-email',
  'reset-password',
  'oauth-callback', // ✅ OAuth redirects
];
```

---

## Testing & Verification

### Manual Testing Checklist

#### Apple Sign-In

- [ ] Test sign-in on iOS device (not simulator)
- [ ] Verify email and name are captured correctly
- [ ] Test "Hide My Email" feature
- [ ] Verify user is created in Supabase Auth
- [ ] Test sign-in with existing Apple ID
- [ ] Test cancellation flow
- [ ] Verify error handling for invalid credentials

#### Google Sign-In

- [ ] Test sign-in on Android device
- [ ] Test sign-in on iOS device
- [ ] Verify email and name are captured correctly
- [ ] Verify user is created in Supabase Auth
- [ ] Test sign-in with existing Google account
- [ ] Test cancellation flow
- [ ] Verify error handling for invalid credentials
- [ ] Test offline behavior

### Automated Testing

Run the Maestro E2E tests:

```bash
# Note: OAuth flows require manual testing
# Maestro tests cover email/password flows only
maestro test .maestro/auth/
```

### Verification Commands

```bash
# Check Supabase configuration
curl -X GET "https://mgbekkpswaizzthgefbc.supabase.co/auth/v1/settings" \
  -H "apikey: YOUR_ANON_KEY"

# Verify OAuth providers are enabled
# Response should include "apple" and "google" in external providers
```

---

## Security Considerations

### Nonce Handling (Apple)

**CRITICAL**: Always hash the nonce before sending to Apple:

```typescript
// ✅ CORRECT
const { rawNonce, hashedNonce } = await createNoncePair();
const credential = await AppleAuthentication.signInAsync({
  nonce: hashedNonce, // Send hashed nonce to Apple
});

signInWithIdToken.mutate({
  nonce: rawNonce, // Send raw nonce to Supabase
});

// ❌ WRONG
const nonce = generateNonce();
const credential = await AppleAuthentication.signInAsync({
  nonce: nonce, // Don't send raw nonce to Apple!
});
```

### Client ID Security

- **Never commit** OAuth credentials to version control
- Store credentials in environment variables
- Use different credentials for development and production
- Rotate credentials if compromised

### Redirect URI Validation

- Redirect URIs must match **exactly** (including trailing slashes)
- Use HTTPS only (never HTTP)
- Validate redirect URIs on both provider and Supabase sides

### Token Validation

- Always validate ID tokens on the server (Supabase handles this)
- Never trust client-side token validation alone
- Verify token expiry and issuer claims

---

## Troubleshooting

### Apple Sign-In Issues

#### "Invalid Client" Error

**Cause**: Services ID or redirect URI mismatch  
**Solution**:

1. Verify Services ID matches in Apple Developer Console and Supabase
2. Ensure redirect URI matches exactly (no trailing slash)
3. Wait 10-15 minutes after configuration changes

#### "Invalid Grant" Error

**Cause**: Nonce mismatch or expired token  
**Solution**:

1. Verify nonce is hashed before sending to Apple
2. Ensure raw nonce is sent to Supabase
3. Check token expiry (tokens are valid for 10 minutes)

#### Sign-In Works on Simulator but Not Device

**Cause**: Simulator uses different entitlements  
**Solution**:

1. Test on real iOS device
2. Verify App ID has Sign In with Apple enabled
3. Check provisioning profile includes Sign In with Apple capability

### Google Sign-In Issues

#### "Developer Error" on Android

**Cause**: SHA-1 fingerprint mismatch  
**Solution**:

1. Verify SHA-1 fingerprint matches your keystore
2. Add both debug and release SHA-1 fingerprints
3. Wait 5-10 minutes after adding fingerprints

#### "API Not Enabled" Error

**Cause**: Google Sign-In API not enabled  
**Solution**:

1. Go to Google Cloud Console → APIs & Services → Library
2. Search for "Google Sign-In API"
3. Click **Enable**

#### Sign-In Works on Android but Not iOS

**Cause**: iOS Client ID mismatch  
**Solution**:

1. Verify Bundle ID matches in Google Cloud Console and app.json
2. Ensure iOS Client ID is added to Supabase Authorized Client IDs
3. Check GoogleSignin.configure() has correct iosClientId

### General OAuth Issues

#### Redirect Loop

**Cause**: Redirect URI configuration mismatch  
**Solution**:

1. Verify redirect URIs match exactly on all platforms
2. Check deep link handler is configured correctly
3. Clear app cache and reinstall

#### "Invalid State Parameter" Error

**Cause**: State parameter mismatch (CSRF protection)  
**Solution**:

1. Ensure Supabase is handling state parameter
2. Don't modify OAuth flow manually
3. Check for browser/app cache issues

#### User Not Created in Supabase

**Cause**: Email verification or provider configuration issue  
**Solution**:

1. Check Supabase logs for errors
2. Verify email is returned from provider
3. Ensure "Confirm email" is disabled for OAuth in Supabase settings

---

## Production Deployment Checklist

### Pre-Deployment

- [ ] All OAuth providers configured and tested
- [ ] Production credentials generated (separate from development)
- [ ] Environment variables set in production environment
- [ ] Redirect URIs updated for production domain
- [ ] Security audit completed
- [ ] Error handling verified
- [ ] Monitoring and logging configured

### Post-Deployment

- [ ] Test OAuth flows in production
- [ ] Monitor error rates and success rates
- [ ] Set up alerts for OAuth failures
- [ ] Document any production-specific configurations
- [ ] Train support team on OAuth troubleshooting

---

## Support & Resources

### Apple Sign-In

- [Apple Sign-In Documentation](https://developer.apple.com/sign-in-with-apple/)
- [Supabase Apple Auth Guide](https://supabase.com/docs/guides/auth/social-login/auth-apple)

### Google Sign-In

- [Google Sign-In Documentation](https://developers.google.com/identity/sign-in/android)
- [Supabase Google Auth Guide](https://supabase.com/docs/guides/auth/social-login/auth-google)

### Supabase

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Supabase Support](https://supabase.com/support)

---

**Document Version**: 1.0  
**Last Updated**: 2025-10-31  
**Next Review**: 2026-01-31
