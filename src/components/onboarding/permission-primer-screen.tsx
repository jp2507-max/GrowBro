import React from 'react';
import Animated from 'react-native-reanimated';

import { createStaggeredFadeInUp, onboardingMotion } from '@/lib/animations';
import type { TxKeyPath } from '@/lib/i18n';
import { translate } from '@/lib/i18n';

import { Button, Text, View } from '../ui';

type PermissionPrimerScreenProps = {
  icon: React.ReactNode;
  titleTx: TxKeyPath;
  descriptionTx: TxKeyPath;
  benefitsTx: TxKeyPath[];
  onAllow: () => void;
  onNotNow: () => void;
  isLoading?: boolean;
  testID?: string;
};

/**
 * Permission primer screen component
 * Explains the benefit of a permission before requesting it
 *
 * Requirements:
 * - Privacy-First: clear explanation before request
 * - Educational Focus: explains why permission helps
 * - Accessibility: proper labels and touch targets
 * - Offline-First: works without network
 */
export function PermissionPrimerScreen({
  icon,
  titleTx,
  descriptionTx,
  benefitsTx,
  onAllow,
  onNotNow,
  isLoading = false,
  testID = 'permission-primer',
}: PermissionPrimerScreenProps): React.ReactElement {
  return (
    <View className="flex-1 bg-white px-6 dark:bg-charcoal-950" testID={testID}>
      {/* Icon Container */}
      <Animated.View
        entering={createStaggeredFadeInUp(0, onboardingMotion.stagger.header)}
        className="mt-20 items-center"
      >
        {icon}
      </Animated.View>

      {/* Title */}
      <Animated.View
        entering={createStaggeredFadeInUp(1, onboardingMotion.stagger.header)}
        className="mt-8"
      >
        <Text
          tx={titleTx}
          className="text-center text-2xl font-bold text-neutral-900 dark:text-neutral-100"
          accessibilityRole="header"
        />
      </Animated.View>

      {/* Description */}
      <Animated.View
        entering={createStaggeredFadeInUp(2, onboardingMotion.stagger.content)}
        className="mt-4"
      >
        <Text
          tx={descriptionTx}
          className="text-center text-base text-neutral-600 dark:text-neutral-400"
        />
      </Animated.View>

      {/* Benefits List */}
      <View className="mt-8 gap-4">
        {benefitsTx.map((benefitTx, index) => (
          <Animated.View
            key={index}
            entering={createStaggeredFadeInUp(index, {
              baseDelay: 300,
              staggerDelay: 50,
              duration: onboardingMotion.durations.standard,
            })}
            className="flex-row items-start gap-3"
          >
            <View className="mt-1 size-5 items-center justify-center rounded-full bg-primary-600">
              <Text className="text-xs font-bold text-white">✓</Text>
            </View>
            <Text
              tx={benefitTx}
              className="flex-1 text-sm text-neutral-700 dark:text-neutral-300"
            />
          </Animated.View>
        ))}
      </View>

      {/* Action Buttons */}
      <View className="mb-8 mt-auto gap-3">
        <Animated.View
          entering={createStaggeredFadeInUp(0, {
            baseDelay: 450,
            staggerDelay: 50,
            duration: onboardingMotion.durations.emphasized,
          })}
        >
          <Button
            label={translate('onboarding.permissions.allow')}
            onPress={onAllow}
            variant="default"
            size="lg"
            fullWidth
            loading={isLoading}
            disabled={isLoading}
            testID={`${testID}-allow-button`}
            accessibilityLabel={translate('onboarding.permissions.allow')}
            accessibilityHint={translate(
              'onboarding.permissions.allowHint' as TxKeyPath
            )}
          />
        </Animated.View>
        <Animated.View
          entering={createStaggeredFadeInUp(1, {
            baseDelay: 450,
            staggerDelay: 50,
            duration: onboardingMotion.durations.emphasized,
          })}
        >
          <Button
            label={translate('onboarding.permissions.notNow')}
            onPress={onNotNow}
            variant="ghost"
            size="lg"
            fullWidth
            disabled={isLoading}
            testID={`${testID}-not-now-button`}
            accessibilityLabel={translate('onboarding.permissions.notNow')}
            accessibilityHint={translate(
              'onboarding.permissions.notNowHint' as TxKeyPath
            )}
          />
        </Animated.View>
      </View>

      {/* Educational Note */}
      <Animated.View
        entering={createStaggeredFadeInUp(2, {
          baseDelay: 450,
          staggerDelay: 50,
          duration: onboardingMotion.durations.standard,
        })}
        className="mb-6 rounded-lg bg-neutral-100 p-3 dark:bg-neutral-800"
      >
        <Text
          tx={'onboarding.permissions.privacyNote' as TxKeyPath}
          className="text-center text-xs text-neutral-600 dark:text-neutral-400"
        />
      </Animated.View>
    </View>
  );
}
