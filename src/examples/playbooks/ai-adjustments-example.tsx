/**
 * ⚠️ EXAMPLE CODE - NOT FOR PRODUCTION USE
 *
 * This is a demonstration implementation showing how to use AI adjustments
 * in a plant detail screen. It illustrates the complete flow:
 * - Suggestion display
 * - Preview modal (using @gorhom/bottom-sheet)
 * - Acceptance and voting
 */

import { BottomSheetView } from '@gorhom/bottom-sheet';
import * as React from 'react';
import { Pressable, ScrollView } from 'react-native';

import { AdjustmentPreviewModal } from '@/components/playbooks/adjustment-preview-modal';
import { AdjustmentSuggestionCard } from '@/components/playbooks/adjustment-suggestion-card';
import { HelpfulnessVoting } from '@/components/playbooks/helpfulness-voting';
import { Modal, Text, useModal, View as UIView } from '@/components/ui';
import { useAIAdjustments } from '@/lib/playbooks/use-ai-adjustments';
import type {
  AdjustmentContext,
  AdjustmentSuggestion,
} from '@/types/ai-adjustments';

type Props = {
  plantId: string;
  playbookId?: string;
};

type AcceptParams = {
  selectedSuggestion: AdjustmentSuggestion | null;
  acceptSuggestion: (
    suggestionId: string,
    taskIds?: string[]
  ) => Promise<AdjustmentSuggestion | undefined>;
  setAcceptedSuggestions: React.Dispatch<
    React.SetStateAction<AdjustmentSuggestion[]>
  >;
  dismissModal: () => void;
  setSelectedSuggestion: React.Dispatch<
    React.SetStateAction<AdjustmentSuggestion | null>
  >;
  taskIds?: string[];
};

async function acceptAllTasks(params: AcceptParams) {
  if (!params.selectedSuggestion) return;
  try {
    const updated = await params.acceptSuggestion(params.selectedSuggestion.id);
    if (updated) {
      params.setAcceptedSuggestions((prev: AdjustmentSuggestion[]) => [
        ...prev,
        updated,
      ]);
    }
    params.dismissModal();
    params.setSelectedSuggestion(null);
  } catch (error) {
    console.error('Failed to accept suggestion:', error);
  }
}

async function acceptPartialTasks(params: AcceptParams) {
  if (!params.selectedSuggestion || !params.taskIds) return;
  try {
    const updated = await params.acceptSuggestion(
      params.selectedSuggestion.id,
      params.taskIds
    );
    if (updated) {
      params.setAcceptedSuggestions((prev: AdjustmentSuggestion[]) => [
        ...prev,
        updated,
      ]);
    }
    params.dismissModal();
    params.setSelectedSuggestion(null);
  } catch (error) {
    console.error('Failed to accept partial suggestion:', error);
  }
}

type DeclineParams = {
  selectedSuggestion: AdjustmentSuggestion | null;
  declineSuggestion: (suggestionId: string) => Promise<void>;
  setAcceptedSuggestions: React.Dispatch<
    React.SetStateAction<AdjustmentSuggestion[]>
  >;
  dismissModal: () => void;
  setSelectedSuggestion: React.Dispatch<
    React.SetStateAction<AdjustmentSuggestion | null>
  >;
};

async function declineSuggestionHandler(params: DeclineParams) {
  if (!params.selectedSuggestion) return;
  try {
    await params.declineSuggestion(params.selectedSuggestion.id);
    params.setAcceptedSuggestions((prev: AdjustmentSuggestion[]) =>
      prev.filter((s) => s.id !== params.selectedSuggestion!.id)
    );
    params.dismissModal();
    params.setSelectedSuggestion(null);
  } catch (error) {
    console.error('Failed to decline suggestion:', error);
  }
}

function useAdjustmentHandlers(options: {
  acceptSuggestion: (
    suggestionId: string,
    taskIds?: string[]
  ) => Promise<AdjustmentSuggestion | undefined>;
  declineSuggestion: (suggestionId: string) => Promise<void>;
  acceptedSuggestions: AdjustmentSuggestion[];
  setAcceptedSuggestions: React.Dispatch<
    React.SetStateAction<AdjustmentSuggestion[]>
  >;
  setters: {
    dismissModal: () => void;
    setSelectedSuggestion: React.Dispatch<
      React.SetStateAction<AdjustmentSuggestion | null>
    >;
  };
}) {
  const handleAcceptAll = async (
    selectedSuggestion: AdjustmentSuggestion | null
  ) => {
    await acceptAllTasks({
      selectedSuggestion,
      acceptSuggestion: options.acceptSuggestion,
      setAcceptedSuggestions: options.setAcceptedSuggestions,
      dismissModal: options.setters.dismissModal,
      setSelectedSuggestion: options.setters.setSelectedSuggestion,
    });
  };

  const handleAcceptPartial = async (
    selectedSuggestion: AdjustmentSuggestion | null,
    taskIds: string[]
  ) => {
    await acceptPartialTasks({
      selectedSuggestion,
      taskIds,
      acceptSuggestion: options.acceptSuggestion,
      setAcceptedSuggestions: options.setAcceptedSuggestions,
      dismissModal: options.setters.dismissModal,
      setSelectedSuggestion: options.setters.setSelectedSuggestion,
    });
  };

  const handleDecline = async (
    selectedSuggestion: AdjustmentSuggestion | null
  ) => {
    await declineSuggestionHandler({
      selectedSuggestion,
      declineSuggestion: options.declineSuggestion,
      setAcceptedSuggestions: options.setAcceptedSuggestions,
      dismissModal: options.setters.dismissModal,
      setSelectedSuggestion: options.setters.setSelectedSuggestion,
    });
  };

  return { handleAcceptAll, handleAcceptPartial, handleDecline };
}

function PendingSuggestionsSection({
  suggestions,
  onView,
  onDismiss,
}: {
  suggestions: AdjustmentSuggestion[];
  onView: (s: AdjustmentSuggestion) => void;
  onDismiss: (id: string) => void;
}) {
  if (suggestions.length === 0) return null;

  return (
    <UIView className="mb-6">
      <Text className="mb-3 text-lg font-semibold text-neutral-900 dark:text-neutral-100">
        Pending Suggestions
      </Text>
      {suggestions.map((suggestion) => (
        <AdjustmentSuggestionCard
          key={suggestion.id}
          suggestion={suggestion}
          onView={onView}
          onDismiss={onDismiss}
        />
      ))}
    </UIView>
  );
}

function AcceptedSuggestionsSection({
  suggestions,
  onVote,
}: {
  suggestions: AdjustmentSuggestion[];
  onVote: (id: string, vote: 'helpful' | 'not_helpful') => void;
}) {
  if (suggestions.length === 0) return null;

  return (
    <UIView className="mb-6">
      <Text className="mb-3 text-lg font-semibold text-neutral-900 dark:text-neutral-100">
        Applied Adjustments
      </Text>
      {suggestions.map((suggestion) => (
        <UIView
          key={suggestion.id}
          className="mb-3 rounded-xl border border-success-200 bg-success-50 p-4 dark:border-success-800 dark:bg-success-950"
        >
          <UIView className="mb-2 flex-row items-center">
            <Text className="text-lg font-semibold text-success-900 dark:text-success-100">
              ✓ Applied
            </Text>
          </UIView>
          <Text className="mb-3 text-sm text-neutral-700 dark:text-neutral-300">
            {suggestion.reasoning}
          </Text>
          <HelpfulnessVoting
            suggestionId={suggestion.id}
            currentVote={suggestion.helpfulnessVote}
            onVote={onVote}
          />
        </UIView>
      ))}
    </UIView>
  );
}

function useActionHandlers(options: {
  declineSuggestion: (suggestionId: string) => Promise<void>;
  voteHelpfulness: (
    suggestionId: string,
    vote: 'helpful' | 'not_helpful'
  ) => Promise<void>;
  setNeverSuggest: (value: boolean) => Promise<void>;
  generateSuggestion: (
    context: AdjustmentContext
  ) => Promise<AdjustmentSuggestion | null>;
  plantId: string;
  playbookId?: string;
}) {
  const handleDismiss = async (suggestionId: string) => {
    try {
      await options.declineSuggestion(suggestionId);
    } catch (error) {
      console.error('Failed to dismiss suggestion:', error);
    }
  };

  const handleVote = async (
    suggestionId: string,
    vote: 'helpful' | 'not_helpful'
  ) => {
    try {
      await options.voteHelpfulness(suggestionId, vote);
    } catch (error) {
      console.error('Failed to vote:', error);
    }
  };

  const handleNeverSuggest = async () => {
    try {
      await options.setNeverSuggest(true);
    } catch (error) {
      console.error('Failed to set preference:', error);
    }
  };

  const handleGenerateTestSuggestion = async () => {
    try {
      await options.generateSuggestion({
        plantId: options.plantId,
        playbookId: options.playbookId,
        skippedTaskCount: 3,
      });
    } catch (error) {
      console.error('Failed to generate suggestion:', error);
    }
  };

  return {
    handleDismiss,
    handleVote,
    handleNeverSuggest,
    handleGenerateTestSuggestion,
  };
}

function ContentSection({
  pendingSuggestions,
  acceptedSuggestionsList,
  handleViewDetails,
  handleDismiss,
  handleVote,
}: {
  pendingSuggestions: AdjustmentSuggestion[];
  acceptedSuggestionsList: AdjustmentSuggestion[];
  handleViewDetails: (s: AdjustmentSuggestion) => void;
  handleDismiss: (id: string) => void;
  handleVote: (id: string, vote: 'helpful' | 'not_helpful') => void;
}) {
  return (
    <>
      <PendingSuggestionsSection
        suggestions={pendingSuggestions}
        onView={handleViewDetails}
        onDismiss={handleDismiss}
      />

      <AcceptedSuggestionsSection
        suggestions={acceptedSuggestionsList}
        onVote={handleVote}
      />

      {pendingSuggestions.length === 0 &&
        acceptedSuggestionsList.length === 0 && (
          <UIView className="items-center justify-center py-12">
            <Text className="mb-2 text-center text-lg text-neutral-600 dark:text-neutral-400">
              No suggestions at this time
            </Text>
            <Text className="mb-4 text-center text-sm text-neutral-500 dark:text-neutral-500">
              AI will suggest adjustments when patterns indicate schedule
              changes could help
            </Text>
          </UIView>
        )}
    </>
  );
}

function SettingsSection({ onPress }: { onPress: () => void }) {
  return (
    <UIView className="mt-6 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <Text className="mb-3 font-semibold text-neutral-900 dark:text-neutral-100">
        Suggestion Settings
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        className="dark:bg-danger-950 rounded-lg border border-danger-300 bg-danger-50 px-4 py-3 active:bg-danger-100 dark:border-danger-800"
      >
        <Text className="text-center font-medium text-danger-700 dark:text-danger-300">
          Never Suggest for This Plant
        </Text>
      </Pressable>
    </UIView>
  );
}

function DebugSection({
  onPress,
  loading,
}: {
  onPress: () => void;
  loading: boolean;
}) {
  if (!__DEV__) return null;

  return (
    <UIView className="mt-6">
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        disabled={loading}
        className="rounded-lg bg-neutral-200 px-4 py-3 disabled:opacity-50 dark:bg-neutral-800"
      >
        <Text className="text-center font-medium text-neutral-700 dark:text-neutral-300">
          {loading ? 'Generating...' : 'Generate Test Suggestion'}
        </Text>
      </Pressable>
    </UIView>
  );
}

function useLocalSuggestionState(acceptedSuggestions: AdjustmentSuggestion[]) {
  const [selectedSuggestion, setSelectedSuggestion] =
    React.useState<AdjustmentSuggestion | null>(null);
  const [localAcceptedSuggestions, setLocalAcceptedSuggestions] =
    React.useState<AdjustmentSuggestion[]>([]);
  const previewModal = useModal();

  React.useEffect(() => {
    setLocalAcceptedSuggestions(acceptedSuggestions);
  }, [acceptedSuggestions]);

  return {
    selectedSuggestion,
    setSelectedSuggestion,
    previewModal,
    localAcceptedSuggestions,
    setLocalAcceptedSuggestions,
  };
}

function useAdjustmentState(plantId: string, playbookId?: string) {
  const {
    suggestions,
    acceptedSuggestions,
    loading,
    generateSuggestion,
    acceptSuggestion,
    declineSuggestion,
    voteHelpfulness,
    setNeverSuggest,
  } = useAIAdjustments(plantId);

  const {
    selectedSuggestion,
    setSelectedSuggestion,
    previewModal,
    localAcceptedSuggestions,
    setLocalAcceptedSuggestions,
  } = useLocalSuggestionState(acceptedSuggestions);

  const { handleAcceptAll, handleAcceptPartial, handleDecline } =
    useAdjustmentHandlers({
      acceptSuggestion,
      declineSuggestion,
      acceptedSuggestions: localAcceptedSuggestions,
      setAcceptedSuggestions: setLocalAcceptedSuggestions,
      setters: { dismissModal: previewModal.dismiss, setSelectedSuggestion },
    });

  const {
    handleDismiss,
    handleVote,
    handleNeverSuggest,
    handleGenerateTestSuggestion,
  } = useActionHandlers({
    declineSuggestion,
    voteHelpfulness,
    setNeverSuggest,
    generateSuggestion,
    plantId,
    playbookId,
  });

  const handleViewDetails = (suggestion: AdjustmentSuggestion) => {
    setSelectedSuggestion(suggestion);
    previewModal.present();
  };

  const pendingSuggestions = suggestions.filter((s) => s.status === 'pending');

  return {
    loading,
    selectedSuggestion,
    previewModal,
    handleAcceptAll,
    handleAcceptPartial,
    handleDecline,
    handleDismiss,
    handleVote,
    handleNeverSuggest,
    handleGenerateTestSuggestion,
    handleViewDetails,
    pendingSuggestions,
    acceptedSuggestionsList: localAcceptedSuggestions,
  };
}

export function AIAdjustmentsExample({ plantId, playbookId }: Props) {
  const {
    loading,
    selectedSuggestion,
    previewModal,
    handleAcceptAll,
    handleAcceptPartial,
    handleDecline,
    handleDismiss,
    handleVote,
    handleNeverSuggest,
    handleGenerateTestSuggestion,
    handleViewDetails,
    pendingSuggestions,
    acceptedSuggestionsList,
  } = useAdjustmentState(plantId, playbookId);

  return (
    <UIView className="flex-1 bg-white dark:bg-charcoal-950">
      <ScrollView className="flex-1 p-4">
        <UIView className="mb-4">
          <Text className="mb-1 text-2xl font-bold text-neutral-900 dark:text-neutral-100">
            AI Schedule Adjustments
          </Text>
          <Text className="text-sm text-neutral-600 dark:text-neutral-400">
            Smart suggestions to optimize your grow schedule
          </Text>
        </UIView>

        <ContentSection
          pendingSuggestions={pendingSuggestions}
          acceptedSuggestionsList={acceptedSuggestionsList}
          handleViewDetails={handleViewDetails}
          handleDismiss={handleDismiss}
          handleVote={handleVote}
        />

        <SettingsSection onPress={handleNeverSuggest} />
        <DebugSection
          onPress={handleGenerateTestSuggestion}
          loading={loading}
        />
      </ScrollView>

      <Modal
        ref={previewModal.ref}
        snapPoints={['85%']}
        title="Adjustment Preview"
        enablePanDownToClose
        onDismiss={previewModal.dismiss}
      >
        <BottomSheetView className="flex-1">
          {selectedSuggestion && (
            <AdjustmentPreviewModal
              suggestion={selectedSuggestion}
              onAcceptAll={() => handleAcceptAll(selectedSuggestion)}
              onAcceptPartial={(taskIds) =>
                handleAcceptPartial(selectedSuggestion, taskIds)
              }
              onDecline={() => handleDecline(selectedSuggestion)}
              onClose={previewModal.dismiss}
            />
          )}
        </BottomSheetView>
      </Modal>
    </UIView>
  );
}
