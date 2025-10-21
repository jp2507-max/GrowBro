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

import { Button, Text, View } from '@/components/ui';
import type { Appeal, AppealStatus } from '@/types/moderation';

// ============================================================================
// Types
// ============================================================================

export interface AppealStatusTrackerProps {
  appeal: Appeal;
  canEscalateToODS: boolean;
  onEscalateToODS?: () => void;
}

// ============================================================================
// Component
// ============================================================================

export function AppealStatusTracker({
  appeal,
  canEscalateToODS,
  onEscalateToODS,
}: AppealStatusTrackerProps) {
  const { t } = useTranslation();

  const getStatusColor = (status: AppealStatus): string => {
    switch (status) {
      case 'pending':
        return 'bg-warning-100 text-warning-900 dark:bg-warning-900 dark:text-warning-100';
      case 'in_review':
        return 'bg-primary-100 text-primary-900 dark:bg-primary-900 dark:text-primary-100';
      case 'resolved':
        return 'bg-success-100 text-success-900 dark:bg-success-900 dark:text-success-100';
      case 'escalated_to_ods':
        return 'bg-neutral-100 text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100';
      default:
        return 'bg-neutral-100 text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100';
    }
  };

  const getStatusLabel = (status: AppealStatus): string => {
    return t(`appeals.status.${status}`);
  };

  const daysUntilDeadline = Math.ceil(
    (appeal.deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  const showODSOption =
    canEscalateToODS &&
    appeal.status === 'resolved' &&
    appeal.decision === 'rejected';

  return (
    <View className="flex-1 bg-neutral-50 p-4 dark:bg-charcoal-950">
      {/* Header */}
      <View className="mb-6">
        <Text className="mb-2 text-2xl font-bold text-charcoal-950 dark:text-neutral-100">
          {t('appeals.title.appealStatus')}
        </Text>
        <Text className="text-sm text-neutral-600 dark:text-neutral-400">
          {t('appeals.subtitle.trackProgress')}
        </Text>
      </View>

      {/* Status Badge */}
      <View className="mb-6">
        <View
          className={`self-start rounded-full px-4 py-2 ${getStatusColor(appeal.status)}`}
        >
          <Text className="text-sm font-medium">
            {getStatusLabel(appeal.status)}
          </Text>
        </View>
      </View>

      {/* Appeal Details */}
      <View className="mb-6 rounded-lg bg-neutral-100 p-4 dark:bg-charcoal-900">
        <View className="mb-3">
          <Text className="text-xs text-neutral-600 dark:text-neutral-400">
            {t('appeals.label.appealId')}
          </Text>
          <Text className="font-mono text-sm text-charcoal-950 dark:text-neutral-100">
            {appeal.id}
          </Text>
        </View>

        <View className="mb-3">
          <Text className="text-xs text-neutral-600 dark:text-neutral-400">
            {t('appeals.label.submittedAt')}
          </Text>
          <Text className="text-sm text-charcoal-950 dark:text-neutral-100">
            {appeal.submitted_at.toLocaleString()}
          </Text>
        </View>

        {appeal.status !== 'resolved' && (
          <View className="mb-3">
            <Text className="text-xs text-neutral-600 dark:text-neutral-400">
              {t('appeals.label.deadline')}
            </Text>
            <Text className="text-sm text-charcoal-950 dark:text-neutral-100">
              {appeal.deadline.toLocaleDateString()} ({daysUntilDeadline} days
              remaining)
            </Text>
          </View>
        )}

        {appeal.reviewer_id && (
          <View className="mb-3">
            <Text className="text-xs text-neutral-600 dark:text-neutral-400">
              {t('appeals.label.reviewer')}
            </Text>
            <Text className="text-sm text-charcoal-950 dark:text-neutral-100">
              {t('appeals.value.assignedToReviewer')}
            </Text>
          </View>
        )}

        {appeal.resolved_at && (
          <View>
            <Text className="text-xs text-neutral-600 dark:text-neutral-400">
              {t('appeals.label.resolvedAt')}
            </Text>
            <Text className="text-sm text-charcoal-950 dark:text-neutral-100">
              {appeal.resolved_at.toLocaleString()}
            </Text>
          </View>
        )}
      </View>

      {/* Decision Outcome */}
      {appeal.decision && (
        <View
          className={`mb-6 rounded-lg p-4 ${
            appeal.decision === 'upheld'
              ? 'bg-success-100 dark:bg-success-900'
              : 'bg-danger-100 dark:bg-danger-900'
          }`}
        >
          <Text
            className={`mb-2 text-sm font-bold ${
              appeal.decision === 'upheld'
                ? 'text-success-900 dark:text-success-100'
                : 'text-danger-900 dark:text-danger-100'
            }`}
          >
            {t(`appeals.decision.${appeal.decision}`)}
          </Text>
          {appeal.decision_reasoning && (
            <Text
              className={`text-sm ${
                appeal.decision === 'upheld'
                  ? 'text-success-900 dark:text-success-100'
                  : 'text-danger-900 dark:text-danger-100'
              }`}
            >
              {appeal.decision_reasoning}
            </Text>
          )}
        </View>
      )}

      {/* ODS Escalation Option */}
      {showODSOption && (
        <View className="dark:bg-primary-950 mb-6 rounded-lg border border-primary-300 bg-primary-50 p-4 dark:border-primary-700">
          <Text className="mb-2 text-sm font-bold text-primary-900 dark:text-primary-100">
            {t('appeals.ods.title')}
          </Text>
          <Text className="mb-4 text-sm text-primary-800 dark:text-primary-200">
            {t('appeals.ods.description')}
          </Text>
          <Button variant="default" onPress={onEscalateToODS}>
            <Text>{t('appeals.ods.action.escalate')}</Text>
          </Button>
        </View>
      )}

      {/* ODS Status (if escalated) */}
      {appeal.status === 'escalated_to_ods' && (
        <View className="rounded-lg bg-neutral-100 p-4 dark:bg-charcoal-900">
          <Text className="mb-2 text-sm font-bold text-charcoal-950 dark:text-neutral-100">
            {t('appeals.ods.status.escalated')}
          </Text>
          <View className="mb-2">
            <Text className="text-xs text-neutral-600 dark:text-neutral-400">
              {t('appeals.ods.label.body')}
            </Text>
            <Text className="text-sm text-charcoal-950 dark:text-neutral-100">
              {appeal.ods_body_name || t('common.unknown')}
            </Text>
          </View>
          {appeal.ods_submitted_at && (
            <View className="mb-2">
              <Text className="text-xs text-neutral-600 dark:text-neutral-400">
                {t('appeals.ods.label.submittedAt')}
              </Text>
              <Text className="text-sm text-charcoal-950 dark:text-neutral-100">
                {appeal.ods_submitted_at.toLocaleString()}
              </Text>
            </View>
          )}
          <View>
            <Text className="text-xs text-neutral-600 dark:text-neutral-400">
              {t('appeals.ods.label.targetResolution')}
            </Text>
            <Text className="text-sm text-charcoal-950 dark:text-neutral-100">
              {t('appeals.ods.value.withinDays', { days: 90 })}
            </Text>
          </View>
        </View>
      )}

      {/* Legal Notice */}
      <View className="mt-4">
        <Text className="text-xs text-neutral-500 dark:text-neutral-500">
          {t('appeals.legal.dsa20Compliance')}
        </Text>
      </View>
    </View>
  );
}
