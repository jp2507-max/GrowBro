/**
 * Feedback Form Screen
 * Route: /settings/support/feedback
 * Requirements: 7.5
 */

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Alert, Platform } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { z } from 'zod';

import {
  Button,
  ControlledInput,
  FocusAwareStatusBar,
  ScrollView,
  Select,
  Text,
  View,
} from '@/components/ui';
import { translate, useAuth } from '@/lib';
import { useNetworkStatus } from '@/lib/hooks/use-network-status';
import { submitFeedback } from '@/lib/support/submit-feedback';

const styles = StyleSheet.create({
  flex1: { flex: 1 },
});

const feedbackSchema = z.object({
  category: z.enum(['feature_request', 'improvement', 'compliment', 'other']),
  message: z
    .string()
    .min(10, 'settings.support.feedback.message_too_short')
    .max(1000, 'settings.support.feedback.message_too_long'),
  email: z
    .string()
    .email('settings.support.feedback.invalid_email')
    .optional()
    .or(z.literal('')),
});

type FeedbackFormData = z.infer<typeof feedbackSchema>;

// eslint-disable-next-line max-lines-per-function -- Complex form screen
export default function FeedbackScreen() {
  const router = useRouter();
  const user = useAuth.use.user();
  const { isInternetReachable } = useNetworkStatus();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<FeedbackFormData>({
    resolver: zodResolver(feedbackSchema),
    defaultValues: {
      category: 'other',
      message: '',
      email: user?.email || '',
    },
  });

  const message = watch('message');
  const characterCount = message.length;
  const characterLimit = 1000;

  const onSubmit = async (data: FeedbackFormData) => {
    setIsSubmitting(true);

    try {
      const feedback = {
        category: data.category,
        message: data.message,
        email: data.email || undefined,
        userId: user?.id,
      };

      const result = await submitFeedback(feedback);

      if (result.success) {
        Alert.alert(
          translate('settings.support.feedback.success_title'),
          translate('settings.support.feedback.success_message'),
          [
            {
              text: translate('common.ok'),
              onPress: () => router.back(),
            },
          ]
        );
      } else {
        throw new Error(result.error || 'Unknown error');
      }
    } catch (error) {
      console.error('Failed to submit feedback:', error);
      Alert.alert(
        translate('settings.support.feedback.error_title'),
        translate('settings.support.feedback.error_message')
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <FocusAwareStatusBar />

      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={
            Platform.OS === 'ios' ? 'interactive' : 'on-drag'
          }
        >
          <View className="flex-1 px-4 pb-8 pt-4">
            <Text className="mb-1 text-xl font-bold">
              {translate('settings.support.feedback.title')}
            </Text>
            <Text className="mb-6 text-sm text-neutral-600 dark:text-neutral-400">
              {translate('settings.support.feedback.description')}
            </Text>

            {/* Category */}
            <View className="mb-4">
              <Text className="mb-2 text-sm font-medium text-charcoal-900 dark:text-neutral-100">
                {translate('settings.support.feedback.category_label')}
              </Text>
              <Controller
                control={control}
                name="category"
                render={({ field: { onChange, value } }) => (
                  <Select
                    value={value}
                    onSelect={(selectedValue) => onChange(selectedValue)}
                    options={[
                      {
                        label: translate(
                          'settings.support.feedback.category.feature_request'
                        ),
                        value: 'feature_request',
                      },
                      {
                        label: translate(
                          'settings.support.feedback.category.improvement'
                        ),
                        value: 'improvement',
                      },
                      {
                        label: translate(
                          'settings.support.feedback.category.compliment'
                        ),
                        value: 'compliment',
                      },
                      {
                        label: translate(
                          'settings.support.feedback.category.other'
                        ),
                        value: 'other',
                      },
                    ]}
                    placeholder={translate(
                      'settings.support.feedback.category_placeholder'
                    )}
                  />
                )}
              />
            </View>

            {/* Message */}
            <View className="mb-4">
              <ControlledInput
                control={control}
                name="message"
                label={translate('settings.support.feedback.message_label')}
                placeholder={translate(
                  'settings.support.feedback.message_placeholder'
                )}
                multiline
                numberOfLines={8}
                error={errors.message?.message}
                accessibilityLabel={translate(
                  'settings.support.feedback.message_label'
                )}
                accessibilityHint={translate(
                  'settings.support.feedback.message_hint'
                )}
              />
              <Text
                className={`mt-1 text-right text-xs ${
                  characterCount > characterLimit
                    ? 'text-danger-600 dark:text-danger-400'
                    : 'text-neutral-600 dark:text-neutral-400'
                }`}
              >
                {characterCount} / {characterLimit}
              </Text>
            </View>

            {/* Email (optional) */}
            <View className="mb-4">
              <ControlledInput
                control={control}
                name="email"
                label={translate('settings.support.feedback.email_label')}
                placeholder={translate(
                  'settings.support.feedback.email_placeholder'
                )}
                keyboardType="email-address"
                autoCapitalize="none"
                error={errors.email?.message}
                accessibilityLabel={translate(
                  'settings.support.feedback.email_label'
                )}
                accessibilityHint={translate(
                  'settings.support.feedback.email_hint'
                )}
              />
              <Text className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                {translate('settings.support.feedback.email_hint')}
              </Text>
            </View>

            {/* Offline Warning */}
            {!isInternetReachable && (
              <View className="mb-4 rounded-lg bg-warning-50 p-3 dark:bg-warning-900/20">
                <Text className="text-sm text-warning-700 dark:text-warning-300">
                  {translate('settings.support.feedback.offline_warning')}
                </Text>
              </View>
            )}

            {/* Submit Button */}
            <Button
              label={translate('settings.support.feedback.submit')}
              onPress={handleSubmit(onSubmit)}
              loading={isSubmitting}
              disabled={isSubmitting}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}
