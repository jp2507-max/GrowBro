/**
 * Shift Preview Modal
 *
 * Shows before/after diff with conflict warnings for manually edited tasks
 * before applying a schedule shift
 *
 * Requirements: 3.3, 3.4, UI/UX implementation
 */

/* eslint-disable max-lines-per-function */
import { DateTime } from 'luxon';
import React from 'react';
import { ScrollView } from 'react-native';

import { Button, Text, View } from '@/components/ui';
import { translate } from '@/lib/i18n';
import type { ScheduleShiftPreview } from '@/types/playbook';

type ShiftPreviewModalProps = {
  preview: ScheduleShiftPreview;
  onConfirm: () => void;
  onCancel: () => void;
  timezone: string;
};

export function ShiftPreviewModal({
  preview,
  onConfirm,
  onCancel,
  timezone,
}: ShiftPreviewModalProps) {
  const direction = preview.daysDelta > 0 ? 'forward' : 'backward';
  const absDays = Math.abs(preview.daysDelta);

  return (
    <View
      className="flex-1 bg-neutral-50 dark:bg-charcoal-950"
      accessibilityViewIsModal={true}
      accessibilityLabel={translate(
        'playbooks.shiftPreview.accessibilityLabel'
      )}
      accessibilityHint="Shows preview of schedule changes before applying"
    >
      {/* Header */}
      <View className="border-b border-neutral-200 bg-white p-4 dark:border-charcoal-800 dark:bg-charcoal-900">
        <Text
          className="text-xl font-semibold text-neutral-900 dark:text-neutral-100"
          tx="playbooks.shiftPreview.title"
        />
        <Text
          className="mt-1 text-sm text-neutral-600 dark:text-neutral-400"
          tx="playbooks.shiftPreview.subtitle"
          txOptions={{
            count: absDays,
            plural: absDays !== 1 ? 's' : '',
            direction,
          }}
        />
      </View>

      <ScrollView className="flex-1 p-4">
        {/* Summary Stats */}
        <View className="mb-4 rounded-lg border border-neutral-200 bg-white p-4 dark:border-charcoal-800 dark:bg-charcoal-900">
          <View className="mb-3 flex-row items-center justify-between">
            <Text
              className="text-sm text-neutral-600 dark:text-neutral-400"
              tx="playbooks.shiftPreview.affectedTasks"
            />
            <Text className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
              {preview.affectedTaskCount}
            </Text>
          </View>

          {preview.firstNewDate && preview.lastNewDate && (
            <View className="flex-row items-center justify-between">
              <Text
                className="text-sm text-neutral-600 dark:text-neutral-400"
                tx="playbooks.shiftPreview.newDateRange"
              />
              <Text className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                {DateTime.fromISO(preview.firstNewDate, {
                  zone: timezone,
                }).toFormat('MMM d')}{' '}
                →{' '}
                {DateTime.fromISO(preview.lastNewDate, {
                  zone: timezone,
                }).toFormat('MMM d')}
              </Text>
            </View>
          )}
        </View>

        {/* Warnings */}
        {preview.manuallyEditedCount > 0 && (
          <View className="mb-4 rounded-lg border border-warning-200 bg-warning-50 p-3 dark:border-warning-800 dark:bg-warning-900/20">
            <View className="mb-1 flex-row items-center">
              <Text className="text-lg">⚠️</Text>
              <Text
                className="ml-2 font-semibold text-warning-800 dark:text-warning-200"
                tx="playbooks.shiftPreview.manuallyEditedTasks"
              />
            </View>
            <Text className="text-sm text-warning-700 dark:text-warning-300">
              {preview.manuallyEditedCount} task
              {preview.manuallyEditedCount !== 1 ? 's' : ''}{' '}
              {preview.options.includeManuallyEdited ? (
                <Text tx="playbooks.shiftPreview.willBeShifted" />
              ) : (
                <Text tx="playbooks.shiftPreview.willBeExcluded" />
              )}
            </Text>
          </View>
        )}

        {preview.collisionWarnings.length > 0 && (
          <View className="mb-4 rounded-lg border border-danger-200 bg-danger-50 p-3 dark:border-danger-800 dark:bg-danger-900/20">
            <View className="mb-2 flex-row items-center">
              <Text className="text-lg">🚨</Text>
              <Text
                className="ml-2 font-semibold text-danger-800 dark:text-danger-200"
                tx="playbooks.shiftPreview.potentialConflicts"
              />
            </View>
            {preview.collisionWarnings.map((warning, index) => (
              <Text
                key={index}
                className="mb-1 text-sm text-danger-700 dark:text-danger-300"
              >
                • {warning}
              </Text>
            ))}
          </View>
        )}

        {/* Phase Breakdown */}
        <View className="mb-4">
          <Text
            className="mb-2 text-sm font-medium uppercase text-neutral-500 dark:text-neutral-400"
            tx="playbooks.shiftPreview.changesByPhase"
          />
          {preview.phaseBreakdown.map((phase, index) => (
            <View
              key={`phase-${phase.phaseIndex}-${index}`}
              className="mb-2 flex-row items-center justify-between rounded-lg border border-neutral-200 bg-white p-3 dark:border-charcoal-800 dark:bg-charcoal-900"
            >
              <Text
                className="text-sm text-neutral-700 dark:text-neutral-300"
                tx="playbooks.shiftPreview.phaseLabel"
                txOptions={{ number: phase.phaseIndex + 1 }}
              />
              <View className="flex-row items-center gap-3">
                <Text className="text-sm text-neutral-600 dark:text-neutral-400">
                  {phase.taskCount} tasks
                </Text>
                <Text
                  className={`text-sm font-medium ${
                    phase.netDelta > 0
                      ? 'text-success-600 dark:text-success-400'
                      : phase.netDelta < 0
                        ? 'text-danger-600 dark:text-danger-400'
                        : 'text-neutral-600 dark:text-neutral-400'
                  }`}
                >
                  {phase.netDelta > 0 ? '+' : ''}
                  {phase.netDelta} days
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Info Note */}
        <View className="rounded-lg bg-primary-50 p-3 dark:bg-primary-900/10">
          <Text
            className="text-xs text-primary-700 dark:text-primary-300"
            tx="playbooks.shiftPreview.undoInfo"
          />
        </View>
      </ScrollView>

      {/* Actions */}
      <View className="border-t border-neutral-200 bg-white px-4 py-3 dark:border-charcoal-800 dark:bg-charcoal-900">
        <View className="flex-row gap-3">
          <View className="flex-1">
            <Button
              variant="outline"
              onPress={onCancel}
              label={translate('common.cancel')}
              testID="shift-cancel-button"
            />
          </View>
          <View className="flex-1">
            <Button
              onPress={onConfirm}
              label={translate('playbooks.schedule.shift.apply')}
              testID="shift-confirm-button"
            />
          </View>
        </View>
      </View>
    </View>
  );
}
