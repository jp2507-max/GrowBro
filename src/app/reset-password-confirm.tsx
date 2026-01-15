import { zodResolver } from '@hookform/resolvers/zod';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import type { SubmitHandler } from 'react-hook-form';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import * as z from 'zod';

import { useConfirmPasswordReset, validatePassword } from '@/api/auth';
import {
  Button,
  ControlledInput,
  FocusAwareStatusBar,
  Text,
  View,
} from '@/components/ui';
import { showErrorMessage, showSuccessMessage } from '@/lib';

const schema = z
  .object({
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

type FormData = z.infer<typeof schema>;

export default function ResetPasswordConfirm() {
  const { t } = useTranslation();
  const router = useRouter();
  const { token_hash } = useLocalSearchParams<{ token_hash?: string }>();
  const navTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const { handleSubmit, control } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const confirmMutation = useConfirmPasswordReset({
    onSuccess: () => {
      showSuccessMessage(t('auth.reset_password_confirm_success'));
      // Navigate to login after short delay
      if (navTimeoutRef.current) clearTimeout(navTimeoutRef.current);
      navTimeoutRef.current = setTimeout(() => {
        router.replace('/login');
      }, 2000);
    },
    onError: (error) => {
      showErrorMessage(t(error.message));
    },
  });

  React.useEffect(() => {
    return () => {
      if (navTimeoutRef.current) {
        clearTimeout(navTimeoutRef.current);
        navTimeoutRef.current = null;
      }
    };
  }, []);

  const onSubmit: SubmitHandler<FormData> = (data) => {
    confirmMutation.mutate({
      tokenHash: token_hash,
      newPassword: data.password,
    });
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
              testID="reset-password-confirm-title"
              className="pb-2 text-center text-4xl font-bold"
            >
              {t('auth.reset_password_confirm_title')}
            </Text>

            <Text className="mb-6 max-w-xs text-center text-neutral-500">
              {t('auth.reset_password_confirm_subtitle')}
            </Text>
          </View>

          <ControlledInput
            testID="password-input"
            control={control}
            name="password"
            label={t('auth.new_password_label')}
            placeholder={t('auth.new_password_placeholder')}
            secureTextEntry={true}
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
          />

          <ControlledInput
            testID="confirm-password-input"
            control={control}
            name="confirmPassword"
            label={t('auth.confirm_password_label')}
            placeholder={t('auth.confirm_password_placeholder')}
            secureTextEntry={true}
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
          />

          <Text className="mb-4 text-xs text-neutral-500">
            {t('auth.password_requirements')}
          </Text>

          <Button
            testID="confirm-reset-button"
            label={t('auth.reset_password_confirm_button')}
            onPress={handleSubmit(onSubmit)}
            loading={confirmMutation.isPending}
            disabled={confirmMutation.isPending}
          />
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
