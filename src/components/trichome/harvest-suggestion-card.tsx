/**
 * Harvest Suggestion Card Component
 *
 * Displays harvest window suggestions with explicit confirmation requirement
 */

import * as React from 'react';
import { View } from 'react-native';

import { Button, Text } from '@/components/ui';
import type { HarvestSuggestion } from '@/lib/trichome';

type Props = {
  suggestion: HarvestSuggestion;
  onAccept: () => void | Promise<void>;
  onDecline: () => void;
  loading?: boolean;
  className?: string;
};

const effectStyles = {
  energetic: {
    bg: 'bg-primary-100 dark:bg-primary-900',
    text: 'text-primary-700 dark:text-primary-300',
  },
  balanced: {
    bg: 'bg-success-100 dark:bg-success-900',
    text: 'text-success-700 dark:text-success-300',
  },
  sedating: {
    bg: 'bg-purple-100 dark:bg-purple-900',
    text: 'text-purple-700 dark:text-purple-300',
  },
};

function ConfirmationNotice() {
  return (
    <View className="mb-4 rounded-md bg-warning-100 p-3 dark:bg-warning-900">
      <Text className="text-xs font-semibold text-warning-700 dark:text-warning-300">
        ⚠ Confirmation Required
      </Text>
      <Text className="mt-1 text-xs text-warning-700 dark:text-warning-300">
        This suggestion will not automatically reschedule your harvest tasks.
        You must explicitly confirm to apply these changes.
      </Text>
    </View>
  );
}

function Disclaimer() {
  return (
    <View className="mb-4 rounded-md bg-neutral-100 p-3 dark:bg-charcoal-800">
      <Text className="text-xs italic text-neutral-600 dark:text-neutral-400">
        ⓘ This is educational guidance based on your trichome assessment. Actual
        harvest timing depends on many factors including strain genetics,
        growing conditions, and personal preference.
      </Text>
    </View>
  );
}

export function HarvestSuggestionCard({
  suggestion,
  onAccept,
  onDecline,
  loading = false,
  className = '',
}: Props) {
  const styles = effectStyles[suggestion.targetEffect];

  return (
    <View
      className={`rounded-lg border border-neutral-200 bg-white p-4 dark:border-charcoal-700 dark:bg-charcoal-900 ${className}`}
      testID="harvest-suggestion-card"
    >
      <View className={`mb-3 self-start rounded-full px-3 py-1 ${styles.bg}`}>
        <Text className={`text-xs font-semibold uppercase ${styles.text}`}>
          {suggestion.targetEffect}
        </Text>
      </View>

      <Text className="mb-2 text-lg font-semibold text-charcoal-950 dark:text-neutral-100">
        Harvest Window: {suggestion.minDays}-{suggestion.maxDays} days
      </Text>

      <Text className="mb-4 text-sm text-neutral-700 dark:text-neutral-300">
        {suggestion.reasoning}
      </Text>

      {suggestion.requiresConfirmation && <ConfirmationNotice />}
      <Disclaimer />

      <View className="flex-row gap-2">
        <View className="flex-1">
          <Button
            label="Accept"
            onPress={onAccept}
            loading={loading}
            disabled={loading}
            variant="default"
            testID="accept-suggestion-button"
          />
        </View>
        <View className="flex-1">
          <Button
            label="Decline"
            onPress={onDecline}
            disabled={loading}
            variant="outline"
            testID="decline-suggestion-button"
          />
        </View>
      </View>
    </View>
  );
}
