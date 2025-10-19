/**
 * RestrictedProfileMessage component
 *
 * Displays message for private or restricted user profiles
 */

import React from 'react';

import { Button, Text, View } from '@/components/ui';
import { translate } from '@/lib/i18n';

interface RestrictedProfileMessageProps {
  reason?: 'private' | 'blocked' | 'deleted' | 'not_found';
  onBack?: () => void;
  testID?: string;
}

export function RestrictedProfileMessage({
  reason = 'not_found',
  onBack,
  testID = 'restricted-profile-message',
}: RestrictedProfileMessageProps): React.ReactElement {
  const getMessage = () => {
    switch (reason) {
      case 'private':
        return translate('profile.restricted.private');
      case 'blocked':
        return translate('profile.restricted.blocked');
      case 'deleted':
        return translate('profile.restricted.deleted');
      case 'not_found':
      default:
        return translate('profile.restricted.not_found');
    }
  };

  return (
    <View className="flex-1 items-center justify-center p-8" testID={testID}>
      <Text className="mb-2 text-6xl">🔒</Text>
      <Text className="mb-6 text-center text-lg font-semibold text-neutral-900 dark:text-neutral-100">
        {translate('profile.restricted.title')}
      </Text>
      <Text className="mb-8 text-center text-base text-neutral-600 dark:text-neutral-400">
        {getMessage()}
      </Text>
      {onBack && (
        <Button
          label={translate('common.go_back')}
          onPress={onBack}
          variant="outline"
          testID={`${testID}-back-button`}
        />
      )}
    </View>
  );
}
