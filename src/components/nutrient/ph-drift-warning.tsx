import React from 'react';
import { useTranslation } from 'react-i18next';

import { Button, Text, View } from '@/components/ui';
import {
  PH_DRIFT_THRESHOLD_HIGH,
  PH_DRIFT_THRESHOLD_MIN,
} from '@/lib/nutrient-engine/utils/ph-drift-evaluation';

type Props = {
  alkalinityMgPerL: number;
  onLearnMore?: () => void;
  testID?: string;
};

function MitigationList({ isHighRisk }: { isHighRisk: boolean }) {
  const { t } = useTranslation();
  if (isHighRisk) {
    return (
      <View className="mt-1 gap-1">
        <Text className="text-xs text-warning-800">
          • {t('nutrient.phDrift.mitigation.roBlend')}
        </Text>
        <Text className="text-xs text-warning-800">
          • {t('nutrient.phDrift.mitigation.sulfuricAcid')}
        </Text>
        <Text className="text-xs text-warning-800">
          • {t('nutrient.phDrift.mitigation.acidInjection')}
        </Text>
        <Text className="text-xs text-warning-800">
          • {t('nutrient.phDrift.mitigation.monitorPh')}
        </Text>
      </View>
    );
  }

  return (
    <View className="mt-1 gap-1">
      <Text className="text-xs text-warning-800">
        • {t('nutrient.phDrift.mitigation.monitorPhFrequently')}
      </Text>
      <Text className="text-xs text-warning-800">
        • {t('nutrient.phDrift.mitigation.phBuffer')}
      </Text>
      <Text className="text-xs text-warning-800">
        • {t('nutrient.phDrift.mitigation.adjustGradually')}
      </Text>
    </View>
  );
}

export function PhDriftWarning({
  alkalinityMgPerL,
  onLearnMore,
  testID,
}: Props): React.ReactElement | null {
  const { t } = useTranslation();

  if (alkalinityMgPerL < PH_DRIFT_THRESHOLD_MIN) {
    return null;
  }

  const isHighRisk = alkalinityMgPerL >= PH_DRIFT_THRESHOLD_HIGH;

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
        ⚠️{' '}
        {t(
          isHighRisk
            ? 'nutrient.phDrift.highRisk.title'
            : 'nutrient.phDrift.moderateRisk.title'
        )}
      </Text>

      <Text className="mt-2 text-sm text-warning-800">
        {t('nutrient.phDrift.waterAlkalinity', { value: alkalinityMgPerL })}
      </Text>

      <Text className="mt-2 text-sm text-warning-800">
        {t(
          isHighRisk
            ? 'nutrient.phDrift.highRisk.message'
            : 'nutrient.phDrift.moderateRisk.message'
        )}
      </Text>

      <View className="mt-3">
        <Text className="text-sm font-medium text-warning-900">
          {t('nutrient.phDrift.mitigation.heading')}
        </Text>
        <MitigationList isHighRisk={isHighRisk} />
      </View>

      <View className="mt-3 rounded bg-warning-100 p-2">
        <Text className="text-xs text-warning-900">
          {t('nutrient.phDrift.disclaimer')}
        </Text>
      </View>

      {onLearnMore && (
        <Button
          variant="ghost"
          label={t('nutrient.phDrift.learnMore')}
          onPress={onLearnMore}
          testID="learn-more-button"
        />
      )}
    </View>
  );
}
