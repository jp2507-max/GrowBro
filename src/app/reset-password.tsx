import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'expo-router';
import React from 'react';
import type { SubmitHandler } from 'react-hook-form';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import * as z from 'zod';

import { useResetPassword } from '@/api/auth';
import {
  Button,
  ControlledInput,
  FocusAwareStatusBar,
  Text,
  View,
} from '@/components/ui';
import { showErrorMessage, showSuccessMessage } from '@/lib';

const schema = z.object({
  email: z
    .string()
    .min(1, 'auth.validation_email_required')
    .email('auth.validation_email_invalid'),
});

type FormData = z.infer<typeof schema>;

export default function ResetPassword() {
  const { t } = useTranslation();
  const { handleSubmit, control } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const resetMutation = useResetPassword({
    onSuccess: () => {
      showSuccessMessage(t('auth.reset_password_success'));
      // Keep user on screen to see success message
    },
    onError: (error) => {
      showErrorMessage(t(error.message));
    },
  });

  const onSubmit: SubmitHandler<FormData> = (data) => {
    resetMutation.mutate({ email: data.email });
  };

  return (
    <>
      <FocusAwareStatusBar />
      <KeyboardAvoidingView
        style={styles.keyboardAvoider}
        behavior="padding"
        keyboardVerticalOffset={10}
      >
        <View className="flex-1 justify-center p-4">
          <View className="items-center justify-center">
            <Text
              testID="reset-password-title"
              className="pb-2 text-center text-4xl font-bold"
            >
              {t('auth.reset_password_title')}
            </Text>

            <Text className="mb-6 max-w-xs text-center text-neutral-500">
              {t('auth.reset_password_subtitle')}
            </Text>
          </View>

          <ControlledInput
            testID="email-input"
            control={control}
            name="email"
            label={t('auth.email_label')}
            placeholder={t('auth.email_placeholder')}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />

          <Button
            testID="reset-password-button"
            label={t('auth.reset_password_button')}
            onPress={handleSubmit(onSubmit)}
            loading={resetMutation.isPending}
            disabled={resetMutation.isPending}
          />

          <View className="mt-6 flex-row items-center justify-center">
            <Link href="/login" asChild>
              <Text className="font-semibold text-primary-600">
                {t('auth.back_to_login')}
              </Text>
            </Link>
          </View>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  keyboardAvoider: {
    flex: 1,
  },
});
