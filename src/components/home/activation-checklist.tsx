import { useRouter } from 'expo-router';
import React from 'react';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { Pressable, Text, View } from '@/components/ui';
import { useAnalytics } from '@/lib';
import { NoopAnalytics } from '@/lib/analytics';
import { createStaggeredFadeIn, onboardingMotion } from '@/lib/animations';
import type { ActivationAction } from '@/lib/compliance/activation-state';
import {
  dismissActivationChecklist,
  getActivationCompletedCount,
  useActivationStore,
} from '@/lib/compliance/activation-state';
import { translate } from '@/lib/i18n';
import type { TxKeyPath } from '@/lib/i18n/utils';
import { consentManager } from '@/lib/privacy/consent-manager';

type ActionConfig = {
  action: ActivationAction;
  icon: string;
  route: string;
};

const ACTION_CONFIGS: ActionConfig[] = [
  {
    action: 'create-task',
    icon: '✓',
    route: '/calendar',
  },
  {
    action: 'open-playbook',
    icon: '📖',
    route: '/playbooks',
  },
  {
    action: 'try-ai-diagnosis',
    icon: '🔍',
    route: '/assessment/capture', // Fixed: points to actual capture screen instead of non-existent index
  },
  {
    action: 'explore-strains',
    icon: '🌿',
    route: '/strains',
  },
];

type ActionItemProps = {
  config: ActionConfig;
  index: number;
  completed: boolean;
  onPress: (action: ActivationAction) => void;
};

function ActionItem({
  config,
  index,
  completed,
  onPress,
}: ActionItemProps): React.ReactElement {
  const titleKey =
    `home.activation.action_${config.action.replace(/-/g, '_')}` as TxKeyPath;
  const descKey = `${titleKey}_desc` as TxKeyPath;

  const handlePress = React.useCallback(() => {
    onPress(config.action);
  }, [config.action, onPress]);

  return (
    <Animated.View
      entering={createStaggeredFadeIn(index, onboardingMotion.stagger.list)}
    >
      <Pressable
        className={`flex-row items-center rounded-xl border p-3 ${
          completed
            ? 'border-success-200 bg-success-50 dark:border-success-700 dark:bg-success-900/40'
            : 'border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-800'
        }`}
        accessibilityRole="button"
        accessibilityLabel={translate(titleKey)}
        accessibilityHint={translate(
          'accessibility.home.activation_action_hint',
          {
            action: translate(titleKey).toLowerCase(),
          }
        )}
        accessibilityState={{ disabled: completed }}
        onPress={handlePress}
        disabled={completed}
        testID={`activation-action-${config.action}`}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <View
          className={`mr-3 size-10 items-center justify-center rounded-full ${
            completed
              ? 'bg-success-100 dark:bg-success-800'
              : 'bg-primary-100 dark:bg-primary-800'
          }`}
        >
          <Text className="text-xl">{completed ? '✓' : config.icon}</Text>
        </View>
        <View className="flex-1">
          <Text
            className={`text-sm font-semibold ${
              completed
                ? 'text-success-900 dark:text-success-200'
                : 'text-neutral-900 dark:text-neutral-100'
            }`}
          >
            {translate(titleKey)}
          </Text>
          <Text
            className={`mt-0.5 text-xs ${
              completed
                ? 'text-success-700 dark:text-success-300'
                : 'text-neutral-600 dark:text-neutral-400'
            }`}
          >
            {translate(descKey)}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

type ActivationChecklistProps = {
  className?: string;
  onActionComplete?: (action: ActivationAction) => void;
};

export function ActivationChecklist({
  className,
  onActionComplete,
}: ActivationChecklistProps): React.ReactElement | null {
  const router = useRouter();

  const actions = useActivationStore((state) => state.actions);

  const shouldShow = useActivationStore((state) => state.shouldShowChecklist());
  const completedCount = getActivationCompletedCount();

  const handleActionPress = React.useCallback(
    (action: ActivationAction) => {
      const config = ACTION_CONFIGS.find((c) => c.action === action);
      if (!config) return;

      // Navigate to the action's route
      router.push(config.route);

      // Notify parent if callback provided
      onActionComplete?.(action);
    },
    [router, onActionComplete]
  );

  const analytics = useAnalytics();

  const handleDismiss = React.useCallback(() => {
    dismissActivationChecklist();

    // Track telemetry if consented
    const hasConsented = consentManager.hasConsented('analytics');
    if (hasConsented && analytics !== NoopAnalytics) {
      void analytics.track('activation_checklist_dismissed', {
        completed_count: completedCount,
        screen: 'home',
      });
    }
  }, [completedCount, analytics]);

  if (!shouldShow) {
    return null;
  }

  const totalActions = ACTION_CONFIGS.length;

  return (
    <Animated.View
      entering={FadeIn.duration(onboardingMotion.durations.standard)}
      exiting={FadeOut.duration(onboardingMotion.durations.quick)}
      className={className}
      testID="activation-checklist"
    >
      <View className="gap-3 rounded-2xl border border-primary-200 bg-primary-50 p-4 dark:border-primary-700 dark:bg-primary-900/40">
        {/* Header */}
        <Animated.View
          entering={createStaggeredFadeIn(0, onboardingMotion.stagger.header)}
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-1">
              <Text className="text-base font-semibold text-primary-900 dark:text-primary-200">
                {translate('home.activation.title')}
              </Text>
              <Text className="mt-0.5 text-xs text-primary-700 dark:text-primary-300">
                {translate('home.activation.progress', {
                  completed: completedCount,
                  total: totalActions,
                })}
              </Text>
            </View>
            <Pressable
              className="ml-2 rounded-lg px-3 py-1.5"
              accessibilityRole="button"
              accessibilityLabel={translate('home.activation.dismiss')}
              accessibilityHint={translate(
                'accessibility.home.activation_dismiss_hint'
              )}
              onPress={handleDismiss}
              testID="activation-dismiss"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text className="text-xs font-medium text-primary-700 dark:text-primary-300">
                {translate('home.activation.dismiss')}
              </Text>
            </Pressable>
          </View>
        </Animated.View>

        {/* Action Items */}
        <View className="gap-2">
          {ACTION_CONFIGS.map((config, index) => (
            <ActionItem
              key={config.action}
              config={config}
              index={index + 1}
              completed={actions[config.action]?.completed ?? false}
              onPress={handleActionPress}
            />
          ))}
        </View>
      </View>
    </Animated.View>
  );
}
