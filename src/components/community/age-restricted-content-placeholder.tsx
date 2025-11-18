/**
 * Age-Restricted Content Placeholder Component
 *
 * Displays a placeholder for age-restricted content that unverified users cannot access
 * Implements DSA Art. 28 safer defaults for minors
 *
 * Requirements:
 * - 8.2: Restrict visibility to verified 18+ users
 * - 8.5: Implement safer defaults for minors
 */

import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet } from 'react-native';

import { Button, Text, View } from '@/components/ui';
import { translate } from '@/lib/i18n';

interface AgeRestrictedContentPlaceholderProps {
  contentType?: 'post' | 'comment' | 'image';
  onVerifyPress?: () => void;
  showVerifyButton?: boolean;
}

export function AgeRestrictedContentPlaceholder({
  contentType = 'post',
  onVerifyPress,
  showVerifyButton = true,
}: AgeRestrictedContentPlaceholderProps): React.ReactElement {
  const router = useRouter();

  const handleVerifyPress = React.useCallback(() => {
    if (onVerifyPress) {
      onVerifyPress();
    } else {
      router.push('/age-gate');
    }
  }, [onVerifyPress, router]);

  return (
    <View
      className="my-2 rounded-xl border border-neutral-200 bg-neutral-50 p-6 dark:border-neutral-700 dark:bg-neutral-900"
      style={styles.container}
      testID="age-restricted-content-placeholder"
    >
      <View className="mb-4 items-center">
        <View className="mb-3 size-16 items-center justify-center rounded-full bg-neutral-200 dark:bg-neutral-800">
          <Text className="text-3xl">🔒</Text>
        </View>
        <Text className="mb-2 text-center text-base font-semibold text-neutral-900 dark:text-neutral-100">
          {translate('community.age_restricted.title')}
        </Text>
        <Text className="text-center text-sm text-neutral-600 dark:text-neutral-400">
          {translate('community.age_restricted.message', {
            contentType: translate(
              `community.content_type.${contentType}` as
                | 'community.content_type.post'
                | 'community.content_type.comment'
                | 'community.content_type.image'
            ),
          })}
        </Text>
      </View>

      {showVerifyButton && (
        <Button
          label={translate('community.age_restricted.verify_age_button')}
          onPress={handleVerifyPress}
          variant="default"
          size="sm"
          testID="age-restricted-verify-button"
        />
      )}

      <Text className="mt-3 text-center text-xs text-neutral-500 dark:text-neutral-500">
        {translate('community.age_restricted.privacy_notice')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 200,
  },
});
