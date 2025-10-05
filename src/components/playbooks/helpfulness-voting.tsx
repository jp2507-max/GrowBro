import * as React from 'react';
import { Pressable } from 'react-native';

import type { HelpfulnessVote } from '@/types/ai-adjustments';

import { Text, View } from '../ui';

type Props = {
  suggestionId: string;
  currentVote?: HelpfulnessVote;
  onVote: (suggestionId: string, vote: HelpfulnessVote) => void;
};

export function HelpfulnessVoting({
  suggestionId,
  currentVote,
  onVote,
}: Props) {
  const [voted, setVoted] = React.useState(!!currentVote);
  const [vote, setVote] = React.useState<HelpfulnessVote | undefined>(
    currentVote
  );

  const handleVote = (newVote: HelpfulnessVote) => {
    setVote(newVote);
    setVoted(true);
    onVote(suggestionId, newVote);
  };

  if (voted) {
    return (
      <View
        className="rounded-lg bg-neutral-100 p-3 dark:bg-neutral-900"
        testID="voting-complete"
      >
        <Text className="text-center text-sm text-neutral-600 dark:text-neutral-400">
          Thanks for your feedback! {vote === 'helpful' ? '👍' : '👎'}
        </Text>
      </View>
    );
  }

  return (
    <View className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
      <Text className="mb-2 text-center text-sm text-neutral-700 dark:text-neutral-300">
        Was this suggestion helpful?
      </Text>
      <View className="flex-row justify-center gap-3">
        <Pressable
          accessibilityRole="button"
          onPress={() => handleVote('helpful')}
          className="dark:bg-success-950 flex-1 rounded-lg border border-success-300 bg-success-50 px-4 py-2 active:bg-success-100 dark:border-success-800"
          testID="vote-helpful"
        >
          <Text className="text-center text-success-700 dark:text-success-300">
            👍 Helpful
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => handleVote('not_helpful')}
          className="dark:bg-danger-950 flex-1 rounded-lg border border-danger-300 bg-danger-50 px-4 py-2 active:bg-danger-100 dark:border-danger-800"
          testID="vote-not-helpful"
        >
          <Text className="text-center text-danger-700 dark:text-danger-300">
            👎 Not Helpful
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
