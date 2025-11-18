/**
 * Jurisdiction Selector Component
 *
 * DSA-compliant jurisdiction selector for illegal content reports (Art. 16)
 * Uses ISO 3166-1 alpha-2 country codes
 *
 * Requirements: 1.2
 */

import React from 'react';
import type { Control, FieldErrors, FieldValues, Path } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import type { OptionType } from '@/components/ui/select';
import { ControlledSelect } from '@/components/ui/select';

type JurisdictionSelectorProps<T extends FieldValues = FieldValues> = {
  control: Control<T>;
  name: Path<T>;
  errors?: FieldErrors<T>;
  required?: boolean;
  testID?: string;
};

// EU member states + UK + Switzerland (common jurisdictions for DSA compliance)
const JURISDICTION_OPTIONS: OptionType[] = [
  { label: 'Austria (AT)', value: 'AT' },
  { label: 'Belgium (BE)', value: 'BE' },
  { label: 'Bulgaria (BG)', value: 'BG' },
  { label: 'Croatia (HR)', value: 'HR' },
  { label: 'Cyprus (CY)', value: 'CY' },
  { label: 'Czech Republic (CZ)', value: 'CZ' },
  { label: 'Denmark (DK)', value: 'DK' },
  { label: 'Estonia (EE)', value: 'EE' },
  { label: 'Finland (FI)', value: 'FI' },
  { label: 'France (FR)', value: 'FR' },
  { label: 'Germany (DE)', value: 'DE' },
  { label: 'Greece (GR)', value: 'GR' },
  { label: 'Hungary (HU)', value: 'HU' },
  { label: 'Ireland (IE)', value: 'IE' },
  { label: 'Italy (IT)', value: 'IT' },
  { label: 'Latvia (LV)', value: 'LV' },
  { label: 'Lithuania (LT)', value: 'LT' },
  { label: 'Luxembourg (LU)', value: 'LU' },
  { label: 'Malta (MT)', value: 'MT' },
  { label: 'Netherlands (NL)', value: 'NL' },
  { label: 'Poland (PL)', value: 'PL' },
  { label: 'Portugal (PT)', value: 'PT' },
  { label: 'Romania (RO)', value: 'RO' },
  { label: 'Slovakia (SK)', value: 'SK' },
  { label: 'Slovenia (SI)', value: 'SI' },
  { label: 'Spain (ES)', value: 'ES' },
  { label: 'Sweden (SE)', value: 'SE' },
  { label: 'Switzerland (CH)', value: 'CH' },
  { label: 'United Kingdom (GB)', value: 'GB' },
];

/**
 * Jurisdiction selector component for illegal content reports
 *
 * Allows users to select the country where the reported content is illegal.
 * Required for DSA Art. 16 compliance when reporting illegal content.
 */
export function JurisdictionSelector<T extends FieldValues = FieldValues>({
  control,
  name,
  errors,
  testID = 'jurisdiction-selector',
}: JurisdictionSelectorProps<T>): React.ReactElement {
  const { t } = useTranslation();

  const errorMessage = errors?.[name]?.message as string | undefined;

  return (
    <ControlledSelect
      control={control}
      name={name}
      label={t('moderation.report_modal.jurisdiction_label')}
      placeholder={t('moderation.report_modal.jurisdiction_placeholder')}
      options={JURISDICTION_OPTIONS}
      error={errorMessage}
      testID={testID}
    />
  );
}
