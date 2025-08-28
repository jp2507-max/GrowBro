# Sentry Privacy Configuration

This document outlines the privacy-focused Sentry configuration implemented in GrowBro.

## Overview

The Sentry configuration has been updated to prioritize user privacy and comply with data protection requirements. All sensitive data collection is opt-in and can be controlled via environment variables and user consent.

## Environment Variables

### Required Variables

- `SENTRY_DSN`: The Sentry Data Source Name. If not provided, Sentry will not be initialized.

### Privacy Control Variables

- `SENTRY_SEND_DEFAULT_PII`: Controls whether personally identifiable information is sent (default: `false`)
- `SENTRY_REPLAYS_SESSION_SAMPLE_RATE`: Session replay sampling rate (default: `0`)
- `SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE`: Error replay sampling rate (default: `0`)
- `SENTRY_ENABLE_REPLAY`: Whether to enable replay features at all (default: `false`)

### Environment-Specific Defaults

#### Development

- Higher replay sampling rates for debugging
- Replay features enabled
- PII collection disabled by default

#### Staging

- Moderate replay sampling rates
- Replay features enabled
- PII collection disabled by default

#### Production

- Replay features disabled by default
- All sampling rates set to 0
- PII collection disabled by default

## Privacy Features

### 1. Conditional Initialization

Sentry only initializes if `SENTRY_DSN` is provided, allowing complete opt-out.

### 2. Data Scrubbing

The `beforeSend` hook automatically scrubs sensitive information:

- Email addresses → `[EMAIL_REDACTED]`
- Phone numbers → `[PHONE_REDACTED]`
- Street addresses → `[ADDRESS_REDACTED]`
- Credit card numbers → `[CARD_REDACTED]`
- Social Security Numbers → `[SSN_REDACTED]`

### 3. User Consent Management

The app includes a privacy consent system that allows users to control:

- Crash reporting
- Analytics
- Personalized data collection
- Session replay

### 4. Conditional Integrations

Replay and feedback integrations are only added when replay is enabled via environment variables.

## User Consent System

### Privacy Settings Component

Users can manage their privacy preferences through the `PrivacySettings` component:

```typescript
import { PrivacySettings } from '@/components/privacy-settings';

// In your settings screen
<PrivacySettings onConsentChange={(consent) => {
  // Handle consent changes
}} />
```

### Consent Storage

User consent is stored locally using MMKV and includes:

- `crashReporting`: Whether to send crash reports
- `analytics`: Whether to send analytics data
- `personalizedData`: Whether to include PII in reports
- `sessionReplay`: Whether to enable session replay
- `lastUpdated`: Timestamp of last consent update

### Consent Enforcement

The `beforeSend` hook respects user consent:

- If crash reporting is disabled, no events are sent
- If personalized data is disabled, user information is stripped
- Sensitive data is always scrubbed regardless of consent

## Implementation Details

### File Structure

```
src/lib/
├── sentry-utils.ts          # Data scrubbing and beforeSend hook
├── privacy-consent.ts       # User consent management
└── env.js                   # Environment variable configuration

src/components/
└── privacy-settings.tsx     # Privacy settings UI component

src/app/
└── _layout.tsx             # Sentry initialization
```

### Key Functions

#### `beforeSendHook`

- Scrubs sensitive data from all events
- Respects user consent settings
- Handles errors gracefully

#### `getPrivacyConsent` / `setPrivacyConsent`

- Manages user consent preferences
- Updates Sentry context with consent status
- Persists settings locally

#### `initializePrivacyConsent`

- Initializes consent system on app start
- Updates Sentry with current consent settings

## Best Practices

1. **Default to Privacy**: All privacy-sensitive features are disabled by default
2. **Explicit Consent**: Users must explicitly opt-in to data collection
3. **Granular Control**: Users can control different types of data collection independently
4. **Data Minimization**: Only collect data that's necessary for the specific purpose
5. **Transparency**: Clear explanations of what data is collected and why
6. **User Control**: Easy way for users to change their preferences at any time

## Compliance Considerations

This configuration helps with compliance for:

- **GDPR**: Explicit consent, data minimization, user control
- **CCPA**: Opt-out mechanisms, data transparency
- **App Store Guidelines**: Privacy-focused data collection
- **Cannabis Industry**: Extra privacy considerations for sensitive user data

## Testing Privacy Features

To test the privacy configuration:

1. **Environment Variables**: Test with different environment configurations
2. **Consent Changes**: Verify that consent changes are respected
3. **Data Scrubbing**: Check that sensitive data is properly redacted
4. **Conditional Features**: Ensure replay/feedback only work when enabled

## Future Enhancements

Potential improvements to consider:

- Dynamic Sentry reconfiguration based on consent changes
- More granular consent categories
- Privacy-focused analytics alternative
- Automated privacy compliance reporting
