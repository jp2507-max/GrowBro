/**
 * Playbook Adjustment Card Component
 *
 * Displays playbook adjustment suggestions from assessment results.
 * Shows adjustment description, impact, reason, and optional acceptance tracking.
 *
 * Requirements:
 * - 3.4: Display playbook adjustment suggestions with user acceptance tracking
 * - 9.1: Track playbook adjustment rates for analytics
 */

import type { TFunction } from 'i18next';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable } from 'react-native';

import { Text, View } from '@/components/ui';
import { Button } from '@/components/ui/button';
import type { PlaybookAdjustment } from '@/lib/assessment/playbook-integration';

type PlaybookAdjustmentCardProps = {
  adjustments: PlaybookAdjustment[];
  onAccept?: (adjustment: PlaybookAdjustment) => void;
  testID?: string;
};

function getImpactColor(impact: PlaybookAdjustment['impact']): string {
  switch (impact) {
    case 'schedule':
      return 'text-primary-600 dark:text-primary-400';
    case 'resource':
      return 'text-warning-600 dark:text-warning-400';
    case 'instructions':
      return 'text-neutral-600 dark:text-neutral-400';
    case 'priority':
      return 'text-danger-600 dark:text-danger-400';
    default:
      return 'text-neutral-600 dark:text-neutral-400';
  }
}

function getImpactLabel(
  impact: PlaybookAdjustment['impact'],
  t: TFunction
): string {
  switch (impact) {
    case 'schedule':
      return t('assessment.playbook.impact.schedule');
    case 'resource':
      return t('assessment.playbook.impact.resource');
    case 'instructions':
      return t('assessment.playbook.impact.instructions');
    case 'priority':
      return t('assessment.playbook.impact.priority');
    default:
      return impact;
  }
}

type PlaybookAdjustmentItemProps = {
  adjustment: PlaybookAdjustment;
  index: number;
  onAccept?: (adjustment: PlaybookAdjustment) => void;
  testID: string;
  className?: string;
};

function PlaybookAdjustmentItem({
  adjustment,
  index,
  onAccept,
  testID,
  className,
}: PlaybookAdjustmentItemProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <View
      className={`rounded-lg border border-neutral-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-900 ${className || ''}`}
      testID={`${testID}-item-${index}`}
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-1">
          <Text className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            {adjustment.description}
          </Text>
          <Text
            className={`mt-1 text-xs font-medium ${getImpactColor(adjustment.impact)}`}
          >
            {getImpactLabel(adjustment.impact, t)}
          </Text>
        </View>
      </View>

      <Text className="mt-2 text-sm text-neutral-700 dark:text-neutral-300">
        {adjustment.reason}
      </Text>

      {adjustment.suggestedDaysDelta !== undefined ? (
        <Text className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
          {t('assessment.playbook.suggestedTimingAdjustment', {
            sign:
              adjustment.suggestedDaysDelta > 0
                ? '+'
                : adjustment.suggestedDaysDelta < 0
                  ? '\u2212'
                  : '',
            count: Math.abs(adjustment.suggestedDaysDelta),
          })}
        </Text>
      ) : null}

      {adjustment.affectedPhases && adjustment.affectedPhases.length > 0 ? (
        <Text className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
          {t('assessment.playbook.affects', {
            phases: adjustment.affectedPhases.join(', '),
          })}
        </Text>
      ) : null}

      {onAccept ? (
        <Button
          variant="secondary"
          size="sm"
          onPress={() => onAccept(adjustment)}
          className="mt-3"
          testID={`${testID}-accept-${index}`}
          tx="assessment.playbook.applyAdjustment"
        />
      ) : null}
    </View>
  );
}

export function PlaybookAdjustmentCard({
  adjustments,
  onAccept,
  testID = 'playbook-adjustment-card',
}: PlaybookAdjustmentCardProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const [expanded, setExpanded] = React.useState(false);
  const hasAdjustments = adjustments.length > 0;

  const toggleExpanded = React.useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  if (!hasAdjustments) {
    return null;
  }

  return (
    <View className="mt-4" testID={testID}>
      <Pressable
        accessibilityRole="button"
        onPress={toggleExpanded}
        className="rounded-lg border border-primary-200 bg-primary-50 p-4 active:opacity-70 dark:border-primary-700 dark:bg-primary-950"
        testID={`${testID}-header`}
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-1">
            <Text className="text-base font-semibold text-primary-900 dark:text-primary-100">
              {t('assessment.playbook.title')}
            </Text>
            <Text className="mt-0.5 text-sm text-primary-700 dark:text-primary-300">
              {t('assessment.playbook.suggestionCount', {
                count: adjustments.length,
              })}
            </Text>
          </View>
          <Text className="text-xl text-primary-600 dark:text-primary-400">
            {expanded ? '▼' : '▶'}
          </Text>
        </View>
      </Pressable>

      {expanded && (
        <View className="mt-2">
          {adjustments.map((adjustment, index) => (
            <PlaybookAdjustmentItem
              key={index}
              adjustment={adjustment}
              index={index}
              onAccept={onAccept}
              testID={testID}
              className={index < adjustments.length - 1 ? 'mb-2' : ''}
            />
          ))}
        </View>
      )}
    </View>
  );
}
