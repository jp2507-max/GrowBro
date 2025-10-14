/**
 * Offline Playbook Access
 * Resolver for accessing correction playbooks without network dependency
 */

import {
  getPlaybook,
  getPlaybookCategories,
  type PlaybookCategory,
  type PlaybookEntry,
  searchPlaybooks,
} from './playbook-data';

/**
 * Get correction playbook for specific alert type
 * Maps alert types to playbook categories
 *
 * @param alertType - Alert type from deviation alert
 * @returns Playbook entry with correction guidance
 */
export function getPlaybookForAlert(alertType: string): PlaybookEntry | null {
  const categoryMap: Record<string, PlaybookCategory> = {
    ph_high: 'ph_high',
    ph_low: 'ph_low',
    ec_high: 'ec_high',
    ec_low: 'ec_low',
    calibration_stale: 'calibration',
    temp_high: 'temp_issues',
  };

  const category = categoryMap[alertType];
  return category ? getPlaybook(category) : null;
}

/**
 * Get all available playbooks
 * Works offline with static data
 *
 * @returns Array of all playbook entries
 */
export function getAllPlaybooks(): PlaybookEntry[] {
  const categories = getPlaybookCategories();
  return categories.map((category) => getPlaybook(category));
}

/**
 * Search playbooks by keyword or symptom
 * Works offline
 *
 * @param query - Search query
 * @returns Matching playbook entries
 */
export function searchOfflinePlaybooks(query: string): PlaybookEntry[] {
  if (!query || query.trim().length < 2) {
    return [];
  }
  return searchPlaybooks(query);
}

/**
 * Get recommended correction steps for specific issue
 * Extracts just the actionable steps from playbook
 *
 * @param alertType - Alert type
 * @returns Array of correction steps with warnings
 */
export function getCorrectionSteps(
  alertType: string
): { instruction: string; warning?: string }[] {
  const playbook = getPlaybookForAlert(alertType);
  return (
    playbook?.steps.map((step) => ({
      instruction: step.instruction,
      warning: step.warning,
    })) || []
  );
}

/**
 * Get quick tips for specific issue
 *
 * @param alertType - Alert type
 * @returns Array of quick tips
 */
export function getQuickTips(alertType: string): string[] {
  const playbook = getPlaybookForAlert(alertType);
  return playbook?.tips || [];
}

/**
 * Get disclaimer text for playbook
 *
 * @param alertType - Alert type
 * @returns Disclaimer text
 */
export function getDisclaimer(alertType: string): string {
  const playbook = getPlaybookForAlert(alertType);
  return (
    playbook?.disclaimer ||
    'This guidance is educational only. Always use caution and consult experienced growers or professionals for specific advice.'
  );
}

/**
 * Check if playbook is available for alert type
 *
 * @param alertType - Alert type
 * @returns True if playbook exists
 */
export function hasPlaybook(alertType: string): boolean {
  return getPlaybookForAlert(alertType) !== null;
}
