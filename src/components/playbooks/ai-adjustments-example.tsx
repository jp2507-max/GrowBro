/**
 * Example implementation showing how to use AI adjustments in a plant detail screen
 * This demonstrates the complete flow: suggestion display, preview, acceptance, and voting
 */

import * as React from 'react';
import { Modal, Pressable, ScrollView } from 'react-native';

import { useAIAdjustments } from '@/lib/playbooks/use-ai-adjustments';
import type { AdjustmentSuggestion } from '@/types/ai-adjustments';

import { Text, View as UIView } from '../ui';
import { AdjustmentPreviewModal } from './adjustment-preview-modal';
import { AdjustmentSuggestionCard } from './adjustment-suggestion-card';
import { HelpfulnessVoting } from './helpfulness-voting';

type Props = {
  plantId: string;
  playbookId?: string;
};

function useAdjustmentHandlers(options: {
  acceptSuggestion: any;
  declineSuggestion: any;
  setters: {
    setAcceptedSuggestions: any;
    setShowPreview: any;
    setSelectedSuggestion: any;
  };
}) {
  const handleAcceptAll = async (
    selectedSuggestion: AdjustmentSuggestion | null
  ) => {
    if (!selectedSuggestion) return;

    try {
      await options.acceptSuggestion(selectedSuggestion.id);
      options.setters.setAcceptedSuggestions((prev: Set<string>) =>
        new Set(prev).add(selectedSuggestion.id)
      );
      options.setters.setShowPreview(false);
      options.setters.setSelectedSuggestion(null);
    } catch (error) {
      console.error('Failed to accept suggestion:', error);
    }
  };

  const handleAcceptPartial = async (
    selectedSuggestion: AdjustmentSuggestion | null,
    taskIds: string[]
  ) => {
    if (!selectedSuggestion) return;

    try {
      await options.acceptSuggestion(selectedSuggestion.id, taskIds);
      options.setters.setAcceptedSuggestions((prev: Set<string>) =>
        new Set(prev).add(selectedSuggestion.id)
      );
      options.setters.setShowPreview(false);
      options.setters.setSelectedSuggestion(null);
    } catch (error) {
      console.error('Failed to accept partial suggestion:', error);
    }
  };

  const handleDecline = async (
    selectedSuggestion: AdjustmentSuggestion | null
  ) => {
    if (!selectedSuggestion) return;

    try {
      await options.declineSuggestion(selectedSuggestion.id);
      options.setters.setShowPreview(false);
      options.setters.setSelectedSuggestion(null);
    } catch (error) {
      console.error('Failed to decline suggestion:', error);
    }
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
          className="dark:bg-success-950 mb-3 rounded-xl border border-success-200 bg-success-50 p-4 dark:border-success-800"
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
  declineSuggestion: any;
  voteHelpfulness: any;
  setNeverSuggest: any;
  generateSuggestion: any;
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

function useAdjustmentState(plantId: string, playbookId?: string) {
  const {
    suggestions,
    loading,
    generateSuggestion,
    acceptSuggestion,
    declineSuggestion,
    voteHelpfulness,
    setNeverSuggest,
  } = useAIAdjustments(plantId);

  const [selectedSuggestion, setSelectedSuggestion] =
    React.useState<AdjustmentSuggestion | null>(null);
  const [showPreview, setShowPreview] = React.useState(false);
  const [acceptedSuggestions, setAcceptedSuggestions] = React.useState<
    Set<string>
  >(new Set());

  const { handleAcceptAll, handleAcceptPartial, handleDecline } =
    useAdjustmentHandlers({
      acceptSuggestion,
      declineSuggestion,
      setters: {
        setAcceptedSuggestions,
        setShowPreview,
        setSelectedSuggestion,
      },
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
    setShowPreview(true);
  };

  const pendingSuggestions = suggestions.filter((s) => s.status === 'pending');
  const acceptedSuggestionsList = suggestions.filter((s) =>
    acceptedSuggestions.has(s.id)
  );

  return {
    loading,
    selectedSuggestion,
    showPreview,
    setShowPreview,
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
  };
}

export function AIAdjustmentsExample({ plantId, playbookId }: Props) {
  const {
    loading,
    selectedSuggestion,
    showPreview,
    setShowPreview,
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
        visible={showPreview}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowPreview(false)}
      >
        {selectedSuggestion && (
          <AdjustmentPreviewModal
            suggestion={selectedSuggestion}
            onAcceptAll={() => handleAcceptAll(selectedSuggestion)}
            onAcceptPartial={(taskIds) =>
              handleAcceptPartial(selectedSuggestion, taskIds)
            }
            onDecline={() => handleDecline(selectedSuggestion)}
            onClose={() => setShowPreview(false)}
          />
        )}
      </Modal>
    </UIView>
  );
}
