/**
 * Appeal Status Tracker - DSA Art. 20 UI Component
 *
 * Displays:
 * - Current appeal status
 * - Timeline of appeal process
 * - Decision outcome when resolved
 * - ODS escalation option when applicable
 *
 * Requirements: 4.1, 4.2, 4.8, 13.1
 */

import React from 'react';
import { useTranslation } from 'react-i18next';

import { Text, View } from '@/components/ui';
import type { Appeal } from '@/types/moderation';

import { AppealDetails } from './appeal-details';
import { AppealStatusBadge } from './appeal-status-badge';
import { DecisionOutcome } from './decision-outcome';
import { LegalNotice } from './legal-notice';
import { OdsEscalationOption } from './ods-escalation-option';
import { OdsStatus } from './ods-status';

// ============================================================================
// Types
// ============================================================================

/**
 * Props for the AppealStatusTracker component.
 *
 * - `appeal`: the domain model for the appeal being tracked.
 * - `canEscalateToODS`: feature-flag indicating whether the UI should offer
 *   an escalation path to an out-of-domain-stakeholder (ODS).
 * - `onEscalateToODS`: optional callback invoked when the user taps the
 *   escalate action. Keep this lightweight — network/activity handling
 *   belongs in a parent container or hook.
 * - `testID`: optional test identifier for automated testing.
 */
export interface AppealStatusTrackerProps {
  appeal: Appeal;
  canEscalateToODS: boolean;
  onEscalateToODS?: () => void;
  testID?: string;
}

// ============================================================================
// Component
// ============================================================================

// -- helpers & small subcomponents -----------------------------------------

/**
 * Map an AppealStatus value to a set of Tailwind class names used for the
 * status badge.
 *
 * Notes:
 * - Classes encode both light and dark theme tokens.
 * - Keep these mappings small and deterministic so tests can assert on
 *   className values if needed. If palette tokens change, update
 *   `src/components/ui/colors.js` (project-wide color tokens) instead.
 */

// -- main component (reduced size) ---------------------------------------

export function AppealStatusTracker({
  appeal,
  canEscalateToODS,
  onEscalateToODS,
  testID,
}: AppealStatusTrackerProps) {
  const { t } = useTranslation();

  // derived data passed into smaller subcomponents
  const daysUntilDeadline = Math.ceil(
    (appeal.deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
  const showODSOption =
    canEscalateToODS &&
    appeal.status === 'resolved' &&
    appeal.decision === 'rejected';
  const statusLabel = t(`appeals.status.${appeal.status}`);

  return (
    <View
      className="flex-1 bg-neutral-50 p-4 dark:bg-charcoal-950"
      testID={testID ? `${testID}__root` : undefined}
    >
      <View className="mb-6">
        <Text
          className="mb-2 text-2xl font-bold text-charcoal-950 dark:text-neutral-100"
          testID={testID ? `${testID}__title` : undefined}
        >
          {t('appeals.title.appeal_status')}
        </Text>
        <Text className="text-sm text-neutral-600 dark:text-neutral-400">
          {t('appeals.subtitle.track_progress')}
        </Text>
      </View>

      <AppealStatusBadge
        status={appeal.status}
        label={statusLabel}
        testID={testID ? `${testID}__statusBadge` : undefined}
      />

      <AppealDetails
        appeal={appeal}
        daysUntilDeadline={daysUntilDeadline}
        testID={testID ? `${testID}__details` : undefined}
      />

      <DecisionOutcome
        decision={appeal.decision}
        reasoning={appeal.decision_reasoning}
        testID={testID ? `${testID}__decision` : undefined}
      />

      {showODSOption && (
        <OdsEscalationOption
          onEscalate={onEscalateToODS}
          testID={testID ? `${testID}__odsSection` : undefined}
        />
      )}

      <OdsStatus appeal={appeal} />

      <LegalNotice />
    </View>
  );
}
