/**
 * CommentInputFooter - Sticky messenger-style comment input
 */
import * as React from 'react';
import { StyleSheet, type TextInput } from 'react-native';

import { ActivityIndicator, Input, Pressable, View } from '@/components/ui';
import colors from '@/components/ui/colors';
import { Send } from '@/components/ui/icons';
import { translate, type TxKeyPath } from '@/lib/i18n';

const MAX_COMMENT_LENGTH = 500;

type CommentInputFooterProps = {
  value: string;
  onChangeText: (text: string) => void;
  onSubmit: () => void;
  isPending: boolean;
  bottomInset: number;
  inputRef?: React.RefObject<TextInput | null>;
};

const styles = StyleSheet.create({
  borderlessInput: {
    borderWidth: 0,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  sendButtonActive: {
    backgroundColor: colors.terracotta[500],
    opacity: 1,
  },
  sendButtonInactive: {
    backgroundColor: colors.terracotta[500],
    opacity: 0.5,
  },
});

export function CommentInputFooter({
  value,
  onChangeText,
  onSubmit,
  isPending,
  bottomInset,
  inputRef,
}: CommentInputFooterProps): React.ReactElement {
  const isOverLimit = value.length > MAX_COMMENT_LENGTH;
  const isEmpty = value.trim().length === 0;
  const isDisabled = isEmpty || isOverLimit || isPending;

  return (
    <View
      className="border-t border-neutral-100 bg-white px-4 py-3 dark:border-white/5 dark:bg-charcoal-950"
      style={{ paddingBottom: Math.max(bottomInset, 32) }}
    >
      <View className="flex-row items-center">
        {/* Messenger-style rounded input */}
        <View className="mr-3 min-h-[44px] flex-1 flex-row items-center rounded-full bg-neutral-100 px-5 py-3 dark:bg-white/5">
          <Input
            ref={inputRef}
            placeholder={translate(
              'community.comment_placeholder' as TxKeyPath
            )}
            placeholderTextColor={colors.neutral[400]}
            value={value}
            onChangeText={onChangeText}
            multiline
            numberOfLines={1}
            maxLength={MAX_COMMENT_LENGTH + 50}
            className="min-h-[24px] flex-1 border-0 bg-transparent text-base text-neutral-900 dark:text-neutral-100"
            style={styles.borderlessInput}
          />
        </View>

        {/* Circular Send Button */}
        <Pressable
          onPress={onSubmit}
          disabled={isDisabled}
          accessibilityRole="button"
          accessibilityLabel={translate('community.post_comment' as TxKeyPath)}
          accessibilityHint={translate(
            'accessibility.community.post_comment_hint' as TxKeyPath
          )}
          accessibilityState={{ disabled: isDisabled }}
          style={[
            styles.sendButton,
            isDisabled ? styles.sendButtonInactive : styles.sendButtonActive,
          ]}
        >
          {isPending ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Send width={20} height={20} color="white" />
          )}
        </Pressable>
      </View>
    </View>
  );
}
