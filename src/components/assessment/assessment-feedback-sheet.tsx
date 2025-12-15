import type { TFunction } from 'i18next';
import React, { memo, useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Text, View } from '@/components/ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal, useModal } from '@/components/ui/modal';
import type { FeedbackIssueResolved } from '@/lib/watermelon-models/assessment-feedback';

export type AssessmentFeedbackData = {
  assessmentId: string;
  helpful: boolean;
  issueResolved?: FeedbackIssueResolved;
  notes?: string;
};

type AssessmentFeedbackSheetProps = {
  onSubmit: (feedback: AssessmentFeedbackData) => void;
  assessmentId: string;
};

type ModalRef = { dismiss?: () => void };

export const AssessmentFeedbackSheet: React.ForwardRefExoticComponent<
  AssessmentFeedbackSheetProps & React.RefAttributes<unknown>
> = React.forwardRef<unknown, AssessmentFeedbackSheetProps>(
  ({ onSubmit, assessmentId }, ref) => {
    const { t } = useTranslation();
    const internalRef = useRef<ModalRef | null>(null);
    const setRefs = useCallback(
      (node: ModalRef | null) => {
        internalRef.current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref && typeof ref === 'object' && 'current' in ref) {
          (ref as React.MutableRefObject<ModalRef | null>).current = node;
        }
      },
      [ref]
    );
    const [step, setStep] = useState<'helpful' | 'resolved' | 'notes'>(
      'helpful'
    );
    const [helpful, setHelpful] = useState<boolean | null>(null);
    const [issueResolved, setIssueResolved] =
      useState<FeedbackIssueResolved | null>(null);
    const [notes, setNotes] = useState('');

    const handleHelpfulResponse = (isHelpful: boolean): void => {
      setHelpful(isHelpful);
      if (isHelpful) {
        setStep('resolved');
      } else {
        setStep('notes');
      }
    };

    const handleResolvedResponse = (resolved: FeedbackIssueResolved): void => {
      setIssueResolved(resolved);
      setStep('notes');
    };

    const handleSubmit = (): void => {
      if (helpful === null) return;

      const feedback: AssessmentFeedbackData = {
        assessmentId,
        helpful,
        issueResolved: issueResolved ?? undefined,
        notes: notes.trim() || undefined,
      };

      onSubmit(feedback);
      handleClose();
    };

    const handleClose = (): void => {
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
            <HelpfulStep t={t} onHelpful={handleHelpfulResponse} />
          )}

          {step === 'resolved' && (
            <ResolvedStep t={t} onResolved={handleResolvedResponse} />
          )}

          {step === 'notes' && (
            <NotesStep
              t={t}
              notes={notes}
              onChangeNotes={setNotes}
              onSkip={handleSubmit}
              onSubmit={handleSubmit}
            />
          )}

          {step !== 'helpful' && <PrivacyNote t={t} />}
        </View>
      </Modal>
    );
  }
);

AssessmentFeedbackSheet.displayName = 'AssessmentFeedbackSheet';

export { useModal as useFeedbackModal };

type HelpfulStepProps = {
  t: TFunction;
  onHelpful: (isHelpful: boolean) => void;
};

const HelpfulStep: React.FC<HelpfulStepProps> = ({ t, onHelpful }) => {
  return (
    <View className="gap-4">
      <Text className="text-lg font-semibold text-text-primary">
        {t('assessment.feedback.helpful_question')}
      </Text>
      <View className="flex-row gap-3">
        <Button
          testID="feedback-helpful-yes"
          variant="outline"
          onPress={() => onHelpful(true)}
          className="flex-1"
        >
          {t('assessment.feedback.yes')}
        </Button>
        <Button
          testID="feedback-helpful-no"
          variant="outline"
          onPress={() => onHelpful(false)}
          className="flex-1"
        >
          {t('assessment.feedback.no')}
        </Button>
      </View>
    </View>
  );
};

export const HelpfulStepMemo = React.memo(HelpfulStep);

type ResolvedStepProps = {
  t: TFunction;
  onResolved: (value: FeedbackIssueResolved) => void;
};

function ResolvedStep({ t, onResolved }: ResolvedStepProps) {
  return (
    <View className="gap-4">
      <Text className="text-lg font-semibold text-text-primary">
        {t('assessment.feedback.resolved_question')}
      </Text>
      <View className="gap-3">
        <Button
          testID="feedback-resolved-yes"
          variant="outline"
          onPress={() => onResolved('yes')}
        >
          {t('assessment.feedback.resolved_yes')}
        </Button>
        <Button
          testID="feedback-resolved-no"
          variant="outline"
          onPress={() => onResolved('no')}
        >
          {t('assessment.feedback.resolved_no')}
        </Button>
        <Button
          testID="feedback-resolved-too-early"
          variant="outline"
          onPress={() => onResolved('too_early')}
        >
          {t('assessment.feedback.resolved_too_early')}
        </Button>
      </View>
    </View>
  );
}

export const ResolvedStepMemo = memo(ResolvedStep);

type NotesStepProps = {
  t: TFunction;
  notes: string;
  onChangeNotes: (value: string) => void;
  onSkip: () => void;
  onSubmit: () => void;
};

function NotesStep({
  t,
  notes,
  onChangeNotes,
  onSkip,
  onSubmit,
}: NotesStepProps) {
  return (
    <View className="gap-4">
      <Text className="text-lg font-semibold text-text-primary">
        {t('assessment.feedback.notes_question')}
      </Text>
      <Text className="text-sm text-text-secondary">
        {t('assessment.feedback.notes_description')}
      </Text>
      <Input
        testID="feedback-notes"
        value={notes}
        onChangeText={onChangeNotes}
        placeholder={t('assessment.feedback.notes_placeholder')}
        multiline
        numberOfLines={4}
        maxLength={500}
      />
      <Text className="text-text-tertiary text-xs">{notes.length}/500</Text>
      <View className="flex-row gap-3">
        <Button
          testID="feedback-skip"
          variant="outline"
          onPress={onSkip}
          className="flex-1"
        >
          {t('assessment.feedback.skip')}
        </Button>
        <Button testID="feedback-submit" onPress={onSubmit} className="flex-1">
          {t('assessment.feedback.submit')}
        </Button>
      </View>
    </View>
  );
}

export const NotesStepMemo = memo(NotesStep);

type PrivacyNoteProps = {
  t: TFunction;
};

function PrivacyNote({ t }: PrivacyNoteProps) {
  return (
    <Text className="text-text-tertiary text-center text-xs">
      {t('assessment.feedback.privacy_note')}
    </Text>
  );
}

export const PrivacyNoteMemo = memo(PrivacyNote);
