/**
 * Enhanced Conflict Resolution Modal
 *
 * Shows server vs local diff comparison with one-tap restore
 * Improved UI with better visual hierarchy and accessibility
 *
 * Requirements: 6.4, 6.5, UI/UX implementation
 */

import React from 'react';
import { ScrollView } from 'react-native';

import { Button, Text, View } from '@/components/ui';
import { translate } from '@/lib/i18n';
import type { Conflict } from '@/lib/sync/conflict-resolver';

// Map database field names to user-friendly display names
const displayNameMap: Record<string, string> = {
  name: 'Name',
  description: 'Description',
  created_at: 'Created Date',
  updated_at: 'Last Updated',
  strain_id: 'Strain',
  plant_id: 'Plant',
  status: 'Status',
  notes: 'Notes',
  phase: 'Growth Phase',
  start_date: 'Start Date',
  end_date: 'End Date',
  pH: 'pH Level',
  ec: 'EC Level',
  temperature: 'Temperature',
  humidity: 'Humidity',
  light_schedule: 'Light Schedule',
  watering_schedule: 'Watering Schedule',
  feeding_schedule: 'Feeding Schedule',
  pruning_schedule: 'Pruning Schedule',
  training_schedule: 'Training Schedule',
  monitoring_schedule: 'Monitoring Schedule',
  harvest_date: 'Harvest Date',
  drying_start: 'Drying Start',
  curing_start: 'Curing Start',
  thc_content: 'THC Content',
  cbd_content: 'CBD Content',
  yield_estimate: 'Yield Estimate',
  difficulty: 'Difficulty Level',
  indoor_outdoor: 'Grow Environment',
  auto_photo: 'Flowering Type',
  genetics: 'Genetics',
  effects: 'Effects',
  flavors: 'Flavors',
  terpenes: 'Terpenes',
  height: 'Height',
  flowering_time: 'Flowering Time',
  user_id: 'User',
  email: 'Email',
  username: 'Username',
  avatar_url: 'Avatar',
  preferences: 'Preferences',
  settings: 'Settings',
  notifications_enabled: 'Notifications',
  theme: 'Theme',
  language: 'Language',
  timezone: 'Timezone',
  location: 'Location',
  device_id: 'Device',
  app_version: 'App Version',
  os_version: 'OS Version',
  last_sync_at: 'Last Sync',
  sync_status: 'Sync Status',
  is_deleted: 'Deleted',
  deleted_at: 'Deleted Date',
  tags: 'Tags',
  categories: 'Categories',
  priority: 'Priority',
  due_date: 'Due Date',
  completed_at: 'Completed Date',
  reminder_at: 'Reminder Date',
  recurrence: 'Recurrence',
  parent_task_id: 'Parent Task',
  assigned_to: 'Assigned To',
  created_by: 'Created By',
  modified_by: 'Modified By',
};

export function formatValue(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (value instanceof Date) return value.toLocaleString();
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
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
        tx="sync.conflict.title"
      />
      <Text
        className="mt-1 text-sm text-neutral-600 dark:text-neutral-400"
        tx="sync.conflict.description"
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
        tx="sync.conflict.explanation"
      />
    </View>
  );
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
  // Get localized field name with fallback to displayNameMap or original field
  const getFieldDisplayName = (fieldName: string): string => {
    const translationKey = `sync.conflict.field.${fieldName}` as const;
    const translated = translate(translationKey);
    // If translation returns the key itself, it means the key wasn't found
    if (translated === translationKey) {
      return displayNameMap[fieldName] || fieldName;
    }
    return translated;
  };

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
            tx="sync.conflict.yourVersion"
          />
          <View className="rounded-full bg-primary-100 px-2 py-0.5 dark:bg-primary-900/30">
            <Text
              className="text-xs font-medium text-primary-700 dark:text-primary-300"
              tx="sync.conflict.thisDeviceLabel"
            />
          </View>
        </View>
        <View className="min-h-[48px] rounded-lg border border-primary-200 bg-primary-50 p-3 dark:border-primary-800 dark:bg-primary-900/20">
          <Text className="font-mono text-sm text-neutral-800 dark:text-neutral-200">
            {formatValue(localValue)}
          </Text>
        </View>
      </View>

      {/* Server Version */}
      <View>
        <View className="mb-2 flex-row items-center justify-between">
          <Text
            className="text-xs font-medium uppercase text-success-600 dark:text-success-400"
            tx="sync.conflict.serverVersion"
          />
          <View className="rounded-full bg-success-100 px-2 py-0.5 dark:bg-success-900/30">
            <Text
              className="text-xs font-medium text-success-700 dark:text-success-300"
              tx="sync.conflict.otherDeviceLabel"
            />
          </View>
        </View>
        <View className="min-h-[48px] rounded-lg border border-success-200 bg-success-50 p-3 dark:border-success-800 dark:bg-success-900/20">
          <Text className="font-mono text-sm text-neutral-800 dark:text-neutral-200">
            {formatValue(remoteValue)}
          </Text>
        </View>
      </View>
    </View>
  );
}

function ConflictWarning(): React.ReactElement {
  return (
    <View
      className="rounded-lg border border-warning-200 bg-warning-50 p-4 dark:border-warning-800 dark:bg-warning-900/20"
      accessibilityRole="alert"
    >
      <Text
        className="text-xs text-warning-800 dark:text-warning-200"
        tx="sync.conflict.warning"
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
                tx="sync.conflict.keepLocalButton"
              />
              <Text
                className="text-xs text-neutral-600 dark:text-neutral-400"
                tx="sync.conflict.localLabel"
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
                tx="sync.conflict.useServerButton"
              />
              <Text
                className="text-xs text-white/80"
                tx="sync.conflict.remoteLabel"
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
        <Text tx="sync.conflict.dismissButton" />
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
            tx="sync.conflict.conflictingFields"
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
