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

import { View } from '@/components/ui';
import type { AppealType, ModerationDecision } from '@/types/moderation';

import { AppealActions } from './appeal-actions';
import { AppealHeader } from './appeal-header';
import { CounterArgumentsInput } from './counter-arguments-input';
import { DeadlineNotice } from './deadline-notice';
import { ErrorDisplay } from './error-display';
import { EvidenceSection } from './evidence-section';
import { LegalNotice } from './legal-notice';
import { OriginalDecisionContext } from './original-decision-context';

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
    if ((counterArguments?.trim().length ?? 0) < 50) {
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
      <AppealHeader />

      <DeadlineNotice deadline={deadline} />

      <OriginalDecisionContext originalDecision={originalDecision} />

      <CounterArgumentsInput
        value={counterArguments}
        onChange={setCounterArguments}
      />

      <EvidenceSection
        evidenceUrls={evidenceUrls}
        newEvidenceUrl={newEvidenceUrl}
        onNewEvidenceUrlChange={setNewEvidenceUrl}
        onAddEvidence={handleAddEvidence}
        onRemoveEvidence={handleRemoveEvidence}
      />

      <ErrorDisplay error={error} />

      <AppealActions
        isSubmitting={isSubmitting}
        counterArgumentsLength={counterArguments.length}
        onCancel={onCancel}
        onSubmit={handleSubmit}
      />

      <LegalNotice />
    </View>
  );
}
