/**
 * Utility functions for formatting relative time with i18n support
 */

import { DateTime } from 'luxon';

import { translate, type TxKeyPath } from '@/lib/i18n';

/**
 * Relative time token types for i18n
 */
export type RelativeTimeToken = 'now' | 'minutes' | 'hours' | 'days' | 'weeks';

/**
 * Result of formatting relative time
 */
export interface RelativeTimeResult {
  token: RelativeTimeToken;
  count?: number;
}

/**
 * Format timestamp to relative time tokens for i18n
 * Returns a token and optional count that can be used with translation keys
 *
 * @param timestamp - ISO timestamp string
 * @returns RelativeTimeResult with token and optional count
 */
export function formatRelativeTime(
  timestamp: string | null | undefined
): RelativeTimeResult {
  if (!timestamp) return { token: 'now' };

  try {
    const dt = DateTime.fromISO(timestamp);
    const now = DateTime.now();
    const diff = now.diff(dt, ['weeks', 'days', 'hours', 'minutes']);

    if (diff.weeks >= 1)
      return { token: 'weeks', count: Math.floor(diff.weeks) };
    if (diff.days >= 1) return { token: 'days', count: Math.floor(diff.days) };
    if (diff.hours >= 1)
      return { token: 'hours', count: Math.floor(diff.hours) };
    if (diff.minutes >= 1)
      return { token: 'minutes', count: Math.floor(diff.minutes) };
    return { token: 'now' };
  } catch {
    return { token: 'now' };
  }
}

/**
 * Format relative time with direct translation
 * Convenience function that returns the translated string directly
 *
 * @param timestamp - ISO timestamp string
 * @param translationKeyPath - Base translation key path (e.g., 'common.timeAgo')
 * @returns Translated relative time string
 */
export function formatRelativeTimeTranslated(
  timestamp: string | null | undefined,
  translationKeyPath: TxKeyPath = 'harvest.history.relative'
): string {
  const result = formatRelativeTime(timestamp);

  if (result.token === 'now') {
    return translate(`${translationKeyPath}.now` as TxKeyPath);
  }

  if (result.count !== undefined) {
    return translate(`${translationKeyPath}.${result.token}` as TxKeyPath, {
      count: result.count,
    });
  }

  return translate(`${translationKeyPath}.now` as TxKeyPath);
}
