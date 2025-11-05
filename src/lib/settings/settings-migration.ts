import * as Application from 'expo-application';
import * as Localization from 'expo-localization';

import { getPrivacyConsent, setPrivacyConsent } from '@/lib/privacy-consent';
import { getItem, setItem } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import { database } from '@/lib/watermelon';
import { NotificationPreferenceModel } from '@/lib/watermelon-models/notification-preference';
import { ProfileModel } from '@/lib/watermelon-models/profile';

/**
 * EU member states (as of 2025) for GDPR-compliant defaults
 * Requirements 4.8, 5.1: Non-essential processing defaults OFF in EU
 */
const EU_COUNTRIES = [
  'AT', // Austria
  'BE', // Belgium
  'BG', // Bulgaria
  'HR', // Croatia
  'CY', // Cyprus
  'CZ', // Czech Republic
  'DK', // Denmark
  'EE', // Estonia
  'FI', // Finland
  'FR', // France
  'DE', // Germany
  'GR', // Greece
  'HU', // Hungary
  'IE', // Ireland
  'IT', // Italy
  'LV', // Latvia
  'LT', // Lithuania
  'LU', // Luxembourg
  'MT', // Malta
  'NL', // Netherlands
  'PL', // Poland
  'PT', // Portugal
  'RO', // Romania
  'SK', // Slovakia
  'SI', // Slovenia
  'ES', // Spain
  'SE', // Sweden
];

const MIGRATION_VERSION_KEY = 'settings.migration.version';
const CURRENT_MIGRATION_VERSION = 1;

/**
 * Checks if the user's detected region is in the EU
 */
function isEURegion(): boolean {
  try {
    const locales = Localization.getLocales();
    if (locales && locales.length > 0) {
      const regionCode = locales[0]?.regionCode?.toUpperCase();
      return regionCode ? EU_COUNTRIES.includes(regionCode) : false;
    }
    return false;
  } catch (error) {
    console.warn('[SettingsMigration] Failed to detect region:', error);
    return false;
  }
}

/**
 * Gets the current authenticated user
 */
async function getCurrentUser() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return null;
  }
  return user;
}

/**
 * Creates a default profile for existing users who don't have one
 * Requirement 9.1: Detect missing profile records on first settings access
 */
async function ensureProfileExists(userId: string): Promise<void> {
  try {
    // Check if profile already exists
    const existingProfile = await database.collections
      .get<ProfileModel>('profiles')
      .query()
      .fetch();

    const hasProfile = existingProfile.some((p) => p.userId === userId);

    if (!hasProfile) {
      // Fetch display name from auth metadata if available
      const user = await getCurrentUser();
      const displayName =
        user?.user_metadata?.display_name ||
        user?.user_metadata?.full_name ||
        user?.email?.split('@')[0] ||
        'User';

      // Create default profile
      await ProfileModel.findOrCreate(database, userId, {
        displayName,
        showProfileToCommunity: true,
        allowDirectMessages: true,
        avatarStatus: 'idle',
      });

      console.info(
        '[SettingsMigration] Created default profile for user:',
        userId
      );
    }
  } catch (error) {
    console.error('[SettingsMigration] Failed to create profile:', error);
    throw error;
  }
}

/**
 * Creates default notification preferences for existing users
 * Requirements 4.8, 5.1: Conservative defaults (marketing OFF, region-based)
 */
async function ensureNotificationPreferencesExist(
  userId: string
): Promise<void> {
  try {
    const existingPrefs = await database.collections
      .get<NotificationPreferenceModel>('notification_preferences')
      .query()
      .fetch();

    const hasPrefs = existingPrefs.some((p) => p.userId === userId);

    if (!hasPrefs) {
      const isEU = isEURegion();
      const deviceId = Application.applicationId ?? 'unknown';

      // Create with conservative defaults
      // Marketing is always OFF (requirement 4.8)
      // Community notifications OFF in EU by default (requirement 5.1)
      await NotificationPreferenceModel.findOrCreate(database, userId, {
        communityInteractions: !isEU,
        communityLikes: !isEU,
        cultivationReminders: true,
        systemUpdates: true,
        taskReminders: true,
        taskReminderTiming: 'hour_before',
        harvestAlerts: true,
        communityActivity: !isEU,
        marketing: false, // Always OFF per requirement 4.8
        quietHoursEnabled: false,
        deviceId,
      });

      console.info(
        '[SettingsMigration] Created default notification preferences for user:',
        userId,
        'EU:',
        isEU
      );
    }
  } catch (error) {
    console.error(
      '[SettingsMigration] Failed to create notification preferences:',
      error
    );
    throw error;
  }
}

/**
 * Applies EU-specific privacy consent defaults
 * Requirement 5.1: Non-essential privacy processing defaults OFF in EU
 */
async function applyEUPrivacyDefaults(): Promise<void> {
  try {
    const isEU = isEURegion();
    if (!isEU) {
      return;
    }

    const currentConsent = getPrivacyConsent();

    // Check if this is the first time (lastUpdated is default)
    const isFirstRun = currentConsent.lastUpdated === 0;

    if (isFirstRun) {
      // Set conservative defaults for EU users
      // Only essential processing enabled by default
      setPrivacyConsent({
        analytics: false,
        crashReporting: true, // Essential for app stability
        personalizedData: false,
        sessionReplay: false,
        aiModelImprovement: false,
      });

      console.info(
        '[SettingsMigration] Applied EU privacy defaults (non-essential OFF)'
      );
    }
  } catch (error) {
    console.error('[SettingsMigration] Failed to apply EU defaults:', error);
    throw error;
  }
}

/**
 * Runs all migration and backfill operations
 * Requirements: 9.1, 1.2, 4.8, 5.1
 */
export async function runSettingsMigration(): Promise<void> {
  try {
    // Check if migration has already been run
    const migrationVersion = getItem<number>(MIGRATION_VERSION_KEY);
    if (migrationVersion === CURRENT_MIGRATION_VERSION) {
      return;
    }

    console.info('[SettingsMigration] Starting settings migration...');

    // Get current user
    const user = await getCurrentUser();
    if (!user) {
      console.warn(
        '[SettingsMigration] No authenticated user, skipping migration'
      );
      return;
    }

    // Run migrations in order
    await ensureProfileExists(user.id);
    await ensureNotificationPreferencesExist(user.id);
    await applyEUPrivacyDefaults();

    // Mark migration as complete
    setItem(MIGRATION_VERSION_KEY, CURRENT_MIGRATION_VERSION);

    console.info('[SettingsMigration] Migration completed successfully');
  } catch (error) {
    console.error('[SettingsMigration] Migration failed:', error);
    // Don't throw - allow app to continue even if migration fails
  }
}

/**
 * Checks if migration needs to run
 */
export function needsMigration(): boolean {
  const migrationVersion = getItem<number>(MIGRATION_VERSION_KEY);
  return migrationVersion !== CURRENT_MIGRATION_VERSION;
}

/**
 * Resets migration state (for testing only)
 */
export function __resetMigrationForTests(): void {
  setItem(MIGRATION_VERSION_KEY, null);
}
