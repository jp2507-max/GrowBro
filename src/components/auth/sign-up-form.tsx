import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'expo-router';
import React from 'react';
import type { SubmitHandler } from 'react-hook-form';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import * as z from 'zod';

import { useSignUp, validatePassword } from '@/api/auth';
import { Button, ControlledInput, Text, View } from '@/components/ui';
import { showErrorMessage, showSuccessMessage } from '@/lib';

const schema = z
  .object({
    email: z
      .string()
      .min(1, 'auth.validation_email_required')
      .email('auth.validation_email_invalid'),
    password: z
      .string()
      .min(8, 'auth.validation_password_min')
      .refine(
        (val) => validatePassword(val).isValid,
        'auth.validation_password_pattern'
      ),
    confirmPassword: z
      .string()
      .min(1, 'auth.validation_confirm_password_required'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'auth.validation_passwords_match',
    path: ['confirmPassword'],
  });

export type SignUpFormData = z.infer<typeof schema>;

export type SignUpFormProps = {
  onSuccess?: () => void;
};

export const SignUpForm = ({ onSuccess }: SignUpFormProps) => {
  const { t } = useTranslation();
  const { handleSubmit, control } = useForm<SignUpFormData>({
    resolver: zodResolver(schema),
  });

  const signUpMutation = useSignUp({
    onSuccess: () => {
      showSuccessMessage(t('auth.email_verification_sent'));
      onSuccess?.();
    },
    onError: (error) => {
      console.error('[SignUp] sign-up failed', error);
      showErrorMessage(t(error.message));
    },
  });

  const onSubmit: SubmitHandler<SignUpFormData> = (data) => {
    signUpMutation.mutate({
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
            testID="signup-title"
            className="pb-2 text-center text-4xl font-bold"
          >
            {t('auth.sign_up_title')}
          </Text>

          <Text className="mb-6 max-w-xs text-center text-neutral-500">
            {t('auth.sign_up_subtitle')}
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
          autoComplete="password-new"
        />

        <ControlledInput
          testID="confirm-password-input"
          control={control}
          name="confirmPassword"
          label={t('auth.confirm_password_label')}
          placeholder={t('auth.confirm_password_placeholder')}
          secureTextEntry={true}
          autoCapitalize="none"
          autoComplete="password-new"
        />

        <Text className="mb-4 text-xs text-neutral-500">
          {t('auth.password_requirements')}
        </Text>

        <Button
          testID="signup-button"
          label={t('auth.sign_up_button')}
          onPress={handleSubmit(onSubmit)}
          loading={signUpMutation.isPending}
          disabled={signUpMutation.isPending}
        />

        <View className="mt-6 flex-row items-center justify-center gap-1">
          <Text className="text-neutral-600">
            {t('auth.already_have_account')}
          </Text>
          <Link href="/login" asChild>
            <Text className="font-semibold text-primary-600">
              {t('auth.sign_in_link')}
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
