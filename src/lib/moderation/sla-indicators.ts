/**
 * SLA visual indicator utilities for moderator console UI
 * Maps SLA status to colors, icons, and display properties
 * Requirements: 2.3
 */

import type { SLAStatus } from '@/types/moderation';

/**
 * Color mapping for SLA status indicators (Tailwind classes)
 */
export const SLA_COLORS: Record<
  SLAStatus,
  {
    bg: string;
    text: string;
    border: string;
    badge: string;
  }
> = {
  green: {
    bg: 'bg-success-50',
    text: 'text-success-700',
    border: 'border-success-300',
    badge: 'bg-success-500',
  },
  yellow: {
    bg: 'bg-warning-50',
    text: 'text-warning-700',
    border: 'border-warning-300',
    badge: 'bg-warning-500',
  },
  orange: {
    bg: 'bg-warning-100',
    text: 'text-warning-800',
    border: 'border-warning-400',
    badge: 'bg-warning-600',
  },
  red: {
    bg: 'bg-danger-50',
    text: 'text-danger-700',
    border: 'border-danger-300',
    badge: 'bg-danger-500',
  },
  critical: {
    bg: 'bg-danger-100',
    text: 'text-danger-900',
    border: 'border-danger-600',
    badge: 'bg-danger-700',
  },
};

/**
 * Get display label for SLA status
 */
export function getSLAStatusLabel(
  status: SLAStatus,
  t: (key: string) => string
): string {
  return t(`moderation.sla.status.${status}`);
}

/**
 * Get priority level display name
 */
export function getPriorityLabel(
  priority: string,
  t: (key: string) => string
): string {
  const translated = t(`moderation.priority.${priority}`);
  // Fall back to the original priority value if translation key doesn't exist
  return translated !== `moderation.priority.${priority}`
    ? translated
    : priority;
}

/**
 * Get priority badge colors
 */
export function getPriorityColors(priority: string): {
  bg: string;
  text: string;
} {
  const colors: Record<string, { bg: string; text: string }> = {
    immediate: { bg: 'bg-danger-600', text: 'text-white' },
    illegal: { bg: 'bg-danger-500', text: 'text-white' },
    trusted: { bg: 'bg-primary-600', text: 'text-white' },
    standard: { bg: 'bg-neutral-500', text: 'text-white' },
  };
  return colors[priority] || { bg: 'bg-neutral-500', text: 'text-white' };
}

/**
 * Determine if SLA indicator should animate/pulse
 * Critical items should have animated indicators
 */
export function shouldAnimateIndicator(status: SLAStatus): boolean {
  return status === 'critical';
}

/**
 * Get accessibility label for SLA status
 */
export function getSLAAccessibilityLabel(
  status: SLAStatus,
  timeRemaining: string,
  t: (key: string) => string
): string {
  const statusLabel = getSLAStatusLabel(status, t);
  return `SLA Status: ${statusLabel}. Time remaining: ${timeRemaining}`;
}

/**
 * Get icon name for SLA status (for icon libraries)
 */
export function getSLAIcon(status: SLAStatus): string {
  const icons: Record<SLAStatus, string> = {
    green: 'check-circle',
    yellow: 'clock',
    orange: 'alert-circle',
    red: 'alert-triangle',
    critical: 'alert-octagon',
  };
  return icons[status];
}
