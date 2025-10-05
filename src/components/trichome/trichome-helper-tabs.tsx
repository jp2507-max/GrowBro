import React from 'react';
import { useTranslation } from 'react-i18next';

import { Button, View } from '@/components/ui';

type TrichomeHelperTabsProps = {
  showGuide: boolean;
  onToggleGuide: (showGuide: boolean) => void;
};

export function TrichomeHelperTabs({
  showGuide,
  onToggleGuide,
}: TrichomeHelperTabsProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <View className="mt-4 flex-row gap-2">
      <Button
        variant={showGuide ? 'default' : 'outline'}
        size="sm"
        onPress={() => onToggleGuide(true)}
        label={t('trichome.helper.guideTab')}
        className="flex-1"
        testID="show-guide-tab"
        accessibilityLabel={t('trichome.helper.guideTab')}
        accessibilityHint={t('trichome.helper.accessibilityGuide')}
      />
      <Button
        variant={!showGuide ? 'default' : 'outline'}
        size="sm"
        onPress={() => onToggleGuide(false)}
        label={t('trichome.helper.assessmentTab')}
        className="flex-1"
        testID="show-assessment-tab"
        accessibilityLabel={t('trichome.helper.assessmentTab')}
        accessibilityHint={t('trichome.helper.accessibilityForm')}
      />
    </View>
  );
}
