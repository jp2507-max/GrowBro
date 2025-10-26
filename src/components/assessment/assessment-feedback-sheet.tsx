import React, { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Text, View } from '@/components/ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal, useModal } from '@/components/ui/modal';

export type FeedbackIssueResolved = 'yes' | 'no' | 'too_early';

export type AssessmentFeedbackData = {
  helpful: boolean;
  issueResolved?: FeedbackIssueResolved;
  notes?: string;
};

type AssessmentFeedbackSheetProps = {
  onSubmit: (feedback: AssessmentFeedbackData) => void;
  assessmentId: string;
};

export const AssessmentFeedbackSheet = React.forwardRef<
  unknown,
  AssessmentFeedbackSheetProps
>(({ onSubmit, assessmentId: _assessmentId }, ref) => {
  const { t } = useTranslation();
  const internalRef = useRef<any>(null);
  const setRefs = useCallback(
    (node: any) => {
      internalRef.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref && 'current' in (ref as any)) (ref as any).current = node;
    },
    [ref]
  );
  const [step, setStep] = useState<'helpful' | 'resolved' | 'notes'>('helpful');
  const [helpful, setHelpful] = useState<boolean | null>(null);
  const [issueResolved, setIssueResolved] =
    useState<FeedbackIssueResolved | null>(null);
  const [notes, setNotes] = useState('');

  const handleHelpfulResponse = (isHelpful: boolean) => {
    setHelpful(isHelpful);
    if (isHelpful) {
      setStep('resolved');
    } else {
      setStep('notes');
    }
  };

  const handleResolvedResponse = (resolved: FeedbackIssueResolved) => {
    setIssueResolved(resolved);
    setStep('notes');
  };

  const handleSubmit = () => {
    if (helpful === null) return;

    const feedback: AssessmentFeedbackData = {
      helpful,
      issueResolved: issueResolved ?? undefined,
      notes: notes.trim() || undefined,
    };

    onSubmit(feedback);
    handleClose();
  };

  const handleClose = () => {
    // Dismiss the sheet then reset local state
    internalRef.current?.dismiss?.();
    setStep('helpful');
    setHelpful(null);
    setIssueResolved(null);
    setNotes('');
  };

  return (
    <Modal
      ref={setRefs}
      title={t('assessment.feedback.title')}
      snapPoints={['70%']}
    >
      <View className="gap-6 p-6">
        {step === 'helpful' && (
          <View className="gap-4">
            <Text className="text-lg font-semibold text-charcoal-900 dark:text-neutral-100">
              {t('assessment.feedback.helpful_question')}
            </Text>
            <View className="flex-row gap-3">
              <Button
                testID="feedback-helpful-yes"
                variant="outline"
                onPress={() => handleHelpfulResponse(true)}
                className="flex-1"
              >
                {t('assessment.feedback.yes')}
              </Button>
              <Button
                testID="feedback-helpful-no"
                variant="outline"
                onPress={() => handleHelpfulResponse(false)}
                className="flex-1"
              >
                {t('assessment.feedback.no')}
              </Button>
            </View>
          </View>
        )}

        {step === 'resolved' && (
          <View className="gap-4">
            <Text className="text-lg font-semibold text-charcoal-900 dark:text-neutral-100">
              {t('assessment.feedback.resolved_question')}
            </Text>
            <View className="gap-3">
              <Button
                testID="feedback-resolved-yes"
                variant="outline"
                onPress={() => handleResolvedResponse('yes')}
              >
                {t('assessment.feedback.resolved_yes')}
              </Button>
              <Button
                testID="feedback-resolved-no"
                variant="outline"
                onPress={() => handleResolvedResponse('no')}
              >
                {t('assessment.feedback.resolved_no')}
              </Button>
              <Button
                testID="feedback-resolved-too-early"
                variant="outline"
                onPress={() => handleResolvedResponse('too_early')}
              >
                {t('assessment.feedback.resolved_too_early')}
              </Button>
            </View>
          </View>
        )}

        {step === 'notes' && (
          <View className="gap-4">
            <Text className="text-lg font-semibold text-charcoal-900 dark:text-neutral-100">
              {t('assessment.feedback.notes_question')}
            </Text>
            <Text className="text-sm text-charcoal-600 dark:text-neutral-400">
              {t('assessment.feedback.notes_description')}
            </Text>
            <Input
              testID="feedback-notes"
              value={notes}
              onChangeText={setNotes}
              placeholder={t('assessment.feedback.notes_placeholder')}
              multiline
              numberOfLines={4}
              maxLength={500}
            />
            <Text className="text-xs text-charcoal-500 dark:text-neutral-500">
              {notes.length}/500
            </Text>
            <View className="flex-row gap-3">
              <Button
                testID="feedback-skip"
                variant="outline"
                onPress={handleSubmit}
                className="flex-1"
              >
                {t('assessment.feedback.skip')}
              </Button>
              <Button
                testID="feedback-submit"
                onPress={handleSubmit}
                className="flex-1"
              >
                {t('assessment.feedback.submit')}
              </Button>
            </View>
          </View>
        )}

        {step !== 'helpful' && (
          <Text className="text-center text-xs text-charcoal-500 dark:text-neutral-500">
            {t('assessment.feedback.privacy_note')}
          </Text>
        )}
      </View>
    </Modal>
  );
});

AssessmentFeedbackSheet.displayName = 'AssessmentFeedbackSheet';

export { useModal as useFeedbackModal };
