/**
 * CommentInputFooter - Sticky messenger-style comment input
 * Design: Full-width glass input pill | Terracotta send button
 */
import * as React from 'react';
import { StyleSheet, TextInput } from 'react-native';
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
} from 'react-native-reanimated';

import { ActivityIndicator, Pressable, View } from '@/components/ui';
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
  input: {
    flex: 1,
    minHeight: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.white,
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
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

  // Detect keyboard visibility to reduce bottom padding when keyboard is shown
  const { height: keyboardHeight } = useReanimatedKeyboardAnimation();
  const isKeyboardVisible = useDerivedValue(() => keyboardHeight.value > 0);

  const animatedPaddingStyle = useAnimatedStyle(() => ({
    paddingBottom: isKeyboardVisible.value ? 8 : Math.max(bottomInset, 8),
  }));

  return (
    <Animated.View
      className="border-t border-white/10 bg-charcoal-950/90 px-4 py-2 backdrop-blur-xl"
      style={animatedPaddingStyle}
    >
      <View className="flex-row items-center gap-3">
        {/* Single Glass Pill Input */}
        <TextInput
          ref={inputRef}
          placeholder={translate('community.comment_placeholder' as TxKeyPath)}
          placeholderTextColor={colors.neutral[500]}
          value={value}
          onChangeText={onChangeText}
          multiline
          numberOfLines={1}
          maxLength={MAX_COMMENT_LENGTH}
          style={styles.input}
          accessibilityLabel={translate(
            'community.comment_placeholder' as TxKeyPath
          )}
          accessibilityHint={translate(
            'accessibility.community.write_comment_hint' as TxKeyPath
          )}
        />

        {/* Send Button */}
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
    </Animated.View>
  );
}
