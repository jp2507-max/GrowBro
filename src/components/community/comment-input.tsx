/**
 * CommentInput component
 *
 * Handles comment creation with:
 * - Real-time character count (500 max)
 * - Pending state indicator
 * - Validation feedback
 * - Submit button state management
 */

import React from 'react';

import { useCreateComment } from '@/api/community';
import { Button, Input, Text, View } from '@/components/ui';

interface CommentInputProps {
  postId: string;
  onCommentCreated?: () => void;
  testID?: string;
}

const MAX_COMMENT_LENGTH = 500;

export function CommentInput({
  postId,
  onCommentCreated,
  testID = 'comment-input',
}: CommentInputProps): React.ReactElement {
  const [body, setBody] = React.useState('');
  const createCommentMutation = useCreateComment();

  const characterCount = body.length;
  const isOverLimit = characterCount > MAX_COMMENT_LENGTH;
  const isEmpty = body.trim().length === 0;
  const canSubmit =
    !isEmpty && !isOverLimit && !createCommentMutation.isPending;

  const handleSubmit = React.useCallback(() => {
    if (!canSubmit) return;

    createCommentMutation.mutate(
      { postId, body: body.trim() },
      {
        onSuccess: () => {
          setBody('');
          onCommentCreated?.();
        },
      }
    );
  }, [canSubmit, postId, body, createCommentMutation, onCommentCreated]);

  const characterCountColor = React.useMemo(() => {
    if (isOverLimit) return 'text-danger-600 dark:text-danger-400';
    if (characterCount > MAX_COMMENT_LENGTH * 0.9)
      return 'text-warning-600 dark:text-warning-400';
    return 'text-neutral-500 dark:text-neutral-400';
  }, [isOverLimit, characterCount]);

  return (
    <View className="gap-2" testID={testID}>
      <Input
        value={body}
        onChangeText={setBody}
        placeholder="Share your thoughts..."
        multiline
        numberOfLines={3}
        maxLength={MAX_COMMENT_LENGTH + 50} // Allow typing slightly over to show warning
        className="min-h-20 rounded-lg border border-neutral-300 p-3 dark:border-neutral-700"
        testID={`${testID}-field`}
        accessibilityLabel="Write a comment"
        accessibilityHint="Type your comment here. Maximum 500 characters."
      />
      <View className="flex-row items-center justify-between">
        <Text
          className={`text-xs ${characterCountColor}`}
          testID={`${testID}-count`}
        >
          {characterCount}/{MAX_COMMENT_LENGTH}
          {isOverLimit &&
            ` (${characterCount - MAX_COMMENT_LENGTH} characters over limit)`}
        </Text>
        <Button
          label={createCommentMutation.isPending ? 'Posting...' : 'Post'}
          onPress={handleSubmit}
          disabled={!canSubmit}
          loading={createCommentMutation.isPending}
          size="sm"
          testID={`${testID}-submit`}
        />
      </View>
      {isOverLimit && (
        <Text
          className="text-xs text-danger-600 dark:text-danger-400"
          testID={`${testID}-error`}
        >
          Comment exceeds maximum length of 500 characters
        </Text>
      )}
    </View>
  );
}
