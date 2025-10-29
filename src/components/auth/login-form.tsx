import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'expo-router';
import React from 'react';
import type { SubmitHandler } from 'react-hook-form';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import * as z from 'zod';

import { useSignIn } from '@/api/auth';
import { Button, ControlledInput, Text, View } from '@/components/ui';
import { showErrorMessage } from '@/lib';

const schema = z.object({
  email: z
    .string()
    .min(1, 'auth.validation_email_required')
    .email('auth.validation_email_invalid'),
  password: z.string().min(1, 'auth.validation_password_required'),
});

export type LoginFormData = z.infer<typeof schema>;

export type LoginFormProps = {
  onSuccess?: () => void;
};

export const LoginForm = ({ onSuccess }: LoginFormProps) => {
  const { t } = useTranslation();
  const { handleSubmit, control } = useForm<LoginFormData>({
    resolver: zodResolver(schema),
  });

  const signInMutation = useSignIn({
    onSuccess: () => {
      onSuccess?.();
    },
    onError: (error) => {
      showErrorMessage(t(error.message));
    },
  });

  const onSubmit: SubmitHandler<LoginFormData> = (data) => {
    signInMutation.mutate({
      email: data.email,
      password: data.password,
    });
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboardAvoider}
      behavior="padding"
      keyboardVerticalOffset={10}
    >
      <View className="flex-1 justify-center p-4">
        <View className="items-center justify-center">
          <Text
            testID="login-title"
            className="pb-2 text-center text-4xl font-bold"
          >
            {t('auth.sign_in_title')}
          </Text>

          <Text className="mb-6 max-w-xs text-center text-neutral-500">
            {t('auth.sign_in_subtitle')}
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

        <ControlledInput
          testID="password-input"
          control={control}
          name="password"
          label={t('auth.password_label')}
          placeholder={t('auth.password_placeholder')}
          secureTextEntry={true}
          autoCapitalize="none"
          autoComplete="password"
        />

        <View className="mb-4 flex-row justify-end">
          <Link href="/reset-password" asChild>
            <Text className="text-sm text-primary-600">
              {t('auth.forgot_password_link')}
            </Text>
          </Link>
        </View>

        <Button
          testID="login-button"
          label={t('auth.sign_in_button')}
          onPress={handleSubmit(onSubmit)}
          loading={signInMutation.isPending}
          disabled={signInMutation.isPending}
        />

        <View className="mt-6 flex-row items-center justify-center gap-1">
          <Text className="text-neutral-600">
            {t('auth.dont_have_account')}
          </Text>
          <Link href="/sign-up" asChild>
            <Text className="font-semibold text-primary-600">
              {t('auth.sign_up_link')}
            </Text>
          </Link>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  keyboardAvoider: {
    flex: 1,
  },
});
