/**
 * Enhanced Conflict Resolution Modal
 *
 * Shows server vs local diff comparison with one-tap restore
 * Improved UI with better visual hierarchy and accessibility
 *
 * Requirements: 6.4, 6.5, UI/UX implementation
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';

import { Button, Text, View } from '@/components/ui';
import { translate } from '@/lib/i18n';
import type { TxKeyPath } from '@/lib/i18n/utils';
import type { LegacyConflict as Conflict } from '@/lib/sync/types';

export function formatValue(
  value: unknown,
  t?: (key: string) => string
): string {
  if (value === null || value === undefined) {
    return t?.('common.null') ?? 'null';
  }

  if (value instanceof Date) {
    return value.toLocaleString();
  }

  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2);
  }

  return String(value);
}

type ConflictHeaderProps = {
  tableName: string;
};

function ConflictHeader({
  tableName,
}: ConflictHeaderProps): React.ReactElement {
  return (
    <View
      className="border-b border-neutral-200 bg-white p-4 dark:border-charcoal-800 dark:bg-charcoal-900"
      accessibilityRole="header"
    >
      <Text
        className="text-xl font-semibold text-neutral-900 dark:text-neutral-100"
        tx="community.sync.conflict.title"
      />
      <Text
        className="mt-1 text-sm text-neutral-600 dark:text-neutral-400"
        tx="community.sync.conflict.description"
        txOptions={{ tableName }}
      />
    </View>
  );
}

function ConflictExplanation(): React.ReactElement {
  return (
    <View
      className="mb-4 rounded-lg border border-primary-200 bg-primary-50 p-4 dark:border-primary-800 dark:bg-primary-900/20"
      accessibilityRole="alert"
    >
      <Text
        className="text-sm text-primary-800 dark:text-primary-200"
        tx="community.sync.conflict.explanation"
      />
    </View>
  );
}

// Map field names to their corresponding translation keys for type safety
const FIELD_TRANSLATION_KEYS: Partial<Record<string, TxKeyPath>> = {
  name: 'community.sync.conflict.field.name',
  description: 'community.sync.conflict.field.description',
  created_at: 'community.sync.conflict.field.created_at',
  updated_at: 'community.sync.conflict.field.updated_at',
  strain_id: 'community.sync.conflict.field.strain_id',
  plant_id: 'community.sync.conflict.field.plant_id',
  status: 'community.sync.conflict.field.status',
  notes: 'community.sync.conflict.field.notes',
  phase: 'community.sync.conflict.field.phase',
  start_date: 'community.sync.conflict.field.start_date',
  end_date: 'community.sync.conflict.field.end_date',
  pH: 'community.sync.conflict.field.pH',
  ec: 'community.sync.conflict.field.ec',
  temperature: 'community.sync.conflict.field.temperature',
  humidity: 'community.sync.conflict.field.humidity',
  light_schedule: 'community.sync.conflict.field.light_schedule',
  watering_schedule: 'community.sync.conflict.field.watering_schedule',
  feeding_schedule: 'community.sync.conflict.field.feeding_schedule',
  pruning_schedule: 'community.sync.conflict.field.pruning_schedule',
  training_schedule: 'community.sync.conflict.field.training_schedule',
  monitoring_schedule: 'community.sync.conflict.field.monitoring_schedule',
  harvest_date: 'community.sync.conflict.field.harvest_date',
  drying_start: 'community.sync.conflict.field.drying_start',
  curing_start: 'community.sync.conflict.field.curing_start',
  thc_content: 'community.sync.conflict.field.thc_content',
  cbd_content: 'community.sync.conflict.field.cbd_content',
  yield_estimate: 'community.sync.conflict.field.yield_estimate',
  difficulty: 'community.sync.conflict.field.difficulty',
  indoor_outdoor: 'community.sync.conflict.field.indoor_outdoor',
  auto_photo: 'community.sync.conflict.field.auto_photo',
  genetics: 'community.sync.conflict.field.genetics',
  effects: 'community.sync.conflict.field.effects',
  flavors: 'community.sync.conflict.field.flavors',
  terpenes: 'community.sync.conflict.field.terpenes',
  height: 'community.sync.conflict.field.height',
  flowering_time: 'community.sync.conflict.field.flowering_time',
  user_id: 'community.sync.conflict.field.user_id',
  email: 'community.sync.conflict.field.email',
  username: 'community.sync.conflict.field.username',
  avatar_url: 'community.sync.conflict.field.avatar_url',
  preferences: 'community.sync.conflict.field.preferences',
  settings: 'community.sync.conflict.field.settings',
  notifications_enabled: 'community.sync.conflict.field.notifications_enabled',
  theme: 'community.sync.conflict.field.theme',
  language: 'community.sync.conflict.field.language',
  timezone: 'community.sync.conflict.field.timezone',
  location: 'community.sync.conflict.field.location',
  device_id: 'community.sync.conflict.field.device_id',
  app_version: 'community.sync.conflict.field.app_version',
  os_version: 'community.sync.conflict.field.os_version',
  last_sync_at: 'community.sync.conflict.field.last_sync_at',
  sync_status: 'community.sync.conflict.field.sync_status',
  is_deleted: 'community.sync.conflict.field.is_deleted',
  deleted_at: 'community.sync.conflict.field.deleted_at',
  tags: 'community.sync.conflict.field.tags',
  categories: 'community.sync.conflict.field.categories',
  priority: 'community.sync.conflict.field.priority',
  due_date: 'community.sync.conflict.field.due_date',
  completed_at: 'community.sync.conflict.field.completed_at',
  reminder_at: 'community.sync.conflict.field.reminder_at',
  recurrence: 'community.sync.conflict.field.recurrence',
  parent_task_id: 'community.sync.conflict.field.parent_task_id',
  assigned_to: 'community.sync.conflict.field.assigned_to',
  created_by: 'community.sync.conflict.field.created_by',
  modified_by: 'community.sync.conflict.field.modified_by',
};

// Get localized field name with fallback to original field name
function getFieldDisplayName(fieldName: string): string {
  const translationKey = FIELD_TRANSLATION_KEYS[fieldName];
  if (translationKey) {
    return translate(translationKey);
  }
  return fieldName;
}

type ConflictFieldCardProps = {
  field: string;
  localValue: unknown;
  remoteValue: unknown;
};

function ConflictFieldCard({
  field,
  localValue,
  remoteValue,
}: ConflictFieldCardProps): React.ReactElement {
  const { t } = useTranslation();
  return (
    <View className="mt-3 rounded-xl border border-neutral-200 bg-white p-4 dark:border-charcoal-800 dark:bg-charcoal-900">
      {/* Field Name */}
      <Text className="mb-3 text-base font-semibold text-neutral-900 dark:text-neutral-100">
        {getFieldDisplayName(field)}
      </Text>

      {/* Your Version */}
      <View className="mb-3">
        <View className="mb-2 flex-row items-center justify-between">
          <Text
            className="text-xs font-medium uppercase text-primary-600 dark:text-primary-400"
            tx="community.sync.conflict.yourVersion"
          />
          <View className="rounded-full bg-primary-100 px-2 py-0.5 dark:bg-primary-900/30">
            <Text
              className="text-xs font-medium text-primary-700 dark:text-primary-300"
              tx="community.sync.conflict.thisDeviceLabel"
            />
          </View>
        </View>
        <View className="min-h-[48px] rounded-lg border border-primary-200 bg-primary-50 p-3 dark:border-primary-800 dark:bg-primary-900/20">
          <Text className="font-mono text-sm text-neutral-800 dark:text-neutral-200">
            {formatValue(localValue, t)}
          </Text>
        </View>
      </View>

      {/* Server Version */}
      <View>
        <View className="mb-2 flex-row items-center justify-between">
          <Text
            className="text-xs font-medium uppercase text-success-600 dark:text-success-400"
            tx="community.sync.conflict.serverVersion"
          />
          <View className="rounded-full bg-success-100 px-2 py-0.5 dark:bg-success-900/30">
            <Text
              className="text-xs font-medium text-success-700 dark:text-success-300"
              tx="community.sync.conflict.otherDeviceLabel"
            />
          </View>
        </View>
        <View className="min-h-[48px] rounded-lg border border-success-200 bg-success-50 p-3 dark:border-success-800 dark:bg-success-900/20">
          <Text className="font-mono text-sm text-neutral-800 dark:text-neutral-200">
            {formatValue(remoteValue, t)}
          </Text>
        </View>
      </View>
    </View>
  );
}

// Exported for testing
export { ConflictFieldCard };

function ConflictWarning(): React.ReactElement {
  return (
    <View
      className="rounded-lg border border-warning-200 bg-warning-50 p-4 dark:border-warning-800 dark:bg-warning-900/20"
      accessibilityRole="alert"
    >
      <Text
        className="text-xs text-warning-800 dark:text-warning-200"
        tx="community.sync.conflict.warning"
      />
    </View>
  );
}

type ConflictActionsProps = {
  onResolve: (strategy: 'keep-local' | 'accept-server') => void;
  onDismiss: () => void;
};

function ConflictActions({
  onResolve,
  onDismiss,
}: ConflictActionsProps): React.ReactElement {
  return (
    <View className="border-t border-neutral-200 bg-white p-4 dark:border-charcoal-800 dark:bg-charcoal-900">
      <View className="mb-3 flex-row gap-3">
        <View className="flex-1">
          <Button
            variant="outline"
            onPress={() => onResolve('keep-local')}
            testID="keep-local-button"
            className="min-h-[48px]"
          >
            <View className="items-center">
              <Text
                className="text-sm font-semibold text-primary-700 dark:text-primary-300"
                tx="community.sync.conflict.keepLocalButton"
              />
              <Text
                className="text-xs text-neutral-600 dark:text-neutral-400"
                tx="community.sync.conflict.localLabel"
              />
            </View>
          </Button>
        </View>
        <View className="flex-1">
          <Button
            onPress={() => onResolve('accept-server')}
            testID="accept-server-button"
            className="min-h-[48px]"
          >
            <View className="items-center">
              <Text
                className="text-sm font-semibold text-white"
                tx="community.sync.conflict.useServerButton"
              />
              <Text
                className="text-xs text-white/80"
                tx="community.sync.conflict.remoteLabel"
              />
            </View>
          </Button>
        </View>
      </View>
      <Button
        variant="ghost"
        onPress={onDismiss}
        testID="dismiss-conflict-button"
        className="min-h-[44px]"
      >
        <Text tx="community.sync.conflict.dismissButton" />
      </Button>
    </View>
  );
}

type EnhancedConflictResolutionModalProps = {
  conflict: Conflict;
  onResolve: (strategy: 'keep-local' | 'accept-server') => void;
  onDismiss: () => void;
};

export function EnhancedConflictResolutionModal({
  conflict,
  onResolve,
  onDismiss,
}: EnhancedConflictResolutionModalProps): React.ReactElement {
  return (
    <View className="flex-1 bg-neutral-50 dark:bg-charcoal-950">
      <ConflictHeader tableName={conflict.tableName} />

      <ScrollView className="flex-1 p-4">
        <ConflictExplanation />

        {/* Conflict Fields */}
        <View className="mb-4">
          <Text
            className="mb-3 text-sm font-medium uppercase text-neutral-500 dark:text-neutral-400"
            tx="community.sync.conflict.conflictingFields"
            txOptions={{ count: conflict.conflictFields.length }}
          />

          {conflict.conflictFields.map((field) => (
            <ConflictFieldCard
              key={field}
              field={field}
              localValue={conflict.localRecord?.[field]}
              remoteValue={conflict.remoteRecord?.[field]}
            />
          ))}
        </View>

        <ConflictWarning />
      </ScrollView>

      <ConflictActions onResolve={onResolve} onDismiss={onDismiss} />
    </View>
  );
}
