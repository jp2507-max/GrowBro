/**
 * Notes Input Component
 *
 * Multiline notes field for pH/EC readings
 */

import * as React from 'react';
import type { Control } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { ControlledInput } from '@/components/ui';
import type { PhEcReadingFormData } from '@/lib/nutrient-engine/schemas/ph-ec-reading-schema';

type NotesInputProps = {
  control: Control<PhEcReadingFormData>;
  testID: string;
};

export function NotesInput({ control, testID }: NotesInputProps): JSX.Element {
  const { t } = useTranslation();

  return (
    <ControlledInput
      control={control}
      name="note"
      label={t('nutrient.notes')}
      multiline
      numberOfLines={3}
      placeholder={t('nutrient.notesPlaceholder')}
      testID={`${testID}-note`}
    />
  );
}
