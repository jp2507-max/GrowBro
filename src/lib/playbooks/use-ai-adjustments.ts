import { useDatabase } from '@nozbe/watermelondb/hooks';
import * as React from 'react';

import type {
  AdjustmentContext,
  AdjustmentSuggestion,
  HelpfulnessVote,
} from '@/types/ai-adjustments';

import { getAnalyticsClient } from '../analytics-registry';
import { AIAdjustmentService } from './ai-adjustment-service';

function useLoadSuggestions(service: AIAdjustmentService, plantId: string) {
  const [suggestions, setSuggestions] = React.useState<AdjustmentSuggestion[]>(
    []
  );
  const [loading, setLoading] = React.useState(false);

  const loadSuggestions = React.useCallback(async () => {
    setLoading(true);
    try {
      const pending = await service.getPendingSuggestions(plantId);
      setSuggestions(pending);
    } catch (error) {
      console.error('[useAIAdjustments] Failed to load suggestions:', error);
    } finally {
      setLoading(false);
    }
  }, [plantId, service]);

  return { suggestions, setSuggestions, loading, setLoading, loadSuggestions };
}

function useGenerateSuggestion(options: {
  service: AIAdjustmentService;
  analytics: any;
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
  analytics: any;
  loadSuggestions: () => Promise<void>;
}) {
  return React.useCallback(
    async (suggestionId: string, taskIds?: string[]) => {
      try {
        await options.service.applySuggestion(suggestionId, taskIds);

        const suggestion = options.suggestions.find(
          (s) => s.id === suggestionId
        );
        if (suggestion) {
          options.analytics.track('ai_adjustment_applied', {
            playbookId: suggestion.playbookId || '',
            adjustmentType: suggestion.suggestionType,
            applied: true,
          });
        }

        await options.loadSuggestions();
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
  analytics: any;
  loadSuggestions: () => Promise<void>;
}) {
  return React.useCallback(
    async (suggestionId: string, reason?: string) => {
      try {
        await options.service.declineSuggestion(suggestionId);

        const suggestion = options.suggestions.find(
          (s) => s.id === suggestionId
        );
        if (suggestion) {
          options.analytics.track('ai_adjustment_declined', {
            playbookId: suggestion.playbookId || '',
            adjustmentType: suggestion.suggestionType,
            reason,
          });
        }

        await options.loadSuggestions();
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

  const { suggestions, setSuggestions, loading, setLoading, loadSuggestions } =
    useLoadSuggestions(service, plantId);

  const generateSuggestion = useGenerateSuggestion({
    service,
    analytics,
    setters: { setSuggestions, setLoading },
  });

  const acceptSuggestion = useAcceptSuggestion({
    service,
    suggestions,
    analytics,
    loadSuggestions,
  });

  const declineSuggestion = useDeclineSuggestion({
    service,
    suggestions,
    analytics,
    loadSuggestions,
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
    loading,
    generateSuggestion,
    acceptSuggestion,
    declineSuggestion,
    voteHelpfulness,
    setNeverSuggest,
    refresh: loadSuggestions,
  };
}
