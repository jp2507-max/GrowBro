# Design Document

## Overview

The User Profile & Settings Shell consolidates all user-facing compliance, privacy, and preference management into a unified, accessible interface. This design builds upon existing components (age-gate, privacy-settings, consent-modal) and extends them with profile management, security settings, support resources, and legal document access. The architecture follows GrowBro's offline-first principles, uses Expo Router for navigation, integrates with WatermelonDB for local storage, and syncs with Supabase for backend persistence.

### Design Goals

1. **Unified Experience**: Consolidate scattered settings into a cohesive, discoverable interface
2. **Compliance-First**: Ensure GDPR, ePrivacy, and cannabis policy compliance at every touchpoint
3. **Offline-Capable**: All settings accessible offline with queue-and-sync for network operations
4. **Accessibility**: WCAG 2.1 AA compliance with screen reader support and proper focus management
5. **Extensibility**: Modular architecture allowing easy addition of new settings sections
6. **Performance**: Settings screens load in <200ms on mid-tier devices with cached data

## Architecture

### Navigation Structure

The settings shell uses Expo Router's file-based routing with the following structure:

```
src/app/
├── age-gate.tsx                    # Existing age verification screen
├── (app)/
│   └── settings/
│       ├── index.tsx               # Main settings hub (enhanced)
│       ├── profile.tsx             # NEW: Profile management
│       ├── notifications.tsx       # Existing notification settings
│       ├── privacy-and-data.tsx    # Existing privacy controls
│       ├── security.tsx            # NEW: Password, biometric, sessions
│       ├── support.tsx             # NEW: Help, feedback, bug reports
│       ├── legal.tsx               # NEW: Terms, privacy policy, licenses
│       ├── about.tsx               # NEW: App info, version, updates
│       └── storage.tsx             # Existing storage management
```

#### Deep Links

**Supported Routes**:

- `growbro://settings`
- `growbro://settings/profile`
- `growbro://settings/notifications`
- `growbro://settings/privacy-and-data`
- `growbro://settings/security`
- `growbro://settings/support`
- `growbro://settings/legal`
- `growbro://settings/about`

**Behavior**: Deep link opens the target screen and preserves back navigation to the main settings hub.

#### Offline Badges

For items requiring network (e.g., export data, delete account), render an inline "Offline" badge and disable server-side actions until online.

### Component Hierarchy

```
Settings Shell
├── Onboarding Flow (First Launch)
│   ├── AgeGateScreen (existing)
│   ├── LegalConfirmationModal (new)
│   └── ConsentModal (existing)
│
├── Main Settings Hub (enhanced)
│   ├── ProfileSection
│   │   ├── ProfileHeader (avatar, name, stats)
│   │   └── ProfileEditLink
│   ├── PreferencesSection
│   │   ├── LanguageItem (existing)
│   │   ├── ThemeItem (existing)
│   │   └── SyncPreferences (existing)
│   ├── PrivacySection
│   │   ├── PrivacyAndDataLink
│   │   └── NotificationsLink
│   ├── SecuritySection (new)
│   │   ├── ChangePasswordLink
│   │   ├── BiometricToggle
│   │   └── ActiveSessionsLink
│   ├── LegalSection (new)
│   │   ├── TermsLink
│   │   ├── PrivacyPolicyLink
│   │   ├── CannabisPolicyLink
│   │   └── LicensesLink
│   ├── SupportSection (new)
│   │   ├── HelpCenterLink
│   │   ├── ContactSupportLink
│   │   ├── ReportBugLink
│   │   └── SendFeedbackLink
│   ├── AboutSection (enhanced)
│   │   ├── AppVersion
│   │   ├── BuildNumber
│   │   └── CheckUpdatesButton
│   └── AccountSection
│       ├── LogoutButton (existing)
│       └── DeleteAccountLink (new)
│
├── Detail Screens
│   ├── ProfileScreen (new)
│   ├── SecurityScreen (new)
│   ├── SupportScreen (new)
│   ├── LegalScreen (new)
│   └── AboutScreen (new)
│
└── Modals & Overlays
    ├── LegalConfirmationModal (new)
    ├── AccountDeletionFlow (new)
    ├── BiometricSetupModal (new)
    └── FeedbackFormModal (new)
```

## Components and Interfaces

### 1. Onboarding Flow Components

#### LegalConfirmationModal

**Purpose**: Present terms of service, privacy policy, and cannabis responsibility acknowledgment after age verification.

**Props**:

```typescript
interface LegalConfirmationModalProps {
  isVisible: boolean;
  onAccept: (acceptances: LegalAcceptances) => void;
  onDecline: () => void;
}

interface LegalAcceptances {
  termsOfService: boolean;
  privacyPolicy: boolean;
  cannabisResponsibility: boolean;
  timestamp: string;
  policyVersions: {
    terms: string;
    privacy: string;
    cannabis: string;
  };
}
```

**State Management**:

- Local state for checkbox tracking
- Zustand store for persisted legal acceptance status
- Storage key: `compliance.legal.acceptances`

**Behavior**:

- Displays scrollable legal documents with checkboxes
- "I Agree" button disabled until all checkboxes checked
- Stores acceptance with timestamp and policy versions
- Triggers re-acceptance on major version bumps

### 2. Main Settings Hub (Enhanced)

#### ProfileSection

**Component**: `ProfileHeader`

**Purpose**: Display user profile summary with avatar, display name, and key statistics.

**Interface**:

```typescript
interface ProfileHeaderProps {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  memberSince: string;
  stats: {
    totalPlants: number;
    activeGrows: number;
    completedHarvests: number;
    communityPosts: number;
  };
  onPress: () => void; // Navigate to profile edit
}
```

**Data Source**:

- WatermelonDB queries for statistics (cached)
- Supabase `profiles` table for avatar and display name
- Local storage for offline access

**Rendering**:

- Avatar: 64x64px circular image with fallback initials
- Display name: 18px semibold
- Stats: Horizontal scrollable row with icon + count
- Tap anywhere to navigate to profile edit screen

### 3. Profile Management Screen

**Route**: `/settings/profile`

**Purpose**: Allow users to edit profile information, manage visibility, and view account statistics.

**Data Model**:

```typescript
interface UserProfile {
  id: string;
  userId: string;
  displayName: string;
  bio: string;
  avatarUrl?: string;
  location?: string; // City/region only
  showProfileToCommunity: boolean;
  allowDirectMessages: boolean;
  createdAt: string;
  updatedAt: string;
}

// WatermelonDB Model
@model('profiles')
class Profile extends Model {
  @field('user_id') userId!: string;
  @field('display_name') displayName!: string;
  @field('bio') bio!: string;
  @field('avatar_url') avatarUrl?: string;
  @field('location') location?: string;
  @field('show_profile_to_community') showProfileToCommunity!: boolean;
  @field('allow_direct_messages') allowDirectMessages!: boolean;
  @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;
}
```

**Form Validation**:

```typescript
const profileSchema = z.object({
  displayName: z
    .string()
    .min(3, 'Display name must be at least 3 characters')
    .max(30, 'Display name must be at most 30 characters')
    .regex(
      /^[a-zA-Z0-9\s\-_]+$/,
      'Only letters, numbers, spaces, hyphens, and underscores allowed'
    ),
  bio: z.string().max(500, 'Bio must be at most 500 characters').optional(),
  location: z
    .string()
    .max(100, 'Location must be at most 100 characters')
    .optional(),
});
```

**Image Upload Flow**:

1. User selects image (camera or library)
2. Remove EXIF metadata using `expo-image-manipulator`
3. Crop to 1:1 aspect ratio
4. Resize to 512x512px
5. Compress to <200KB
6. Show upload progress
7. Upload to Supabase Storage: `avatars/{userId}/{timestamp}.jpg`
8. Update profile record with new URL
9. Mark as pending until upload succeeds
10. Sync to backend when online

### 4. Notification Settings Screen

**Route**: `/settings/notifications` (existing, enhanced)

**Purpose**: Manage notification preferences with granular category controls.

**Data Model**:

```typescript
interface NotificationPreferences {
  userId: string;
  taskReminders: boolean;
  taskReminderTiming: 'hour_before' | 'day_before' | 'custom';
  customReminderMinutes?: number;
  harvestAlerts: boolean;
  communityActivity: boolean;
  systemUpdates: boolean;
  marketing: boolean; // Default: false, opt-in only
  quietHoursEnabled: boolean;
  quietHoursStart?: string; // HH:mm format
  quietHoursEnd?: string; // HH:mm format
  lastUpdated: string;
  deviceId: string;
}

// Storage key: `notifications.preferences.${userId}`
```

**Platform-Specific Handling**:

**Android**:

- Check notification channel status via `expo-notifications`
- Display "Manage in system settings" link if channel disabled
- Show per-category channel info

**iOS**:

- Check notification permission status
- Display "Enable in Settings" link if denied
- Show global notification toggle

**Conflict Resolution**:

- Last-write-wins per preference key
- Include `deviceId` and `lastUpdated` for multi-device sync
- Merge preferences on sync, preferring most recent timestamp

### 5. Security Settings Screen

**Route**: `/settings/security` (new)

**Purpose**: Manage authentication, biometric login, and active sessions.

**Data Model**:

```typescript
interface SecuritySettings {
  userId: string;
  biometricEnabled: boolean;
  biometricType?: 'face' | 'fingerprint' | 'iris';
  twoFactorEnabled: boolean; // Future enhancement
  lastPasswordChange?: string;
  activeSessions: Session[];
}

interface Session {
  sessionId: string;
  deviceName: string;
  platform: 'ios' | 'android' | 'web';
  lastActive: string;
  ipAddress?: string; // Only if consent given
  location?: string; // Approximate, from server
  isCurrent: boolean;
}
```

**Biometric Setup Flow**:

1. Check device capability via `expo-local-authentication`
2. Request permission if not granted
3. Verify biometric with test authentication
4. Generate secure token and store in `expo-secure-store`
5. Update security settings
6. Show success confirmation

**Password Change Flow**:

1. Require current password for verification
2. Validate new password strength:
   - Minimum 8 characters
   - At least one uppercase letter
   - At least one lowercase letter
   - At least one number
   - At least one special character
3. Confirm new password matches
4. Update via Supabase Auth API
5. Invalidate all other sessions
6. Send security notification email
7. Show success confirmation

**Active Sessions Management**:

- Query Supabase `auth.sessions` table
- Display list with device info and last active
- "Log Out Other Sessions" button
- Revoke refresh tokens via Supabase Auth API
- Send security notification email
- Update session list within 10 seconds

### 6. Support Screen

**Route**: `/settings/support` (new)

**Purpose**: Provide access to help resources, feedback forms, and bug reporting.

**Components**:

#### HelpCenter

- Opens in-app browser to `https://growbro.app/help`
- Fallback to external browser if in-app fails
- Offline: Show cached help articles (future enhancement)

#### ContactSupport

- Opens device email client
- Pre-filled email: `support@growbro.app`
- Subject: `GrowBro Support Request`
- Body includes:
  - App version
  - Build number
  - Device model
  - OS version
  - User ID (if authenticated)

#### ReportBug

**Form Interface**:

```typescript
interface BugReport {
  title: string;
  description: string;
  category: 'crash' | 'ui' | 'sync' | 'performance' | 'other';
  screenshot?: string; // Base64 or file URI
  diagnostics: BugDiagnostics;
  sentryEventId?: string; // If crash reporting enabled
}

interface BugDiagnostics {
  appVersion: string;
  buildNumber: string;
  deviceModel: string;
  osVersion: string;
  locale: string;
  freeStorage: number; // MB
  lastSyncTime?: string;
  networkStatus: 'online' | 'offline';
}
```

**Submission Flow**:

1. User fills form with title and description
2. Optional: Attach screenshot via image picker
3. Collect diagnostics automatically
4. If crash reporting consent: Include Sentry event ID
5. Redact secrets from diagnostics
6. Allow user to deselect diagnostics
7. Submit to Supabase Edge Function: `/bug-reports`
8. Show success confirmation with ticket ID
9. Queue for retry if offline

#### SendFeedback

**Form Interface**:

```typescript
interface Feedback {
  category: 'feature_request' | 'improvement' | 'compliment' | 'other';
  message: string;
  email?: string; // Optional for follow-up
}
```

**Submission Flow**:

1. User selects category
2. User writes feedback message (max 1000 characters)
3. Optional: Provide email for follow-up
4. Submit to Supabase Edge Function: `/feedback`
5. Show success confirmation
6. Queue for retry if offline

### 7. Legal Documents Screen

**Route**: `/settings/legal` (new)

**Purpose**: Display legal documents with version tracking and offline caching.

**Data Model**:

```typescript
interface LegalDocument {
  type: 'terms' | 'privacy' | 'cannabis' | 'licenses';
  version: string; // Semantic version: "1.2.0"
  lastUpdated: string;
  content: {
    en: string; // Markdown content
    de: string; // Markdown content
  };
  requiresReAcceptance: boolean; // True for major version bumps
}

// Storage key: `legal.documents.${type}`
```

**Document Rendering**:

- Use `react-native-markdown-display` for formatted content
- Support headings, lists, links, bold, italic
- Scrollable with proper spacing
- Show version and last updated at top
- "Last synced" timestamp for offline viewing

**Version Management**:

```typescript
interface LegalAcceptanceRecord {
  userId: string;
  documentType: 'terms' | 'privacy' | 'cannabis';
  version: string;
  acceptedAt: string;
  appVersion: string;
  locale: string;
  ipAddress?: string; // Server-side only, with consent
}
```

**Re-Acceptance Flow**:

1. On app launch, check document versions
2. Compare with user's last accepted versions
3. If major version bump (e.g., 1.x.x → 2.x.x):
   - Block app access
   - Show modal with updated document
   - Require explicit re-acceptance
   - Record new acceptance
4. If minor/patch bump:
   - Show notification banner
   - Allow continued use
   - Prompt for acknowledgment

**Licenses Screen**:

- Generate license list at build time
- Use `@expo/webpack-config` or custom script
- Display package name, version, license type
- Show full license text on tap
- Support search and filter by license type
- Format: JSON file bundled with app

### 8. About Screen

**Route**: `/settings/about` (new)

**Purpose**: Display app information, version details, and update checking.

**Data Display**:

```typescript
interface AboutInfo {
  appName: string; // From Env.NAME
  version: string; // From Env.VERSION
  buildNumber: string; // From Env.BUILD_NUMBER
  environment: 'development' | 'staging' | 'production';
  copyright: string;
  website: string;
  socialMedia: {
    twitter?: string;
    instagram?: string;
    github?: string;
  };
}
```

**Check for Updates**:

- Use `expo-updates` API
- Query update channel for latest version
- Compare with current version
- If update available:
  - Show "Update Available" badge
  - Display release notes
  - "Download Update" button
  - Progress indicator during download
  - "Restart to Apply" after download
- If no update:
  - Show "You're up to date" message
- If OTA updates disabled:
  - Link to App Store / Play Store listing

**Implementation**:

```typescript
import * as Updates from 'expo-updates';

async function checkForUpdates(): Promise<UpdateCheckResult> {
  try {
    const update = await Updates.checkForUpdateAsync();
    if (update.isAvailable) {
      return {
        available: true,
        manifest: update.manifest,
      };
    }
    return { available: false };
  } catch (error) {
    console.error('Update check failed:', error);
    return { available: false, error };
  }
}

async function downloadAndApplyUpdate(): Promise<void> {
  try {
    await Updates.fetchUpdateAsync();
    await Updates.reloadAsync();
  } catch (error) {
    console.error('Update download failed:', error);
    throw error;
  }
}
```

### 9. Account Deletion Flow

**Route**: `/settings/delete-account` (new modal)

**Purpose**: Provide GDPR-compliant account deletion with grace period.

**Data Model**:

```typescript
interface AccountDeletionRequest {
  requestId: string;
  userId: string;
  requestedAt: string;
  scheduledFor: string; // 30 days from request
  status: 'pending' | 'cancelled' | 'completed';
  reason?: string; // Optional user feedback
  policyVersion: string;
}

// Storage key: `account.deletion.request`
```

**Deletion Flow Steps**:

**Step 1: Explanation Screen**

- Display consequences:
  - Permanent data loss
  - Irreversible action
  - 30-day grace period
- List what will be deleted:
  - Profile and account info
  - All plants and grow data
  - Tasks and calendar entries
  - Harvest records
  - Community posts and comments
  - Media files (photos, videos)
  - All associated data
- "Continue" button to proceed
- "Cancel" button to go back

**Step 2: Re-Authentication**

- Require password or biometric verification
- Prevent accidental deletion
- Use Supabase Auth API for verification
- Show error if authentication fails
- Allow retry

**Step 3: Final Confirmation**

- Text input requiring user to type "DELETE"
- Case-insensitive comparison
- "Confirm Deletion" button disabled until correct text entered
- Show countdown: "This action will be final in 30 days"
- "Cancel" button to abort

**Step 4: Initiate Deletion**

- Create deletion request record
- Mark account for deletion in Supabase
- Schedule cascade deletion jobs
- Log audit entry with requestId, userId, timestamp, policyVersion
- Immediately log user out
- Clear local WatermelonDB data
- Clear secure storage
- Clear MMKV storage
- Show confirmation message with grace period info

**Grace Period Handling**:

- On login within 30 days:
  - Check for pending deletion request
  - Show "Restore Account" banner
  - "Cancel Deletion" button
  - If cancelled:
    - Update request status to 'cancelled'
    - Restore account access
    - Cancel scheduled deletion jobs
    - Log audit entry
- After 30 days:
  - Execute permanent deletion
  - Cascade across:
    - Supabase tables (profiles, plants, tasks, harvests, posts, etc.)
    - Blob storage (avatars, media files)
    - Third-party processors (Sentry, analytics)
  - Create audit log entry
  - Send confirmation email (if email available)

## Data Models

### Supabase Schema

```sql
-- User profiles table
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  bio TEXT,
  avatar_url TEXT,
  location TEXT,
  show_profile_to_community BOOLEAN DEFAULT true,
  allow_direct_messages BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Notification preferences table
CREATE TABLE notification_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_reminders BOOLEAN DEFAULT true,
  task_reminder_timing TEXT DEFAULT 'hour_before',
  custom_reminder_minutes INTEGER,
  harvest_alerts BOOLEAN DEFAULT true,
  community_activity BOOLEAN DEFAULT true,
  system_updates BOOLEAN DEFAULT true,
  marketing BOOLEAN DEFAULT false,
  quiet_hours_enabled BOOLEAN DEFAULT false,
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  device_id TEXT,
  UNIQUE(user_id, device_id)
);

-- Legal acceptances table
CREATE TABLE legal_acceptances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('terms', 'privacy', 'cannabis')),
  version TEXT NOT NULL,
  accepted_at TIMESTAMPTZ DEFAULT NOW(),
  app_version TEXT NOT NULL,
  locale TEXT NOT NULL,
  ip_address INET, -- Only stored with consent
  UNIQUE(user_id, document_type, version)
);

-- Account deletion requests table
CREATE TABLE account_deletion_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  scheduled_for TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'cancelled', 'completed')),
  reason TEXT,
  policy_version TEXT NOT NULL,
  completed_at TIMESTAMPTZ
);

-- Bug reports table
CREATE TABLE bug_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id TEXT NOT NULL UNIQUE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  screenshot_url TEXT,
  diagnostics JSONB NOT NULL,
  sentry_event_id TEXT,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Feedback table
CREATE TABLE feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  category TEXT NOT NULL,
  message TEXT NOT NULL,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit logs table
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  payload JSONB,
  policy_version TEXT,
  app_version TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### WatermelonDB Schema

```typescript
// src/lib/watermelon-schema.ts additions

export const settingsSchema = {
  name: 'profiles',
  columns: [
    { name: 'user_id', type: 'string', isIndexed: true },
    { name: 'display_name', type: 'string' },
    { name: 'bio', type: 'string', isOptional: true },
    { name: 'avatar_url', type: 'string', isOptional: true },
    { name: 'location', type: 'string', isOptional: true },
    { name: 'show_profile_to_community', type: 'boolean' },
    { name: 'allow_direct_messages', type: 'boolean' },
    { name: 'created_at', type: 'number' },
    { name: 'updated_at', type: 'number' },
  ],
};

export const notificationPreferencesSchema = {
  name: 'notification_preferences',
  columns: [
    { name: 'user_id', type: 'string', isIndexed: true },
    { name: 'task_reminders', type: 'boolean' },
    { name: 'task_reminder_timing', type: 'string' },
    { name: 'custom_reminder_minutes', type: 'number', isOptional: true },
    { name: 'harvest_alerts', type: 'boolean' },
    { name: 'community_activity', type: 'boolean' },
    { name: 'system_updates', type: 'boolean' },
    { name: 'marketing', type: 'boolean' },
    { name: 'quiet_hours_enabled', type: 'boolean' },
    { name: 'quiet_hours_start', type: 'string', isOptional: true },
    { name: 'quiet_hours_end', type: 'string', isOptional: true },
    { name: 'last_updated', type: 'number' },
    { name: 'device_id', type: 'string' },
  ],
};
```

## Error Handling

### Network Errors

**Offline Behavior**:

- All settings screens accessible offline
- Display "Offline" badge for network-dependent features
- Queue changes for sync when online
- Show "Syncing..." indicator when connectivity restored
- Non-blocking inline errors with retry action

**Sync Failures**:

- Retry with exponential backoff (1s, 2s, 4s, 8s, max 30s)
- Max 3 retry attempts
- Show persistent error banner if all retries fail
- "Retry Now" button for manual retry
- Log sync errors to Sentry (if consent given)

### Validation Errors

**Form Validation**:

- Real-time validation on blur
- Inline error messages below fields
- Red border on invalid fields
- Disable submit button until valid
- Clear, actionable error messages

**Example Error Messages**:

- Display name: "Must be 3-30 characters with only letters, numbers, spaces, hyphens, and underscores"
- Bio: "Must be 500 characters or less"
- Password: "Must be at least 8 characters with uppercase, lowercase, number, and special character"

### Authentication Errors

**Session Expiration**:

- Detect 401 responses
- Show "Session Expired" modal
- Redirect to login screen
- Preserve unsaved changes in local storage
- Restore changes after re-authentication

**Permission Errors**:

- Detect 403 responses
- Show "Permission Denied" message
- Explain required permissions
- Provide link to support if persistent

## Testing Strategy

### Unit Tests

**Components to Test**:

- ProfileHeader: Rendering, stats calculation, navigation
- LegalConfirmationModal: Checkbox logic, acceptance flow
- BiometricSetupModal: Permission flow, error handling
- FeedbackForm: Validation, submission, offline queueing
- AccountDeletionFlow: Multi-step flow, confirmation logic

**Test Coverage Goals**:

- Component rendering: 100%
- User interactions: 90%
- Error states: 85%
- Edge cases: 80%

**Example Test**:

```typescript
describe('ProfileHeader', () => {
  test('displays user stats correctly', async () => {
    const stats = {
      totalPlants: 5,
      activeGrows: 2,
      completedHarvests: 3,
      communityPosts: 10,
    };
    setup(<ProfileHeader userId="123" displayName="Test User" stats={stats} />);

    expect(await screen.findByText('5')).toBeOnTheScreen();
    expect(await screen.findByText('2')).toBeOnTheScreen();
    expect(await screen.findByText('3')).toBeOnTheScreen();
    expect(await screen.findByText('10')).toBeOnTheScreen();
  });

  test('navigates to profile edit on press', async () => {
    const onPress = jest.fn();
    const { user } = setup(<ProfileHeader onPress={onPress} />);

    await user.press(screen.getByTestId('profile-header'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
```

### Integration Tests

**Flows to Test**:

1. Complete onboarding: Age gate → Legal confirmation → Consent modal
2. Profile update: Edit display name → Upload avatar → Save → Sync
3. Account deletion: Initiate → Re-auth → Confirm → Grace period → Restore
4. Notification preferences: Toggle categories → Sync → Multi-device conflict resolution
5. Bug report: Fill form → Attach screenshot → Submit → Offline queue → Retry

**Test Environment**:

- Use Maestro for E2E flows
- Mock Supabase responses
- Simulate offline/online transitions
- Test on iOS and Android

### Accessibility Tests

**Screen Reader Tests**:

- All interactive elements have labels
- State changes announced (e.g., "Analytics, off")
- Logical focus order maintained
- Headings properly structured

**Manual Testing Checklist**:

- [ ] VoiceOver (iOS) navigation through all settings screens
- [ ] TalkBack (Android) navigation through all settings screens
- [ ] Dynamic Type support (text scales correctly)
- [ ] Color contrast meets WCAG AA (4.5:1 for text)
- [ ] Touch targets minimum 44pt
- [ ] Keyboard navigation (if applicable)
- [ ] Focus indicators visible

**Automated Accessibility Checks**:

```typescript
import { axe, toHaveNoViolations } from 'jest-axe';
expect.extend(toHaveNoViolations);

test('settings screen has no accessibility violations', async () => {
  const { container } = render(<SettingsScreen />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

### Performance Tests

**Metrics to Track**:

- Settings screen TTI: <200ms
- Profile stats query: <100ms
- Image upload: Progress updates every 100ms
- Sync operation: Non-blocking, background
- Memory usage: <50MB for settings screens

**Performance Testing**:

```typescript
test('settings screen loads within 200ms', async () => {
  const startTime = performance.now();
  setup(<SettingsScreen />);
  await screen.findByText('Settings');
  const loadTime = performance.now() - startTime;
  expect(loadTime).toBeLessThan(200);
});
```

## Implementation Notes

### Localization

**Translation Keys**:
All user-facing strings must be added to `src/translations/en.json` and `src/translations/de.json`.

**Key Naming Convention**:

```
settings.{section}.{item}
settings.profile.display_name
settings.profile.bio
settings.profile.avatar
settings.security.change_password
settings.security.biometric_login
settings.support.help_center
settings.legal.terms_of_service
```

**Dynamic Content**:

```typescript
// Use interpolation for dynamic values
translate('settings.profile.member_since', { date: memberSince });
translate('settings.stats.total_plants', { count: totalPlants });
```

### Deep Linking

**Supported Deep Links**:

```
growbro://settings
growbro://settings/profile
growbro://settings/notifications
growbro://settings/privacy-and-data
growbro://settings/security
growbro://settings/support
growbro://settings/legal
growbro://settings/about
```

**Implementation**:

```typescript
// src/app/settings/[...slug].tsx
import { useLocalSearchParams } from 'expo-router';

export default function SettingsDeepLink() {
  const { slug } = useLocalSearchParams();

  // Route to appropriate settings screen
  switch (slug) {
    case 'profile':
      return <ProfileScreen />;
    case 'notifications':
      return <NotificationsScreen />;
    // ... other routes
  }
}
```

### Security Considerations

**Sensitive Data Handling**:

- Store passwords only in Supabase Auth (never locally)
- Use `expo-secure-store` for biometric tokens
- Encrypt profile data at rest (WatermelonDB encryption)
- HTTPS only for all network requests
- Validate all user inputs server-side

**Authentication Requirements**:

- Re-authenticate for:
  - Password changes
  - Account deletion
  - Biometric setup
  - Session management
- Use Supabase Auth API for verification
- Implement rate limiting for auth attempts

**Audit Logging**:

```typescript
interface AuditLogEntry {
  userId: string;
  eventType:
    | 'consent_change'
    | 'data_export'
    | 'account_deletion'
    | 'password_change'
    | 'session_revoke';
  payload: Record<string, any>; // Summary only, no sensitive data
  policyVersion: string;
  appVersion: string;
  timestamp: string;
}

async function logAuditEvent(entry: AuditLogEntry): Promise<void> {
  await supabase.from('audit_logs').insert(entry);
}
```

### Migration Strategy

**Existing Users**:

- Detect missing profile records on first settings access
- Create default profile from auth user data
- Migrate existing preferences to new schema
- Preserve legal acceptance records
- No data loss during migration

**Version Compatibility**:

- Support schema versions in WatermelonDB
- Implement migrations for schema changes
- Graceful degradation for older app versions
- Server-side validation of schema versions

## Design Decisions and Rationale

### 1. Modular Screen Architecture

**Decision**: Separate screens for each major settings category (Profile, Security, Support, Legal, About) rather than a single monolithic settings screen.

**Rationale**:

- Improves code maintainability and testability
- Reduces initial load time (lazy loading)
- Allows independent feature development
- Better navigation UX with clear hierarchy
- Easier to add new settings sections

### 2. Offline-First with Queue-and-Sync

**Decision**: All settings accessible offline with changes queued for sync when online.

**Rationale**:

- Aligns with GrowBro's offline-first architecture
- Prevents user frustration from network issues
- Ensures data consistency with conflict resolution
- Improves perceived performance
- Critical for users in areas with poor connectivity

### 3. WatermelonDB + Supabase Dual Storage

**Decision**: Store settings in both WatermelonDB (local) and Supabase (backend).

**Rationale**:

- WatermelonDB provides fast local access
- Supabase enables multi-device sync
- Conflict resolution via last-write-wins
- Backup and recovery capabilities
- Supports offline-first requirements

### 4. Granular Notification Preferences

**Decision**: Separate toggles for each notification category with per-category timing options.

**Rationale**:

- User control over notification frequency
- Reduces notification fatigue
- Compliance with platform guidelines
- Allows quiet hours configuration
- Supports multi-device sync

### 5. 30-Day Account Deletion Grace Period

**Decision**: Implement 30-day grace period for account deletion with restore option.

**Rationale**:

- GDPR best practice for irreversible actions
- Prevents accidental deletions
- Allows users to change their mind
- Provides time for data export
- Industry standard (Google, Facebook, etc.)

### 6. Biometric Authentication for Sensitive Actions

**Decision**: Require biometric or password re-authentication for password changes, account deletion, and session management.

**Rationale**:

- Prevents unauthorized access
- Security best practice
- Platform-native UX
- Reduces risk of account compromise
- Compliance with security standards

### 7. Legal Document Versioning with Re-Acceptance

**Decision**: Track legal document versions and require re-acceptance on major version bumps.

**Rationale**:

- GDPR compliance requirement
- Ensures users aware of material changes
- Audit trail for legal purposes
- Prevents silent policy changes
- Industry best practice

## Open Questions and Decisions Needed

### 1. Regional Age Requirements

**Question**: Which regions require 21+ age verification? Should we implement geofencing?

**Options**:

- A) Use device locale as proxy for region (simple, privacy-friendly)
- B) Implement IP-based geolocation (accurate, requires network)
- C) Ask user to select region manually (explicit, no privacy concerns)

**Recommendation**: Option C - Manual region selection during onboarding. Most privacy-friendly and doesn't require network access.

### 2. Marketing Notifications

**Question**: Will marketing notifications be sent? If yes, what's the opt-in flow?

**Options**:

- A) No marketing notifications (simplest)
- B) Single opt-in during onboarding (standard)
- C) Double opt-in with email confirmation (GDPR best practice)

**Recommendation**: Option A for initial release. Add marketing notifications in future release if needed with double opt-in.

### 3. Session Replay

**Question**: Will session replay be enabled? What's the redaction strategy?

**Options**:

- A) Disable session replay entirely (simplest, most privacy-friendly)
- B) Enable with aggressive redaction (all text inputs, sensitive screens)
- C) Enable with selective redaction (only password fields, payment info)

**Recommendation**: Option A for initial release. Session replay adds complexity and privacy concerns. Revisit if needed for debugging.

### 4. Data Export Scope

**Question**: Should exports include original media or compressed versions? Include soft-deleted history?

**Decisions Needed**:

- Media format: Original vs compressed (storage/bandwidth tradeoff)
- Soft-deleted data: Include vs exclude (completeness vs privacy)
- Export format: JSON only vs JSON + CSV (portability vs simplicity)

**Recommendation**:

- Compressed media (≤1280px) to reduce export size
- Exclude soft-deleted data (privacy-by-design)
- JSON + CSV for maximum portability

### 5. Profile Moderation

**Question**: Should profanity filtering use client-side, server-side, or combined approach?

**Options**:

- A) Client-side only (fast, offline-capable, bypassable)
- B) Server-side only (authoritative, requires network)
- C) Combined (client for UX, server for enforcement)

**Recommendation**: Option C - Client-side for immediate feedback, server-side for enforcement. Prevents offensive content while maintaining offline capability.

### 6. License Generation

**Question**: What tool should generate the license list for in-app rendering?

**Options**:

- A) Manual JSON file (simple, requires maintenance)
- B) Build-time script (automated, always up-to-date)
- C) Third-party tool (e.g., `license-checker`, `oss-attribution-generator`)

**Recommendation**: Option B - Custom build-time script using `npm list` or `pnpm list` to generate JSON. Integrate into EAS build process.

### 7. Two-Factor Authentication

**Question**: Is 2FA in scope for initial release or future enhancement?

**Recommendation**: Future enhancement. Focus on core settings functionality first. 2FA requires significant backend work (SMS, TOTP, backup codes).

### 8. Direct Messaging

**Question**: Is "Allow direct messages" feature planned or placeholder?

**Recommendation**: Placeholder for future enhancement. Include toggle in profile settings but disable functionality until DM feature implemented.

### 9. Quiet Hours Configuration

**Question**: Should quiet hours be per-category or global?

**Options**:

- A) Global quiet hours (simple, applies to all notifications)
- B) Per-category quiet hours (flexible, complex UX)

**Recommendation**: Option A - Global quiet hours. Simpler UX and covers most use cases. Can enhance later if needed.

### 10. Account Recovery During Grace Period

**Question**: What's the account recovery flow if user forgets password during deletion grace period?

**Recommendation**: Standard password reset flow via email. Deletion grace period should not affect password reset. After reset, show "Restore Account" banner.

## Design Enhancements and Additions

### Navigation Structure Additions

**Section Status Previews** (Main Settings Hub):

- **Notifications**: Show ON/OFF summary and quiet hours if enabled
- **Privacy & Data**: Show "All off" | "Partial" | "All on"
- **Language**: Show current locale name in native form (English, Deutsch)
- **Security**: Show "Biometrics on/off" and last password change date if available

**Error Surfaces**:

- Non-blocking inline error rows for last sync failures with a "Retry" action

### Onboarding Flow Additions

**Age Policy Fallback**:

- If region cannot be determined, apply strictest configured threshold (e.g., 21+)
- Resume logic: If onboarding is interrupted, persist the current step and resume on next launch

**LegalConfirmationModal Enhancements**:

- Include `appVersion` and `locale` in the stored acceptance record
- Re-acceptance trigger: Block access on major document version bump; banner prompt on minor/patch

### Profile Management Additions

**Media Pipeline**:

- Strip EXIF, crop 1:1, resize 512×512, compress <200KB; show upload progress bar
- State: `avatarStatus = 'idle' | 'uploading' | 'pending' | 'failed'`
- Storage path: `avatars/{userId}/{timestamp}.jpg`; temporary signed URL caching for preview

**Validation and Moderation**:

- Client-side profanity filter for `displayName` and `bio`; server-side enforcement on save
- Compliance notice when community visibility/DM toggles are disabled due to age/region

**Stats Updates**:

- Diff-based stat updates; throttle to 500ms to avoid re-render jank

### Notification Settings Additions

**Model Changes**:

- Add fields: `quietHoursEnabled`, `quietHoursStart`, `quietHoursEnd`, `lastUpdated`, `deviceId`
- Default `marketing = false` (opt-in only)

**Platform Specifics**:

- **Android**: Read per-channel enablement; show "Manage in system settings" CTA when channel disabled
- **iOS**: Show "Enable in Settings" when permission denied; reflect global status

**Conflict Resolution**:

- Last-write-wins per key using `lastUpdated`; include `deviceId` on writes; merge on sync

**Quiet Hours**:

- Suppress non-critical local notifications within window; DST-safe scheduling

### Security Settings Additions

**Biometric Setup**:

- Use `expo-local-authentication`; store only a secure token in `SecureStore`; fall back to PIN/password
- Show biometric type detected (face/fingerprint/iris) when available

**Active Sessions**:

- Display `deviceName`, `platform`, `lastActive`, approximate location if available server-side
- "Log Out Other Sessions" revokes refresh tokens and refreshes list within 10 seconds; send security email

### Support Screen Additions

**ReportBug Enhancements**:

- Include diagnostics: `appVersion`, `buildNumber`, `deviceModel`, `osVersion`, `locale`, `freeStorageMB`, `lastSyncTime`, `networkStatus`
- Optional `sentryEventId` when crash reporting consent is ON
- Redact secrets; allow user to deselect diagnostics
- Queue for retry when offline; show `ticketId` on success

**ContactSupport**:

- Pre-fill email with environment metadata in body; respect privacy consents

### Legal Documents Additions

**Licenses**:

- Consume build-time generated JSON with name, version, license type, and full text
- Searchable with filter by license type

**Offline Viewing**:

- Show "Last synced" timestamp; render "May be outdated" badge when offline

**Acceptance Record**:

- Extend record to include `appVersion`, `locale`; IP stored server-side only (with consent)

### About Screen Additions

**OTA Updates**:

- If `expo-updates` enabled: show Update Available badge, release notes, and Download/Restart actions
- Else: Link to app store listing

**Metadata**:

- Include environment channel (development/staging/production)

### Account Deletion Flow Additions

**Anonymous Users**:

- Delete local-only data and present local confirmation (no server request)

**Rate Limiting**:

- Prevent repeated deletion requests; show earliest pending request timestamp

**Audit Logging**:

- On request, cancellation, and completion: write entries with `requestId`, `userId`, `policyVersion`, `appVersion`, `timestamp`

**Restore Banner**:

- On login during grace period, show banner with "Restore Account" CTA

### Data Models Additions

**Supabase - Extend audit_logs payload expectation**:

- `payload` should be a summary object (no secrets)
- Include document versions for consent changes, `requestId` for deletions, and `deviceId` for notification writes

**WatermelonDB - Add avatarStatus column**:

- Add `avatarStatus` column (string, optional) to `profiles` model

### Error Handling Additions

**Sync Retries**:

- Exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s (cap)
- Max attempts per change: 5; persistent banner after exhaustion with manual "Retry Now"

**Authentication Errors**:

- Preserve unsaved form changes in local storage and restore after re-auth

### Testing Additions

**A11y Tests**:

- Verify screen reader announcements for toggle state changes (e.g., "Analytics, off")
- Validate minimum 44pt touch targets and focus ring visibility through snapshot or measurement helper

**Integration Flows**:

- Re-acceptance on major legal version bump (block) vs minor (banner)
- Quiet hours suppression behavior across DST change

**Performance**:

- Measure stats update throttling; ensure updates reflect within 1 second without excessive re-renders

### Localization Additions

**Key Policy**:

- All new strings must be added to `en.json` and `de.json` with native names for languages (English, Deutsch)
- Ensure runtime switch updates mounted screens, navigation headers, and toasts

### Security Additions

**Step-Up Auth**:

- Re-auth required for data export (in addition to password change and account deletion)
- Rate-limit sensitive operations; debounce security emails (10-minute window)

### Migration Strategy Additions

**Backfill**:

- On first run after update, create missing profile/notification records with conservative defaults (marketing OFF, privacy non-essential OFF in EU)

**Compatibility**:

- Add migration to append `avatarStatus` to `profiles` and `quietHours` fields to `notification_preferences`

### Open Decisions - Final Recommendations

1. **Regional age thresholds**: Manual region selection recommended (privacy-friendly, no network required)
2. **Session replay policy**: Recommend OFF initially (privacy concerns, complexity)
3. **Export media format**: Compressed (≤1280px), exclude soft-deleted data
4. **License generation**: Build-time script using `npm list` or `pnpm list`, integrated into EAS build
5. **2FA timeline**: Post-MVP (requires significant backend work)
6. **Quiet hours scope**: Global first (simpler UX, covers most use cases)
7. **DM feature status**: Placeholder toggle disabled until feature ships
