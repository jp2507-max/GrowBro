/**
 * Age Verification Prompt Component
 *
 * Displays a prompt for users to verify their age when accessing age-restricted content
 * Implements DSA Art. 28 age verification flow integration
 *
 * Requirements:
 * - 8.3: Redirect unverified users to age verification flow
 * - 8.5: Implement safer defaults for minors
 */

import { useRouter } from 'expo-router';
import React from 'react';

import { Button, Text, View } from '@/components/ui';
import { translate } from '@/lib/i18n';

interface AgeVerificationPromptProps {
  visible: boolean;
  onDismiss?: () => void;
  contentType?: 'post' | 'comment' | 'feed';
}

export function AgeVerificationPrompt({
  visible,
  onDismiss,
  contentType = 'feed',
}: AgeVerificationPromptProps): React.ReactElement | null {
  const router = useRouter();

  const handleVerify = React.useCallback(() => {
    // Navigate to age verification flow
    router.push('/age-gate');
  }, [router]);

  if (!visible) {
    return null;
  }

  // Map content type to translation keys
  const titleKey =
    contentType === 'feed'
      ? 'community.age_verification.feed_title'
      : 'community.age_verification.post_title';
  const messageKey =
    contentType === 'feed'
      ? 'community.age_verification.feed_message'
      : 'community.age_verification.post_message';

  return (
    <View
      className="m-4 rounded-xl border border-warning-300 bg-warning-50 p-4 dark:border-warning-700 dark:bg-warning-950"
      testID="age-verification-prompt"
    >
      <View className="mb-3">
        <Text className="mb-2 text-lg font-semibold text-warning-900 dark:text-warning-100">
          {translate(titleKey)}
        </Text>
        <Text className="text-sm text-warning-800 dark:text-warning-200">
          {translate(messageKey)}
        </Text>
      </View>

      <View className="flex-row gap-2">
        <Button
          label={translate('community.age_verification.verify_button')}
          onPress={handleVerify}
          variant="default"
          className="flex-1"
          testID="age-verification-verify-button"
        />
        {onDismiss && (
          <Button
            label={translate('common.dismiss')}
            onPress={onDismiss}
            variant="outline"
            className="flex-1"
            testID="age-verification-dismiss-button"
          />
        )}
      </View>
    </View>
  );
}
