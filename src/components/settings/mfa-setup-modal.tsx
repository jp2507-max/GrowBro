import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import * as React from 'react';

import { Button, Input, Modal, Text, useModal, View } from '@/components/ui';
import { translate } from '@/lib';
import type { PendingMfaEnrollment } from '@/lib/auth/mfa-actions';
import { openLinkInBrowser } from '@/lib/utils';

type MfaSetupModalProps = {
  pendingEnrollment: PendingMfaEnrollment | null;
  verificationCode: string;
  onVerificationCodeChange: (code: string) => void;
  onVerify: () => void;
  onClose: () => void;
  isVerifying: boolean;
};

export type MfaSetupModalRef = BottomSheetModal;

/**
 * Modal for MFA TOTP setup with secret display and verification code input.
 *
 * Uses @gorhom/bottom-sheet for native feel. Sensitive data (secrets) are kept
 * in component state, not exposed in navigation params.
 *
 * Usage:
 * ```tsx
 * const { ref, present, dismiss } = useModal();
 *
 * <MfaSetupModal
 *   ref={ref}
 *   pendingEnrollment={enrollment}
 *   verificationCode={code}
 *   onVerificationCodeChange={setCode}
 *   onVerify={handleVerify}
 *   onClose={dismiss}
 *   isVerifying={isPending}
 * />
 *
 * // To show the modal:
 * present();
 * ```
 */
export const MfaSetupModal = React.forwardRef<
  MfaSetupModalRef,
  MfaSetupModalProps
>(function MfaSetupModal(
  {
    pendingEnrollment,
    verificationCode,
    onVerificationCodeChange,
    onVerify,
    onClose,
    isVerifying,
  },
  ref
) {
  return (
    <Modal
      ref={ref}
      snapPoints={['55%']}
      title={translate('auth.security.mfa_setup_title')}
      enablePanDownToClose
      onDismiss={onClose}
    >
      <BottomSheetView className="px-5 pb-5">
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
              testID="mfa-open-authenticator-button"
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
          accessibilityLabel={translate('auth.security.mfa_code_placeholder')}
          accessibilityHint={translate('auth.security.mfa_code_required')}
        />

        <View className="mt-6 flex-row gap-3">
          <Button
            variant="outline"
            label={translate('common.cancel')}
            onPress={onClose}
            className="flex-1"
            testID="mfa-cancel-button"
          />
          <Button
            label={translate('common.confirm')}
            onPress={onVerify}
            loading={isVerifying}
            className="flex-1"
            testID="mfa-verify-button"
          />
        </View>
      </BottomSheetView>
    </Modal>
  );
});

// Re-export useModal for convenience
export { useModal };
