import React from 'react';

import { Text, View } from '@/components/ui';
import type { AppealStatus } from '@/types/moderation';

// Map an AppealStatus value to Tailwind class names used for the status badge.
function getStatusColor(status: AppealStatus): string {
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
}

export function AppealStatusBadge({
  status,
  label,
  testID,
}: {
  status: AppealStatus;
  label: string;
  testID?: string;
}) {
  return (
    <View className="mb-6">
      <View
        className={`self-start rounded-full px-4 py-2 ${getStatusColor(status)}`}
        testID={testID}
      >
        <Text className="text-sm font-medium">{label}</Text>
      </View>
    </View>
  );
}

export default AppealStatusBadge;
