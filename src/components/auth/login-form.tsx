import { zodResolver } from '@hookform/resolvers/zod';
import {
  GoogleSignin,
  GoogleSigninButton,
  isErrorWithCode,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Link } from 'expo-router';
import React from 'react';
import type { Control, SubmitHandler } from 'react-hook-form';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import * as z from 'zod';

import { useSignIn, useSignInWithIdToken } from '@/api/auth';
import { Button, ControlledInput, Text, View } from '@/components/ui';
import { showErrorMessage } from '@/lib';
import { createNoncePair } from '@/lib/utils/nonce';

const schema = z.object({
  email: z
    .string()
    .min(1, 'auth.validation_email_required')
    .email('auth.validation_email_invalid'),
  password: z.string().min(1, 'auth.validation_password_required'),
});

type LoginFormContentProps = {
  control: Control<LoginFormData>;
  isSubmitting: boolean;
  onSubmit: () => void;
  onApplePress: () => void;
  onGooglePress: () => void;
  isAppleAvailable: boolean;
  isOauthLoading: boolean;
};

function LoginFormContent({
  control,
  isSubmitting,
  onSubmit,
  onApplePress,
  onGooglePress,
  isAppleAvailable,
  isOauthLoading,
}: LoginFormContentProps) {
  const { t } = useTranslation();

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
          secureTextEntry
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
          onPress={onSubmit}
          loading={isSubmitting}
          disabled={isSubmitting}
        />

        <AuthDivider label={t('auth.or_divider')} />
        <AppleSignInNativeSection
          isVisible={isAppleAvailable}
          onPress={onApplePress}
          disabled={isOauthLoading}
        />
        <GoogleSignInNativeSection
          onPress={onGooglePress}
          disabled={isOauthLoading}
          label={t('auth.sign_in_with_google')}
          testID="google-sign-in-button"
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
}

export type LoginFormData = z.infer<typeof schema>;

export type LoginFormProps = {
  onSuccess?: () => void;
};

export const LoginForm: React.FC<LoginFormProps> = ({
  onSuccess,
}: LoginFormProps) => {
  const { handleSubmit, control } = useForm<LoginFormData>({
    resolver: zodResolver(schema),
  });

  const { handleCredentialsSubmit, isSubmitting } =
    useEmailPasswordSignIn(onSuccess);
  const {
    handleAppleSignIn,
    handleGoogleSignIn,
    isAppleAvailable,
    isOauthLoading,
  } = useNativeOAuthSignIn(onSuccess);

  const handleFormSubmit = handleSubmit(handleCredentialsSubmit);

  return (
    <LoginFormContent
      control={control}
      isSubmitting={isSubmitting}
      onSubmit={handleFormSubmit}
      onApplePress={handleAppleSignIn}
      onGooglePress={handleGoogleSignIn}
      isAppleAvailable={isAppleAvailable}
      isOauthLoading={isOauthLoading}
    />
  );
};

function useEmailPasswordSignIn(onSuccess?: () => void) {
  const { t } = useTranslation();
  const { mutate, isPending } = useSignIn({
    onSuccess: () => {
      onSuccess?.();
    },
    onError: (error) => {
      showErrorMessage(t(error.message));
    },
  });

  const handleCredentialsSubmit = React.useCallback<
    SubmitHandler<LoginFormData>
  >(
    (data) => {
      mutate({
        email: data.email,
        password: data.password,
      });
    },
    [mutate]
  );

  return {
    handleCredentialsSubmit,
    isSubmitting: isPending,
  };
}

// Helper to check Apple Sign-In availability. Extracted to keep hook small.
async function checkAppleAvailable(): Promise<boolean> {
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

function useNativeOAuthSignIn(onSuccess?: () => void) {
  const { t } = useTranslation();
  const [isAppleAvailable, setIsAppleAvailable] = React.useState(false);
  const { mutate, isPending } = useSignInWithIdToken({
    onSuccess: () => {
      onSuccess?.();
    },
    onError: (error) => {
      showErrorMessage(t(error.message));
    },
  });

  React.useEffect(() => {
    let isMounted = true;
    checkAppleAvailable().then((available) => {
      if (isMounted) setIsAppleAvailable(available);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const handleAppleSignIn = React.useCallback(async () => {
    try {
      const { rawNonce, hashedNonce } = await createNoncePair();
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });

      if (!credential.identityToken) {
        showErrorMessage(t('auth.error_oauth_failed', { provider: 'Apple' }));
        return;
      }

      mutate({
        provider: 'apple',
        idToken: credential.identityToken,
        nonce: rawNonce,
      });
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'ERR_REQUEST_CANCELED'
      ) {
        return;
      }
      showErrorMessage(t('auth.error_oauth_failed', { provider: 'Apple' }));
    }
  }, [mutate, t]);

  const handleGoogleSignIn = React.useCallback(async () => {
    try {
      await GoogleSignin.hasPlayServices({
        showPlayServicesUpdateDialog: true,
      });

      const response = await GoogleSignin.signIn();

      if (response.type !== 'success') {
        return;
      }

      const idToken = response.data.idToken;

      if (!idToken) {
        showErrorMessage(t('auth.error_oauth_failed', { provider: 'Google' }));
        return;
      }

      mutate({
        provider: 'google',
        idToken,
      });
    } catch (error) {
      if (isErrorWithCode(error)) {
        if (
          error.code === statusCodes.SIGN_IN_CANCELLED ||
          error.code === statusCodes.IN_PROGRESS
        ) {
          return;
        }

        if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
          showErrorMessage(
            t('auth.error_oauth_failed', { provider: 'Google' })
          );
          return;
        }
      }

      showErrorMessage(t('auth.error_oauth_failed', { provider: 'Google' }));
    }
  }, [mutate, t]);

  return {
    handleAppleSignIn,
    handleGoogleSignIn,
    isAppleAvailable,
    isOauthLoading: isPending,
  };
}

const styles = StyleSheet.create({
  keyboardAvoider: {
    flex: 1,
  },
  appleButton: {
    height: 44,
    width: '100%',
  },
  googleButton: {
    width: '100%',
    height: 48,
  },
});

type AppleSignInNativeSectionProps = {
  isVisible: boolean;
  onPress: () => void;
  disabled: boolean;
};

function AppleSignInNativeSection({
  isVisible,
  onPress,
  disabled,
}: AppleSignInNativeSectionProps) {
  const handlePress = React.useCallback(() => {
    if (disabled) {
      return;
    }

    onPress();
  }, [disabled, onPress]);

  if (!isVisible) {
    return null;
  }

  return (
    <View className={disabled ? 'mt-4 opacity-50' : 'mt-4'}>
      <AppleAuthentication.AppleAuthenticationButton
        buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
        buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
        cornerRadius={8}
        style={styles.appleButton}
        onPress={handlePress}
      />
    </View>
  );
}

type GoogleSignInNativeSectionProps = {
  onPress: () => void;
  disabled: boolean;
  label: string;
  testID?: string;
};

function GoogleSignInNativeSection({
  onPress,
  disabled,
  label,
  testID,
}: GoogleSignInNativeSectionProps) {
  return (
    <View className="mt-3">
      <GoogleSigninButton
        size={GoogleSigninButton.Size.Wide}
        color={GoogleSigninButton.Color.Dark}
        onPress={onPress}
        disabled={disabled}
        style={styles.googleButton}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={label}
        testID={testID}
      />
    </View>
  );
}

type AuthDividerProps = {
  label: string;
};

function AuthDivider({ label }: AuthDividerProps) {
  return (
    <View className="my-4 flex-row items-center">
      <View className="h-px flex-1 bg-neutral-300" />
      <Text className="mx-3 text-sm text-neutral-500">{label}</Text>
      <View className="h-px flex-1 bg-neutral-300" />
    </View>
  );
}
