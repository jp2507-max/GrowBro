/**
 * Form Header Component
 *
 * Title for the pH/EC input form
 */

import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/ui';

export function FormHeader(): JSX.Element {
  const { t } = useTranslation();

  return (
    <Text className="mb-4 text-xl font-semibold text-neutral-900 dark:text-neutral-100">
      {t('nutrient.logMeasurement')}
    </Text>
  );
}
