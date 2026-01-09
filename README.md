<h1 align="center">
  <img alt="logo" src="./assets/icon.png" width="124px" style="border-radius:10px"/><br/>
Mobile App </h1>

> This Project is based on [Obytes starter](https://starter.obytes.com)

## Requirements

- [React Native dev environment ](https://reactnative.dev/docs/environment-setup)
- [Node.js LTS release](https://nodejs.org/en/)
- [Git](https://git-scm.com/)
- [Watchman](https://facebook.github.io/watchman/docs/install#buildinstall), required only for macOS or Linux users
- [Pnpm](https://pnpm.io/installation)
- [Cursor](https://www.cursor.com/) or [VS Code Editor](https://code.visualstudio.com/download) ⚠️ Make sure to install all recommended extension from `.vscode/extensions.json`

## 👋 Quick start

Clone the repo to your machine and install deps :

```sh
git clone https://github.com/user/repo-name

cd ./repo-name

pnpm install
```

To run the app on ios

```sh
pnpm ios
```

To run the app on Android

```sh
pnpm android
```

### Environment

Create `.env.development`, `.env.staging`, `.env.production` with required keys (see `env.js` for schema). Example for development:

```
APP_ENV=development
API_URL=http://localhost:3000
EXPO_PUBLIC_API_BASE_URL=http://localhost:54321

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=xxxxx

# Optional Sentry
SENTRY_DSN=
```

## ✍️ Documentation

- [Rules and Conventions](https://starter.obytes.com/getting-started/rules-and-conventions/)
- [Project structure](https://starter.obytes.com/getting-started/project-structure)
- [Environment vars and config](https://starter.obytes.com/getting-started/environment-vars-config)
- [UI and Theming](https://starter.obytes.com/ui-and-theme/ui-theming)
- [Components](https://starter.obytes.com/ui-and-theme/components)
- [Forms](https://starter.obytes.com/ui-and-theme/Forms)
- [Data fetching](https://starter.obytes.com/guides/data-fetching)
- [Project Dependencies](./docs/dependencies.md)
- [Contribute to starter](https://starter.obytes.com/how-to-contribute/)

## 🔧 Features

### User Profile & Settings

GrowBro provides a comprehensive settings interface for managing user preferences, privacy controls, security, and account settings. The system is built with compliance-first principles (GDPR, ePrivacy, cannabis regulations) and follows an offline-first architecture.

#### Settings Screens

**Main Settings Hub** (`/settings`)

- Profile section with avatar, display name, and statistics
- Preferences: Language, theme, sync settings
- Privacy & Data: Consent management, data export/deletion
- Notifications: Granular category controls, quiet hours
- Security: Password management, biometric login, active sessions
- Legal: Terms, privacy policy, cannabis policy, licenses
- Support: Help center, bug reports, feedback
- About: App version, build info, update checking

**Profile Management** (`/settings/profile`)

- Edit display name, bio, location
- Avatar upload with EXIF removal and compression
- Privacy visibility toggles
- Account statistics (plants, harvests, posts, streaks)
- Offline-first with queue-and-sync

**Notification Settings** (`/settings/notifications`)

- Per-category toggles: Task Reminders, Harvest Alerts, Community Activity, System Updates, Marketing
- Task reminder timing options (hour before, day before, custom)
- Quiet hours configuration with DST support
- Platform-specific permission handling (iOS/Android)
- Multi-device sync with conflict resolution

**Privacy & Data Controls** (`/settings/privacy-and-data`)

- Granular consent management: Crash Reporting, Analytics, Personalized Data, Session Replay
- Quick actions: Reject All, Accept All
- Data export with JSON + media ZIP
- Account deletion with 30-day grace period
- Runtime SDK management based on consent

**Security Settings** (`/settings/security`)

- Password change with strength validation
- Biometric login setup (Face ID, Touch ID, fingerprint)
- Active sessions management with remote logout
- Security notification emails

**Support & Help** (`/settings/support`)

- Help Center integration
- Contact support email pre-population
- Bug report form with diagnostics
- Feedback submission with categories
- Community guidelines access

**Legal Documents** (`/settings/legal`)

- Terms of Service with version tracking
- Privacy Policy with change history
- Cannabis Policy acknowledgments
- Open source licenses viewer
- Offline document caching

**About Screen** (`/settings/about`)

- App version and build information
- Environment and update channel
- OTA update checking and download
- Store fallback for non-OTA builds

#### Deep Linking Support

All settings screens support deep links for direct navigation:

```
growbro://settings                    # Main settings hub
growbro://settings/profile            # Profile management
growbro://settings/notifications      # Notification settings
growbro://settings/privacy-and-data   # Privacy controls
growbro://settings/security           # Security settings
growbro://settings/support            # Support resources
growbro://settings/legal              # Legal documents
growbro://settings/about              # App information
```

**Behavior**: Deep links preserve back navigation to the main settings hub and handle authentication requirements automatically.

#### Data Models & Sync

**Profile Data**

```typescript
interface UserProfile {
  id: string;
  userId: string;
  displayName: string;
  bio?: string;
  location?: string;
  avatarUrl?: string;
  showInCommunity: boolean;
  createdAt: string;
  updatedAt: string;
}
```

**Notification Preferences**

```typescript
interface NotificationPreferences {
  userId: string;
  taskReminders: boolean;
  taskReminderTiming: 'hour_before' | 'day_before' | 'custom';
  customReminderMinutes?: number;
  harvestAlerts: boolean;
  communityActivity: boolean;
  systemUpdates: boolean;
  marketing: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart?: string; // HH:mm format
  quietHoursEnd?: string; // HH:mm format
  deviceId: string;
  lastUpdated: string;
}
```

**Sync Behavior**

- **Offline-first**: All settings modifications work offline and sync when online
- **Queue-and-retry**: Failed sync operations queue with exponential backoff (1s, 2s, 4s, 8s, 16s, 30s cap)
- **Conflict resolution**: Last-write-wins per preference key with timestamp comparison
- **Multi-device**: Preferences include `deviceId` and `lastUpdated` for sync coordination
- **Inline errors**: Non-blocking error surfaces with retry actions
- **Optimistic updates**: UI reflects changes immediately; rollback on permanent failure

#### Avatar Upload Pipeline

1. **Selection**: User picks from camera or photo library
2. **EXIF Removal**: Strip all metadata using `expo-image-manipulator`
3. **Crop**: Enforce 1:1 aspect ratio
4. **Resize**: Scale to 512x512px
5. **Compress**: Reduce file size to <200KB
6. **Upload**: Upload to Supabase Storage at `avatars/{userId}/{timestamp}.jpg`
7. **State Tracking**: `idle → uploading → pending → success/failed`
8. **Retry Logic**: Automatic retry on failure with exponential backoff
9. **Security**: Temporary files, RLS policies, short-lived signed URLs

#### Account Deletion Flow

1. **Explanation**: Display consequences (permanent loss, 30-day grace period)
2. **Re-authentication**: Require password or biometric verification
3. **Final Confirmation**: User types "DELETE" to proceed
4. **Initiate**: Create deletion request with `requestId` and `scheduledFor` timestamp
5. **Immediate Logout**: Log out and clear local data
6. **Grace Period**: Display "Restore Account" banner on login within 30 days
7. **Permanent Deletion**: After grace period, cascade across Supabase, WatermelonDB, blob storage
8. **Audit Logging**: Record all deletion events with timestamps and policy versions

#### Legal Document Versioning

- **Semantic Versioning**: Terms, privacy, and cannabis policies use `major.minor.patch` format
- **Major Version Bump**: Blocks app access until user re-accepts
- **Minor/Patch Bump**: Shows notification banner; allows usage with acknowledgment prompt
- **Acceptance Records**: Store `acceptedAt`, `policyVersion`, `appVersion`, `locale`
- **Audit Trail**: Maintain full history of acceptances per user

#### Compliance Features

**GDPR Compliance**

- Granular consent management with runtime SDK control
- Data export in JSON format with media attachments
- Right to deletion with 30-day grace period and cascade
- Privacy-by-design with minimal data collection
- Audit logging for consent, export, and deletion events

**ePrivacy Directive**

- Marketing notifications default to OFF
- Non-essential processing defaults to OFF in EU regions
- Explicit opt-in required for analytics and personalization

**Cannabis Regulations**

- Age verification at onboarding (18+ or 21+ based on region)
- Educational disclaimers throughout experience
- Cannabis policy acknowledgments with version tracking
- Geofencing fallback to stricter rules if region unknown

**Accessibility (WCAG 2.1 AA)**

- Minimum 44pt touch targets
- Screen reader support with state announcements
- Color contrast ratios (4.5:1 for text)
- Visible focus indicators
- Logical focus order
- Dynamic Type support

#### Testing

The settings feature includes comprehensive test coverage:

- **Unit Tests**: Components, hooks, utilities (15.1-15.5)
- **Integration Tests**: Onboarding flow, profile updates, account deletion (15.6-15.10)
- **E2E Tests**: Complete user journeys with Maestro (15.11)
- **Accessibility Audits**: Automated and manual testing (15.12)
- **Performance Tests**: TTI, query speed, throttling (15.13)

Run tests:

```sh
# Unit tests for specific component
pnpm test src/app/settings/profile.test.tsx

# Integration tests
pnpm test src/app/__tests__/onboarding-flow.test.tsx

# All settings tests
pnpm test src/app/settings/

# E2E tests
maestro test .maestro/settings/
```

#### Known Limitations

- Avatar uploads limited to 200KB after compression
- OTA updates require EAS Update configuration
- Biometric login requires device capability
- Active session management requires Supabase Auth v2.x
- Legal document offline cache requires initial online fetch
  # G r o w B r o
   
   
