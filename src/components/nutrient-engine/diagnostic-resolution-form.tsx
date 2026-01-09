import React from 'react';
import { View } from 'react-native';

import { Button, Input, Text } from '@/components/ui';
import { translate } from '@/lib/i18n/utils';

type Props = {
  diagnosticId: string;
  onResolve: (diagnosticId: string, notes?: string) => Promise<void>;
  onCancel: () => void;
  testID?: string;
};

function useResolutionSubmit(
  diagnosticId: string,
  notes: string,
  onResolve: Props['onResolve']
): {
  handleResolve: () => Promise<void>;
  isSubmitting: boolean;
  error: string | null;
} {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleResolve = React.useCallback(async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      await onResolve(diagnosticId, notes.trim() || undefined);
      setIsSubmitting(false);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : translate('nutrient.diagnostics.resolution.error')
      );
      setIsSubmitting(false);
    }
  }, [diagnosticId, notes, onResolve]);

  return { handleResolve, isSubmitting, error };
}

export function DiagnosticResolutionForm({
  diagnosticId,
  onResolve,
  onCancel,
  testID = 'diagnostic-resolution-form',
}: Props): React.ReactElement {
  const [notes, setNotes] = React.useState('');
  const { handleResolve, isSubmitting, error } = useResolutionSubmit(
    diagnosticId,
    notes,
    onResolve
  );

  return (
    <View
      className="rounded-xl bg-neutral-50 p-4 dark:bg-neutral-900"
      testID={testID}
    >
      <Text className="mb-3 text-lg font-semibold text-neutral-900 dark:text-neutral-100">
        {translate('nutrient.diagnostics.resolution.title')}
      </Text>

      <Text className="mb-3 text-sm text-neutral-600 dark:text-neutral-400">
        {translate('nutrient.diagnostics.resolution.description')}
      </Text>

      <Input
        label={translate('nutrient.diagnostics.resolution.notes_label')}
        placeholder={translate(
          'nutrient.diagnostics.resolution.notes_placeholder'
        )}
        value={notes}
        onChangeText={setNotes}
        multiline
        numberOfLines={4}
        textAlignVertical="top"
        className="mb-3"
        testID={`${testID}-notes-input`}
      />

      {error && (
        <Text className="mb-3 text-sm text-danger-600 dark:text-danger-400">
          {error}
        </Text>
      )}

      <View className="flex-row gap-3">
        <Button
          label={translate('nutrient.diagnostics.resolution.cancel')}
          onPress={onCancel}
          variant="outline"
          disabled={isSubmitting}
          className="flex-1"
          testID={`${testID}-cancel-button`}
        />
        <Button
          label={translate('nutrient.diagnostics.resolution.resolve')}
          onPress={handleResolve}
          loading={isSubmitting}
          disabled={isSubmitting}
          className="flex-1"
          testID={`${testID}-resolve-button`}
        />
      </View>
    </View>
  );
}
