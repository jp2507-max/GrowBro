/**
 * Legal Update Banner
 * Shows when minor/patch legal document version bumps are detected
 * Requirements: 8.4, 8.7
 */

import { useRouter } from 'expo-router';
import React, { useState } from 'react';

import { Pressable, Text, View } from '@/components/ui';
import { AlertCircle, X } from '@/components/ui/icons';
import { translate } from '@/lib';
import type { LegalDocumentType } from '@/types/settings';

interface LegalUpdateBannerProps {
  documents: LegalDocumentType[];
  onDismiss?: () => void;
}

/**
 * Banner component to inform users about non-blocking legal document updates
 * Shows for minor/patch version bumps that don't require immediate re-acceptance
 */
export function LegalUpdateBanner({
  documents,
  onDismiss,
}: LegalUpdateBannerProps) {
  const router = useRouter();
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed || documents.length === 0) {
    return null;
  }

  const handlePress = () => {
    router.push('/settings/legal');
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    onDismiss?.();
  };

  return (
    <View className="border-b border-warning-200 bg-warning-50 dark:border-warning-800 dark:bg-warning-900/30">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={translate('settings.legal.update_banner.label')}
        accessibilityHint={translate('settings.legal.update_banner.hint')}
        onPress={handlePress}
        className="flex-row items-center px-4 py-3"
      >
        <View className="mr-3">
          <AlertCircle
            size={20}
            className="text-warning-600 dark:text-warning-400"
          />
        </View>

        <View className="flex-1">
          <Text className="text-sm font-medium text-warning-900 dark:text-warning-100">
            {translate('settings.legal.update_banner.title')}
          </Text>
          <Text className="mt-0.5 text-xs text-warning-700 dark:text-warning-300">
            {translate('settings.legal.update_banner.description', {
              count: documents.length,
            })}
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={translate('common.dismiss')}
          onPress={handleDismiss}
          className="ml-2 p-2"
        >
          <X size={18} className="text-warning-600 dark:text-warning-400" />
        </Pressable>
      </Pressable>
    </View>
  );
}
