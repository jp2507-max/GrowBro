/**
 * Strain Tip Badge Component
 *
 * Displays educational strain-specific tips within task descriptions.
 * All tips are non-commercial and compliant with app store policies.
 */

import React from 'react';

import { Text, View } from '@/components/ui';
import { translate } from '@/lib';

interface StrainTipBadgeProps {
  tip: string;
  testID?: string;
}

export function StrainTipBadge({
  tip,
  testID = 'strain-tip-badge',
}: StrainTipBadgeProps): React.ReactElement {
  return (
    <View
      className="mt-3 rounded-lg border border-primary-200 bg-primary-50 p-3 dark:border-primary-800 dark:bg-primary-950/30"
      accessibilityRole="text"
      accessibilityLabel={`Strain tip: ${tip}`}
      accessibilityHint={translate('strain_tip.accessibility_hint')}
      testID={testID}
    >
      <View className="flex-row items-start gap-2">
        <Text className="text-base">💡</Text>
        <View className="flex-1">
          <Text className="mb-1 text-xs font-semibold uppercase tracking-wide text-primary-700 dark:text-primary-300">
            {translate('strain_tip.label')}
          </Text>
          <Text className="text-sm leading-relaxed text-neutral-800 dark:text-neutral-200">
            {tip}
          </Text>
        </View>
      </View>
    </View>
  );
}

/**
 * Extract strain tip from task description if present
 */
export function extractStrainTip(description: string): {
  mainDescription: string;
  strainTip: string | null;
} {
  const tipMarker = '💡 Strain Tip:';
  const tipIndex = description.indexOf(tipMarker);

  if (tipIndex === -1) {
    return {
      mainDescription: description,
      strainTip: null,
    };
  }

  const mainDescription = description.substring(0, tipIndex).trim();
  const strainTip = description.substring(tipIndex + tipMarker.length).trim();

  return {
    mainDescription,
    strainTip,
  };
}
