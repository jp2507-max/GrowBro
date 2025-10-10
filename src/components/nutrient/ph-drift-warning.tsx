import React from 'react';

import { Button, Text, View } from '@/components/ui';

type Props = {
  alkalinityMgPerL: number;
  onLearnMore?: () => void;
  testID?: string;
};

function MitigationList({ isHighRisk }: { isHighRisk: boolean }) {
  if (isHighRisk) {
    return (
      <View className="mt-1 gap-1">
        <Text className="text-xs text-warning-800">
          • Consider RO water blending
        </Text>
        <Text className="text-xs text-warning-800">
          • Use sulfuric acid for pH down
        </Text>
        <Text className="text-xs text-warning-800">
          • Consider acid injection system
        </Text>
        <Text className="text-xs text-warning-800">• Monitor pH daily</Text>
      </View>
    );
  }

  return (
    <View className="mt-1 gap-1">
      <Text className="text-xs text-warning-800">• Monitor pH frequently</Text>
      <Text className="text-xs text-warning-800">
        • Use pH buffer solutions
      </Text>
      <Text className="text-xs text-warning-800">
        • Adjust gradually to avoid shock
      </Text>
    </View>
  );
}

export function PhDriftWarning({
  alkalinityMgPerL,
  onLearnMore,
  testID,
}: Props): React.ReactElement | null {
  if (alkalinityMgPerL < 120) {
    return null;
  }

  const isHighRisk = alkalinityMgPerL >= 150;

  return (
    <View
      className={`rounded-lg border p-4 ${
        isHighRisk
          ? 'border-warning-300 bg-warning-50'
          : 'bg-warning-25 border-warning-200'
      }`}
      testID={testID}
    >
      <Text className="text-base font-semibold text-warning-900">
        ⚠️ {isHighRisk ? 'High pH Drift Risk' : 'Moderate pH Drift Risk'}
      </Text>

      <Text className="mt-2 text-sm text-warning-800">
        Water alkalinity: {alkalinityMgPerL} mg/L
      </Text>

      <Text className="mt-2 text-sm text-warning-800">
        {isHighRisk
          ? 'Your water has high buffering capacity. Expect significant upward pH drift over time.'
          : 'Your water has moderate buffering capacity. Monitor pH regularly to catch drift early.'}
      </Text>

      <View className="mt-3">
        <Text className="text-sm font-medium text-warning-900">
          Mitigation Strategies
        </Text>
        <MitigationList isHighRisk={isHighRisk} />
      </View>

      <View className="mt-3 rounded bg-warning-100 p-2">
        <Text className="text-xs text-warning-900">
          Educational guidance only • Not professional advice
        </Text>
      </View>

      {onLearnMore && (
        <Button
          variant="ghost"
          label="Learn More"
          onPress={onLearnMore}
          testID="learn-more-button"
        />
      )}
    </View>
  );
}
