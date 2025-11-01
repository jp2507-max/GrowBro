import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useResendVerificationEmail } from '@/api/auth';
import { Button, Text, View } from '@/components/ui';
import { showErrorMessage, showSuccessMessage } from '@/lib';
import { useAuth } from '@/lib/auth';

export type EmailVerificationBannerProps = {
  onDismiss?: () => void;
};

export const EmailVerificationBanner = ({
  onDismiss,
}: EmailVerificationBannerProps) => {
  const { t } = useTranslation();
  const user = useAuth.use.user();
  const [isDismissed, setIsDismissed] = useState(false);

  const resendMutation = useResendVerificationEmail({
    onSuccess: () => {
      showSuccessMessage(t('auth.email_verification_sent'));
    },
    onError: (error) => {
      showErrorMessage(t(error.message));
    },
  });

  // Don't show if user is verified or banner is dismissed
  if (!user || user.email_confirmed_at || isDismissed) {
    return null;
  }

  const handleDismiss = () => {
    setIsDismissed(true);
    onDismiss?.();
  };

  const handleResend = () => {
    if (user.email) {
      resendMutation.mutate({ email: user.email });
    }
  };

  return (
    <View
      testID="email-verification-banner"
      className="m-4 rounded-lg border border-primary-200 bg-primary-50 p-4"
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-1">
          <Text className="mb-1 font-semibold text-primary-900">
            {t('auth.email_verification_banner_title')}
          </Text>
          <Text className="mb-3 text-sm text-primary-700">
            {t('auth.email_verification_banner_message')}
          </Text>

          <View className="flex-row gap-2">
            <Button
              testID="resend-verification-button"
              label={t('auth.email_verification_resend')}
              onPress={handleResend}
              loading={resendMutation.isPending}
              disabled={resendMutation.isPending}
              variant="secondary"
              className="flex-1"
            />
            <Button
              testID="dismiss-banner-button"
              label={t('common.dismiss')}
              onPress={handleDismiss}
              variant="outline"
              className="flex-1"
            />
          </View>
        </View>
      </View>
    </View>
  );
};
