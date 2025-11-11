import * as React from 'react';
import { Modal } from 'react-native';

import { Button, Input, Text, View } from '@/components/ui';
import { translate } from '@/lib';
import { openLinkInBrowser } from '@/lib/utils';

type PendingMfaEnrollment = {
  factorId: string;
  secret: string;
  uri: string;
  friendlyName?: string;
};

type MfaSetupModalProps = {
  visible: boolean;
  pendingEnrollment: PendingMfaEnrollment | null;
  verificationCode: string;
  onVerificationCodeChange: (code: string) => void;
  onVerify: () => void;
  onClose: () => void;
  isVerifying: boolean;
};

export function MfaSetupModal({
  visible,
  pendingEnrollment,
  verificationCode,
  onVerificationCodeChange,
  onVerify,
  onClose,
  isVerifying,
}: MfaSetupModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/60">
        <View className="flex-1 items-center justify-center px-4 py-10">
          <View className="w-full rounded-2xl bg-white p-5 dark:bg-charcoal-900">
            <Text className="mb-2 text-xl font-bold">
              {translate('auth.security.mfa_setup_title')}
            </Text>
            <Text className="mb-4 text-neutral-600 dark:text-neutral-300">
              {translate('auth.security.mfa_setup_description')}
            </Text>
            {pendingEnrollment ? (
              <>
                <Text className="text-sm font-semibold text-neutral-500 dark:text-neutral-400">
                  {translate('auth.security.mfa_secret_label')}
                </Text>
                <View className="my-2 rounded-lg border border-dashed border-neutral-400 p-3">
                  <Text selectable className="font-mono text-lg">
                    {pendingEnrollment.secret}
                  </Text>
                </View>
                <Button
                  variant="outline"
                  label={translate('auth.security.mfa_open_authenticator')}
                  onPress={() => openLinkInBrowser(pendingEnrollment.uri)}
                  className="mt-2"
                />
              </>
            ) : null}
            <Input
              className="mt-4"
              value={verificationCode}
              onChangeText={onVerificationCodeChange}
              placeholder={translate('auth.security.mfa_code_placeholder')}
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
              testID="mfa-code-input"
            />
            <View className="mt-6 flex-row gap-3">
              <Button
                variant="outline"
                label={translate('common.cancel')}
                onPress={onClose}
                className="flex-1"
              />
              <Button
                label={translate('common.confirm')}
                onPress={onVerify}
                loading={isVerifying}
                className="flex-1"
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}
