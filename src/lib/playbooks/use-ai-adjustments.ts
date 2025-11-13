import { useDatabase } from '@nozbe/watermelondb/hooks';
import * as React from 'react';

import type {
  AdjustmentContext,
  AdjustmentSuggestion,
  HelpfulnessVote,
} from '@/types/ai-adjustments';

import type { AnalyticsClient } from '../analytics';
import { getAnalyticsClient } from '../analytics-registry';
import { AIAdjustmentService } from './ai-adjustment-service';

function useLoadSuggestions(service: AIAdjustmentService, plantId: string) {
  const [suggestions, setSuggestions] = React.useState<AdjustmentSuggestion[]>(
    []
  );
  const [acceptedSuggestions, setAcceptedSuggestions] = React.useState<
    AdjustmentSuggestion[]
  >([]);
  const [loading, setLoading] = React.useState(false);

  const loadSuggestions = React.useCallback(async () => {
    setLoading(true);
    try {
      const [pending, accepted] = await Promise.all([
        service.getPendingSuggestions(plantId),
        service.getAcceptedSuggestions(plantId),
      ]);
      setSuggestions(pending);
      setAcceptedSuggestions(accepted);
    } catch (error) {
      console.error('[useAIAdjustments] Failed to load suggestions:', error);
    } finally {
      setLoading(false);
    }
  }, [plantId, service]);

  return {
    suggestions,
    acceptedSuggestions,
    setSuggestions,
    setAcceptedSuggestions,
    loading,
    setLoading,
    loadSuggestions,
  };
}

function useGenerateSuggestion(options: {
  service: AIAdjustmentService;
  analytics: AnalyticsClient;
  setters: {
    setSuggestions: React.Dispatch<
      React.SetStateAction<AdjustmentSuggestion[]>
    >;
    setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  };
}) {
  return React.useCallback(
    async (context: AdjustmentContext) => {
      options.setters.setLoading(true);
      try {
        const suggestion = await options.service.generateSuggestions(context);
        if (suggestion) {
          options.setters.setSuggestions((prev) => [...prev, suggestion]);

          options.analytics.track('ai_adjustment_suggested', {
            playbookId: suggestion.playbookId || '',
            adjustmentType: suggestion.suggestionType,
            confidence: suggestion.confidence,
          });
        }
        return suggestion;
      } catch (error) {
        console.error(
          '[useAIAdjustments] Failed to generate suggestion:',
          error
        );
        return null;
      } finally {
        options.setters.setLoading(false);
      }
    },
    [options]
  );
}

function useAcceptSuggestion(options: {
  service: AIAdjustmentService;
  suggestions: AdjustmentSuggestion[];
  acceptedSuggestions: AdjustmentSuggestion[];
  analytics: AnalyticsClient;
  setters: {
    setAcceptedSuggestions: React.Dispatch<
      React.SetStateAction<AdjustmentSuggestion[]>
    >;
  };
}) {
  return React.useCallback(
    async (suggestionId: string, taskIds?: string[]) => {
      try {
        await options.service.applySuggestion(suggestionId, taskIds);

        const suggestion = options.suggestions.find(
          (s) => s.id === suggestionId
        );
        if (suggestion) {
          const updatedSuggestion: AdjustmentSuggestion = {
            ...suggestion,
            status: 'accepted',
            acceptedTasks: taskIds,
            updatedAt: Date.now(),
          };

          options.setters.setAcceptedSuggestions((prev) => [
            ...prev,
            updatedSuggestion,
          ]);

          options.analytics.track('ai_adjustment_applied', {
            playbookId: suggestion.playbookId || '',
            adjustmentType: suggestion.suggestionType,
            applied: true,
          });

          return updatedSuggestion;
        }
      } catch (error) {
        console.error('[useAIAdjustments] Failed to accept suggestion:', error);
        throw error;
      }
    },
    [options]
  );
}

function useDeclineSuggestion(options: {
  service: AIAdjustmentService;
  suggestions: AdjustmentSuggestion[];
  acceptedSuggestions: AdjustmentSuggestion[];
  analytics: AnalyticsClient;
  setters: {
    setAcceptedSuggestions: React.Dispatch<
      React.SetStateAction<AdjustmentSuggestion[]>
    >;
  };
}) {
  return React.useCallback(
    async (suggestionId: string, reason?: string) => {
      try {
        await options.service.declineSuggestion(suggestionId);

        const suggestion = [
          ...options.suggestions,
          ...options.acceptedSuggestions,
        ].find((s) => s.id === suggestionId);
        if (suggestion) {
          // Remove from accepted suggestions if it was accepted
          options.setters.setAcceptedSuggestions((prev) =>
            prev.filter((s) => s.id !== suggestionId)
          );

          options.analytics.track('ai_adjustment_declined', {
            playbookId: suggestion.playbookId || '',
            adjustmentType: suggestion.suggestionType,
            reason,
          });
        }
      } catch (error) {
        console.error(
          '[useAIAdjustments] Failed to decline suggestion:',
          error
        );
        throw error;
      }
    },
    [options]
  );
}

function useVoteAndPreference(
  service: AIAdjustmentService,
  setSuggestions: React.Dispatch<React.SetStateAction<AdjustmentSuggestion[]>>,
  plantId: string
) {
  const voteHelpfulness = React.useCallback(
    async (suggestionId: string, vote: HelpfulnessVote) => {
      try {
        await service.voteHelpfulness(suggestionId, vote);

        setSuggestions((prev) =>
          prev.map((s) =>
            s.id === suggestionId ? { ...s, helpfulnessVote: vote } : s
          )
        );
      } catch (error) {
        console.error('[useAIAdjustments] Failed to vote:', error);
        throw error;
      }
    },
    [service, setSuggestions]
  );

  const setNeverSuggest = React.useCallback(
    async (neverSuggest: boolean) => {
      try {
        await service.setNeverSuggest(plantId, neverSuggest);
      } catch (error) {
        console.error('[useAIAdjustments] Failed to set preference:', error);
        throw error;
      }
    },
    [service, plantId]
  );

  return { voteHelpfulness, setNeverSuggest };
}

export function useAIAdjustments(plantId: string) {
  const database = useDatabase();
  const analytics = getAnalyticsClient();
  const serviceRef = React.useRef<AIAdjustmentService | null>(null);

  if (!serviceRef.current) {
    serviceRef.current = new AIAdjustmentService(database);
  }

  const service = serviceRef.current;

  const {
    suggestions,
    acceptedSuggestions,
    setSuggestions,
    setAcceptedSuggestions,
    loading,
    setLoading,
    loadSuggestions,
  } = useLoadSuggestions(service, plantId);

  const generateSuggestion = useGenerateSuggestion({
    service,
    analytics,
    setters: { setSuggestions, setLoading },
  });

  const acceptSuggestion = useAcceptSuggestion({
    service,
    suggestions,
    acceptedSuggestions,
    analytics,
    setters: { setAcceptedSuggestions },
  });

  const declineSuggestion = useDeclineSuggestion({
    service,
    suggestions,
    acceptedSuggestions,
    analytics,
    setters: { setAcceptedSuggestions },
  });

  const { voteHelpfulness, setNeverSuggest } = useVoteAndPreference(
    service,
    setSuggestions,
    plantId
  );

  React.useEffect(() => {
    loadSuggestions();
  }, [loadSuggestions]);

  return {
    suggestions,
    acceptedSuggestions,
    loading,
    generateSuggestion,
    acceptSuggestion,
    declineSuggestion,
    voteHelpfulness,
    setNeverSuggest,
    refresh: loadSuggestions,
  };
}
