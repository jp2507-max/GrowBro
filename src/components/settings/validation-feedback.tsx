/**
 * Form validation feedback component
 * Requirements: 12.1, 12.2, 12.5
 *
 * Provides accessible inline error messages with proper ARIA attributes
 * and screen reader announcements.
 */

import React from 'react';
import type { FieldError } from 'react-hook-form';

import { Text, View } from '@/components/ui';

interface ValidationErrorProps {
  error?: FieldError;
  fieldName: string;
  testID?: string;
}

/**
 * Inline validation error message
 * Requirements: 12.1, 12.2, 12.5
 */
export function ValidationError({
  error,
  fieldName,
  testID,
}: ValidationErrorProps) {
  if (!error) return null;

  return (
    <View
      className="mt-1 flex-row items-start"
      testID={testID}
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
      accessibilityLabel={`${fieldName} error: ${error.message}`}
      accessibilityHint="This field has a validation error that needs to be fixed"
    >
      <Text className="text-sm text-danger-600 dark:text-danger-400">
        ⚠ {error.message}
      </Text>
    </View>
  );
}

interface FormErrorSummaryProps {
  errors: Record<string, FieldError>;
  testID?: string;
}

/**
 * Form-level error summary
 * Requirements: 12.1, 12.5
 */
export function FormErrorSummary({ errors, testID }: FormErrorSummaryProps) {
  const errorEntries = Object.entries(errors);

  if (errorEntries.length === 0) return null;

  return (
    <View
      className="dark:bg-danger-950 mb-4 rounded-lg bg-danger-50 p-4"
      testID={testID}
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
      accessibilityLabel={`Form has ${errorEntries.length} error${errorEntries.length > 1 ? 's' : ''}`}
      accessibilityHint="Review and fix all form errors before submitting"
    >
      <Text className="mb-2 font-semibold text-danger-800 dark:text-danger-200">
        Please fix the following errors:
      </Text>
      {errorEntries.map(([field, error]) => (
        <Text
          key={field}
          className="mb-1 text-sm text-danger-700 dark:text-danger-300"
        >
          • {error.message}
        </Text>
      ))}
    </View>
  );
}

interface SuccessMessageProps {
  message: string;
  testID?: string;
}

/**
 * Success feedback message
 * Requirements: 12.1, 12.2
 */
export function SuccessMessage({ message, testID }: SuccessMessageProps) {
  return (
    <View
      className="dark:bg-success-950 mb-4 flex-row items-center rounded-lg bg-success-50 p-4"
      testID={testID}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      accessibilityLabel={`Success: ${message}`}
      accessibilityHint="Operation completed successfully"
    >
      <Text className="mr-2 text-lg">✓</Text>
      <Text className="flex-1 text-success-800 dark:text-success-200">
        {message}
      </Text>
    </View>
  );
}
