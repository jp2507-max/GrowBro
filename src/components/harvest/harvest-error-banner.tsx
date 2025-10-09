/**
 * Persistent error banner component for harvest workflow
 * Requirement 17.3: Persistent error banners with "Retry now" and "View details" actions
 */

import * as React from 'react';
import { useTranslation } from 'react-i18next';

import type { ErrorAction } from '@/lib/harvest/harvest-error-types';

import { Text, View } from '../ui';
import { Button } from '../ui/button';
import { HarvestErrorActionButton } from './harvest-error-action-button';

type Props = {
  message: string;
  actions?: ErrorAction[];
  onDismiss?: () => void;
  variant?: 'error' | 'warning' | 'info';
  testID?: string;
};

/**
 * Persistent error banner with action buttons
 * Shows critical errors that require user attention
 */
export function HarvestErrorBanner({
  message,
  actions = [],
  onDismiss,
  variant = 'error',
  testID = 'harvest-error-banner',
}: Props) {
  const { t } = useTranslation();

  const containerClasses = useBannerContainerClasses(variant);
  const textClasses = useBannerTextClasses(variant);

  return (
    <View className={containerClasses} testID={testID}>
      {/* Icon */}
      <View className="pt-0.5">
        <Text className={`text-lg ${textClasses}`}>
          {variant === 'error' ? '⚠️' : variant === 'warning' ? '⚠' : 'ℹ️'}
        </Text>
      </View>

      {/* Content */}
      <View className="flex-1 gap-3">
        <Text className={`text-sm ${textClasses}`}>{message}</Text>

        {/* Action Buttons */}
        {actions.length > 0 && (
          <View className="flex-row flex-wrap gap-2">
            {actions.map((actionItem, index) => (
              <HarvestErrorActionButton
                key={index}
                action={actionItem}
                variant={variant}
                testID={`${testID}-action-${actionItem.action}`}
              />
            ))}
          </View>
        )}

        {/* Dismiss Button */}
        {onDismiss && (
          <Button
            variant="ghost"
            size="sm"
            onPress={onDismiss}
            testID={`${testID}-dismiss`}
            className="self-start"
          >
            <Text className={textClasses}>
              {t('harvest.errors.actions.dismiss')}
            </Text>
          </Button>
        )}
      </View>
    </View>
  );
}

function useBannerContainerClasses(variant: Props['variant']) {
  return React.useMemo(() => {
    const base = 'flex-row items-start gap-3 rounded-lg border p-4';

    switch (variant) {
      case 'error':
        return `${base} border-danger-300 bg-danger-50 dark:border-danger-800 dark:bg-danger-950/30`;
      case 'warning':
        return `${base} border-warning-300 bg-warning-50 dark:border-warning-800 dark:bg-warning-950/30`;
      case 'info':
        return `${base} border-primary-300 bg-primary-50 dark:border-primary-800 dark:bg-primary-950/30`;
      default:
        return `${base} border-neutral-300 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950`;
    }
  }, [variant]);
}

function useBannerTextClasses(variant: Props['variant']) {
  return React.useMemo(() => {
    switch (variant) {
      case 'error':
        return 'text-danger-700 dark:text-danger-300';
      case 'warning':
        return 'text-warning-700 dark:text-warning-300';
      case 'info':
        return 'text-primary-700 dark:text-primary-300';
      default:
        return 'text-neutral-700 dark:text-neutral-300';
    }
  }, [variant]);
}
