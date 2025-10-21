/**
 * Appeal Submission Form - DSA Art. 20 UI Component
 *
 * Provides interface for users to:
 * - View original moderation decision
 * - Submit counter-arguments with evidence
 * - Understand appeal deadlines and process
 *
 * Requirements: 4.1, 4.2
 */

import React from 'react';
import { useTranslation } from 'react-i18next';

import { Button, Input, Text, View } from '@/components/ui';
import type { AppealType, ModerationDecision } from '@/types/moderation';

// ============================================================================
// Types
// ============================================================================

export interface AppealFormProps {
  decisionId: string;
  originalDecision: ModerationDecision;
  appealType: AppealType;
  deadline: Date;
  onSubmit: (appeal: {
    counterArguments: string;
    supportingEvidence: string[];
  }) => Promise<void>;
  onCancel: () => void;
}

// ============================================================================
// Component
// ============================================================================

export function AppealSubmissionForm({
  originalDecision,
  appealType: _appealType,
  deadline,
  onSubmit,
  onCancel,
}: AppealFormProps) {
  const { t } = useTranslation();
  const [counterArguments, setCounterArguments] = React.useState('');
  const [evidenceUrls, setEvidenceUrls] = React.useState<string[]>([]);
  const [newEvidenceUrl, setNewEvidenceUrl] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const daysUntilDeadline = Math.ceil(
    (deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  const isValidUrl = (url: string): boolean => {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const handleAddEvidence = () => {
    const trimmedUrl = newEvidenceUrl.trim();
    if (!trimmedUrl) return;

    if (!isValidUrl(trimmedUrl)) {
      setError(t('appeals.error.invalidUrl'));
      return;
    }

    if (evidenceUrls.includes(trimmedUrl)) {
      setError(t('appeals.error.duplicateUrl'));
      return;
    }

    if (evidenceUrls.length >= 5) {
      setError(t('appeals.error.maxEvidenceReached'));
      return;
    }

    setEvidenceUrls([...evidenceUrls, trimmedUrl]);
    setNewEvidenceUrl('');
    setError(null);
  };

  const handleRemoveEvidence = (index: number) => {
    setEvidenceUrls(evidenceUrls.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    // Validate counter-arguments length (min 50 chars per schema)
    if (counterArguments.length < 50) {
      setError(t('appeals.error.counterArgumentsTooShort'));
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit({
        counterArguments,
        supportingEvidence: evidenceUrls,
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t('appeals.error.submitFailed')
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View className="flex-1 bg-neutral-50 p-4 dark:bg-charcoal-950">
      {/* Header */}
      <View className="mb-6">
        <Text className="mb-2 text-2xl font-bold text-charcoal-950 dark:text-neutral-100">
          {t('appeals.title.submitAppeal')}
        </Text>
        <Text className="text-sm text-neutral-600 dark:text-neutral-400">
          {t('appeals.subtitle.humanReview')}
        </Text>
      </View>

      {/* Deadline Notice */}
      <View className="mb-4 rounded-lg bg-warning-100 p-3 dark:bg-warning-900">
        <Text className="text-sm font-medium text-warning-900 dark:text-warning-100">
          {t('appeals.notice.deadline', {
            days: daysUntilDeadline,
            date: deadline.toLocaleDateString(),
          })}
        </Text>
      </View>

      {/* Original Decision Context */}
      <View className="mb-6 rounded-lg bg-neutral-100 p-4 dark:bg-charcoal-900">
        <Text className="mb-2 text-sm font-bold text-charcoal-950 dark:text-neutral-100">
          {t('appeals.label.originalDecision')}
        </Text>
        <View className="mb-2">
          <Text className="text-xs text-neutral-600 dark:text-neutral-400">
            {t('appeals.label.action')}
          </Text>
          <Text className="text-sm text-charcoal-950 dark:text-neutral-100">
            {originalDecision.action}
          </Text>
        </View>
        <View className="mb-2">
          <Text className="text-xs text-neutral-600 dark:text-neutral-400">
            {t('appeals.label.reasoning')}
          </Text>
          <Text className="text-sm text-charcoal-950 dark:text-neutral-100">
            {originalDecision.reasoning}
          </Text>
        </View>
        <View>
          <Text className="text-xs text-neutral-600 dark:text-neutral-400">
            {t('appeals.label.policyViolations')}
          </Text>
          <Text className="text-sm text-charcoal-950 dark:text-neutral-100">
            {originalDecision.policy_violations.join(', ')}
          </Text>
        </View>
      </View>

      {/* Counter Arguments Input */}
      <View className="mb-4">
        <Text className="mb-2 text-sm font-medium text-charcoal-950 dark:text-neutral-100">
          {t('appeals.label.counterArguments')} *
        </Text>
        <Text className="mb-2 text-xs text-neutral-600 dark:text-neutral-400">
          {t('appeals.hint.counterArguments')}
        </Text>
        <Input
          value={counterArguments}
          onChangeText={setCounterArguments}
          placeholder={t('appeals.placeholder.counterArguments')}
          multiline
          numberOfLines={6}
          className="min-h-[120px]"
          maxLength={5000}
        />
        <Text className="mt-1 text-xs text-neutral-500 dark:text-neutral-500">
          {counterArguments.length} / 5000 characters (minimum 50)
        </Text>
      </View>

      {/* Evidence URLs */}
      <View className="mb-6">
        <Text className="mb-2 text-sm font-medium text-charcoal-950 dark:text-neutral-100">
          {t('appeals.label.evidence')}
        </Text>
        <Text className="mb-2 text-xs text-neutral-600 dark:text-neutral-400">
          {t('appeals.hint.evidence')}
        </Text>

        {/* Evidence URL Input */}
        <View className="mb-2 flex-row gap-2">
          <Input
            value={newEvidenceUrl}
            onChangeText={setNewEvidenceUrl}
            placeholder="https://example.com/evidence.jpg"
            className="flex-1"
            keyboardType="url"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Button
            variant="outline"
            onPress={handleAddEvidence}
            disabled={!newEvidenceUrl.trim() || evidenceUrls.length >= 5}
            size="sm"
          >
            <Text>{t('common.add')}</Text>
          </Button>
        </View>

        {/* Evidence URL List */}
        {evidenceUrls.length > 0 && (
          <View className="gap-2">
            {evidenceUrls.map((url, index) => (
              <View
                key={index}
                className="flex-row items-center justify-between rounded-lg bg-neutral-100 p-2 dark:bg-charcoal-900"
              >
                <Text
                  className="flex-1 text-sm text-charcoal-950 dark:text-neutral-100"
                  numberOfLines={1}
                >
                  {url}
                </Text>
                <Button
                  variant="ghost"
                  onPress={() => handleRemoveEvidence(index)}
                  size="sm"
                >
                  <Text className="text-danger-600">✕</Text>
                </Button>
              </View>
            ))}
          </View>
        )}

        <Text className="mt-2 text-xs text-neutral-500 dark:text-neutral-500">
          {t('appeals.notice.evidenceOptional')} ({evidenceUrls.length}/5)
        </Text>
      </View>

      {/* Error Display */}
      {error && (
        <View className="mb-4 rounded-lg bg-danger-100 p-3 dark:bg-danger-900">
          <Text className="text-sm text-danger-900 dark:text-danger-100">
            {error}
          </Text>
        </View>
      )}

      {/* Actions */}
      <View className="flex-row gap-3">
        <Button
          variant="outline"
          onPress={onCancel}
          disabled={isSubmitting}
          className="flex-1"
        >
          <Text>{t('common.cancel')}</Text>
        </Button>
        <Button
          variant="default"
          onPress={handleSubmit}
          disabled={isSubmitting || counterArguments.length < 50}
          className="flex-1"
        >
          <Text>
            {isSubmitting ? t('common.submitting') : t('appeals.action.submit')}
          </Text>
        </Button>
      </View>

      {/* Legal Notice */}
      <View className="mt-4">
        <Text className="text-xs text-neutral-500 dark:text-neutral-500">
          {t('appeals.legal.freeOfCharge')}
        </Text>
        <Text className="mt-1 text-xs text-neutral-500 dark:text-neutral-500">
          {t('appeals.legal.humanReviewGuarantee')}
        </Text>
      </View>
    </View>
  );
}
