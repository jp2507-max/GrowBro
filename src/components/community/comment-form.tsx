/**
 * CommentForm component
 *
 * Form for submitting comments with:
 * - Character limit validation (500 chars)
 * - Character counter
 * - Submit button (disabled when empty or over limit)
 * - Optimistic posting with pending/failed states
 */

import React from 'react';
import { type TextInput } from 'react-native';

import { useCreateComment } from '@/api/community';
import { Button, Input, Text, View } from '@/components/ui';
import { translate } from '@/lib/i18n';

interface CommentFormProps {
  postId: string;
  onCommentCreated?: () => void;
  testID?: string;
}

const MAX_COMMENT_LENGTH = 500;

export function CommentForm({
  postId,
  onCommentCreated,
  testID = 'comment-form',
}: CommentFormProps): React.ReactElement {
  const [body, setBody] = React.useState('');
  const inputRef = React.useRef<TextInput>(null);
  const createMutation = useCreateComment();

  const isOverLimit = body.length > MAX_COMMENT_LENGTH;
  const isEmpty = body.trim().length === 0;
  const isSubmitDisabled = isEmpty || isOverLimit || createMutation.isPending;

  const handleSubmit = React.useCallback(async () => {
    if (isSubmitDisabled) return;

    try {
      await createMutation.mutateAsync({
        postId,
        body: body.trim(),
      });
      setBody('');
      inputRef.current?.blur();
      onCommentCreated?.();
    } catch (error) {
      console.error('Create comment failed:', error);
    }
  }, [isSubmitDisabled, createMutation, postId, body, onCommentCreated]);

  const characterCountColor = React.useMemo(() => {
    if (isOverLimit) return 'text-danger-600 dark:text-danger-400';
    if (body.length > MAX_COMMENT_LENGTH * 0.9)
      return 'text-warning-600 dark:text-warning-400';
    return 'text-neutral-500 dark:text-neutral-400';
  }, [isOverLimit, body.length]);

  return (
    <View
      className="border-t border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"
      testID={testID}
    >
      <Input
        ref={inputRef}
        placeholder={translate('community.comment_placeholder')}
        value={body}
        onChangeText={setBody}
        multiline
        numberOfLines={3}
        maxLength={MAX_COMMENT_LENGTH + 50}
        className="mb-2 min-h-[80px] rounded-xl border border-neutral-200 bg-neutral-100 p-3 text-neutral-900 dark:border-white/10 dark:bg-white/5 dark:text-neutral-100"
        testID={`${testID}-input`}
      />

      <View className="flex-row items-center justify-between">
        <Text
          className={`text-xs ${characterCountColor}`}
          testID={`${testID}-char-count`}
        >
          {body.length} / {MAX_COMMENT_LENGTH}
        </Text>

        <Button
          label={
            createMutation.isPending
              ? translate('community.posting')
              : translate('community.post_comment')
          }
          onPress={handleSubmit}
          disabled={isSubmitDisabled}
          size="sm"
          testID={`${testID}-submit`}
        />
      </View>

      {isOverLimit && (
        <Text
          className="mt-2 text-xs text-danger-600 dark:text-danger-400"
          testID={`${testID}-error`}
        >
          {translate('community.comment_too_long')}
        </Text>
      )}
    </View>
  );
}
