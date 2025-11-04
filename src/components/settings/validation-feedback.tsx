/**
 * Form validation feedback component
 * Requirements: 12.1, 12.2, 12.5
 *
 * Provides accessible inline error messages with proper ARIA attributes
 * and screen reader announcements.
 */

import * as React from 'react';
import type { FieldError } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Text, View } from '@/components/ui';

type ValidationErrorProps = {
  error?: FieldError;
  fieldLabel: string;
  testID?: string;
};

/**
 * Inline validation error message
 * Requirements: 12.1, 12.2, 12.5
 */
export function ValidationError({
  error,
  fieldLabel,
  testID,
}: ValidationErrorProps): React.ReactElement | null {
  const { t } = useTranslation();

  if (!error) return null;

  return (
    <View
      className="mt-1 flex-row items-start"
      testID={testID}
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
      accessibilityLabel={t('validation.fieldError', {
        fieldLabel,
        message: error.message,
      })}
      accessibilityHint={t('validation.hint')}
    >
      <Text className="text-sm text-danger-600 dark:text-danger-400">
        {t('validation.errorMessage', { message: error.message })}
      </Text>
    </View>
  );
}

type FormErrorSummaryProps = {
  errors: Record<string, FieldError>;
  testID?: string;
};

/**
 * Form-level error summary
 * Requirements: 12.1, 12.5
 */
export function FormErrorSummary({
  errors,
  testID,
}: FormErrorSummaryProps): React.ReactElement | null {
  const { t } = useTranslation();
  const errorEntries = Object.entries(errors);

  if (errorEntries.length === 0) return null;

  return (
    <View
      className="dark:bg-danger-950 mb-4 rounded-lg bg-danger-50 p-4"
      testID={testID}
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
      accessibilityLabel={t('validation.formErrors', {
        count: errorEntries.length,
      })}
      accessibilityHint={t('validation.reviewAndFixErrors')}
    >
      <Text className="mb-2 font-semibold text-danger-800 dark:text-danger-200">
        {t('validation.pleaseFixErrors')}
      </Text>
      {errorEntries.map(([field, error]) => (
        <Text
          key={field}
          className="mb-1 text-sm text-danger-700 dark:text-danger-300"
        >
          •{' '}
          {t('validation.fieldErrorItem', {
            field: t(`fields.${field}`),
            message: error.message,
          })}
        </Text>
      ))}
    </View>
  );
}

type SuccessMessageProps = {
  message: string;
  testID?: string;
};

/**
 * Success feedback message
 * Requirements: 12.1, 12.2
 */
export function SuccessMessage({
  message,
  testID,
}: SuccessMessageProps): React.ReactElement {
  const { t } = useTranslation();
  return (
    <View
      className="dark:bg-success-950 mb-4 flex-row items-center rounded-lg bg-success-50 p-4"
      testID={testID}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      accessibilityLabel={t('settings.validation.successLabel', { message })}
      accessibilityHint={t('settings.successHint')}
    >
      <Text className="mr-2 text-lg">✓</Text>
      <Text className="flex-1 text-success-800 dark:text-success-200">
        {message}
      </Text>
    </View>
  );
}
