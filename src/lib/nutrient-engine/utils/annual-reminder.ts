/**
 * Annual source water testing reminder utilities
 *
 * Provides logic for determining when to prompt users to retest
 * their source water profile and update baseline measurements.
 *
 * Requirements: 8.5
 */

import type { SourceWaterProfile } from '../types';

// ============================================================================
// Constants
// ============================================================================

/**
 * Reminder interval (365 days in milliseconds)
 */
export const ANNUAL_REMINDER_INTERVAL_MS = 365 * 24 * 60 * 60 * 1000;

/**
 * Early reminder threshold (30 days before anniversary in milliseconds)
 */
export const EARLY_REMINDER_THRESHOLD_MS = 30 * 24 * 60 * 60 * 1000;

// ============================================================================
// Reminder Detection
// ============================================================================

/**
 * Checks if annual testing reminder should be shown
 *
 * Requirements: 8.5 - Prompt to update source water testing annually
 *
 * @param profile - Source water profile
 * @param currentTime - Current timestamp (epoch ms), defaults to Date.now()
 * @returns True if reminder should be displayed
 */
export function shouldShowAnnualReminder(
  profile: SourceWaterProfile,
  currentTime: number = Date.now()
): boolean {
  const timeSinceLastTest = currentTime - profile.lastTestedAt;
  return timeSinceLastTest >= ANNUAL_REMINDER_INTERVAL_MS;
}

/**
 * Checks if early reminder should be shown (30 days before anniversary)
 *
 * @param profile - Source water profile
 * @param currentTime - Current timestamp (epoch ms), defaults to Date.now()
 * @returns True if early reminder should be displayed
 */
export function shouldShowEarlyReminder(
  profile: SourceWaterProfile,
  currentTime: number = Date.now()
): boolean {
  const timeSinceLastTest = currentTime - profile.lastTestedAt;
  const timeUntilReminder = ANNUAL_REMINDER_INTERVAL_MS - timeSinceLastTest;
  return (
    timeUntilReminder > 0 && timeUntilReminder <= EARLY_REMINDER_THRESHOLD_MS
  );
}

/**
 * Gets days until next testing reminder
 *
 * @param profile - Source water profile
 * @param currentTime - Current timestamp (epoch ms), defaults to Date.now()
 * @returns Days until reminder (negative if overdue)
 */
export function getDaysUntilReminder(
  profile: SourceWaterProfile,
  currentTime: number = Date.now()
): number {
  const timeSinceLastTest = currentTime - profile.lastTestedAt;
  const timeUntilReminder = ANNUAL_REMINDER_INTERVAL_MS - timeSinceLastTest;
  return Math.ceil(timeUntilReminder / (24 * 60 * 60 * 1000));
}

/**
 * Gets days overdue for testing
 *
 * @param profile - Source water profile
 * @param currentTime - Current timestamp (epoch ms), defaults to Date.now()
 * @returns Days overdue (0 if not overdue)
 */
export function getDaysOverdue(
  profile: SourceWaterProfile,
  currentTime: number = Date.now()
): number {
  const timeSinceLastTest = currentTime - profile.lastTestedAt;
  const overdue = timeSinceLastTest - ANNUAL_REMINDER_INTERVAL_MS;
  return overdue > 0 ? Math.ceil(overdue / (24 * 60 * 60 * 1000)) : 0;
}

// ============================================================================
// Reminder Messages
// ============================================================================

/**
 * Reminder message configuration
 */
export type ReminderMessage = {
  severity: 'info' | 'warning' | 'urgent';
  title: string;
  message: string;
  checklistLink: string;
  actionLabel: string;
};

/**
 * Gets reminder message configuration based on profile status
 *
 * Requirements: 8.5 - Provide checklist link for retesting
 *
 * @param profile - Source water profile
 * @param currentTime - Current timestamp (epoch ms), defaults to Date.now()
 * @returns Reminder message or null if no reminder needed
 */
export function getReminderMessage(
  profile: SourceWaterProfile,
  currentTime: number = Date.now()
): ReminderMessage | null {
  const daysOverdue = getDaysOverdue(profile, currentTime);
  const daysUntil = getDaysUntilReminder(profile, currentTime);

  if (daysOverdue > 90) {
    // Severely overdue (> 3 months)
    return {
      severity: 'urgent',
      title: 'Water Test Overdue',
      message: `Your source water profile is ${daysOverdue} days overdue for retesting. Water quality can change seasonally, affecting your pH and EC management.`,
      checklistLink: 'https://docs.growbro.app/guides/water-testing-checklist',
      actionLabel: 'Update Water Test',
    };
  } else if (daysOverdue > 0) {
    // Recently overdue
    return {
      severity: 'warning',
      title: 'Time to Retest Water',
      message: `It's been over a year since you tested "${profile.name}". Annual retesting helps catch seasonal changes in your water source.`,
      checklistLink: 'https://docs.growbro.app/guides/water-testing-checklist',
      actionLabel: 'Schedule Retest',
    };
  } else if (daysUntil <= 30) {
    // Early reminder
    return {
      severity: 'info',
      title: 'Water Test Coming Due',
      message: `Annual water testing for "${profile.name}" is coming up in ${daysUntil} days. Plan ahead to maintain accurate pH/EC guidance.`,
      checklistLink: 'https://docs.growbro.app/guides/water-testing-checklist',
      actionLabel: 'View Testing Guide',
    };
  }

  return null;
}

// ============================================================================
// Educational Content
// ============================================================================

/**
 * Gets educational content about why annual testing matters
 *
 * @returns Array of educational tips
 */
export function getAnnualTestingEducationalContent(): string[] {
  return [
    'Source water quality can change seasonally or when utilities adjust treatment',
    'Annual retesting ensures your pH and EC guidance remains accurate',
    'Key parameters to test: pH, EC, alkalinity (as CaCO₃), and hardness',
    'Professional lab testing provides most accurate results',
    'Home testing kits are acceptable for tracking trends over time',
    'Update your profile in GrowBro immediately after retesting',
  ];
}

/**
 * Gets water testing checklist items
 *
 * @returns Array of checklist items for comprehensive water testing
 */
export function getWaterTestingChecklist(): string[] {
  return [
    'Collect fresh sample from your grow water source (tap, well, RO system)',
    'Let tap water sit 24 hours if chlorinated (or use dechlorinator)',
    'Test or request lab analysis for: pH, EC/TDS, alkalinity, hardness',
    'Optional: Test for calcium, magnesium, iron if using well water',
    'Record all measurements with date in GrowBro',
    'Compare to previous test results to identify trends',
    'Adjust reservoir target ranges if water chemistry changed significantly',
  ];
}
