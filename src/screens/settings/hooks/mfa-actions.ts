/**
 * MFA Action Handlers (non-hook utility functions)
 */
import { Alert } from 'react-native';

import type {
  useMfaChallengeAndVerify,
  useMfaEnrollTotp,
  useMfaUnenroll,
} from '@/api/auth';
import { translate } from '@/lib';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

import type { PendingMfaEnrollment } from './use-mfa-handlers';

export const showMfaError = (error: unknown) =>
  Alert.alert(
    translate('common.error'),
    error instanceof Error ? error.message : String(error)
  );

type EnrollParams = {
  enrollTotp: ReturnType<typeof useMfaEnrollTotp>;
  setPendingEnrollment: (e: PendingMfaEnrollment) => void;
  setVerificationCode: (c: string) => void;
  present: () => void;
};

export async function startMfaEnrollment({
  enrollTotp,
  setPendingEnrollment,
  setVerificationCode,
  present,
}: EnrollParams) {
  try {
    const enrollment = await enrollTotp.mutateAsync({
      friendlyName: translate('auth.security.primary_mfa_label'),
    });
    setPendingEnrollment({
      factorId: enrollment.id,
      secret: enrollment.totp.secret,
      uri: enrollment.totp.uri,
      friendlyName: enrollment.friendly_name ?? null,
    });
    setVerificationCode('');
    present();
  } catch (error) {
    showMfaError(error);
  }
}

type VerifyParams = {
  pendingEnrollment: PendingMfaEnrollment | null;
  verificationCode: string;
  verifyTotp: ReturnType<typeof useMfaChallengeAndVerify>;
  refetchMfaFactors: () => void;
  setPendingEnrollment: (e: PendingMfaEnrollment | null) => void;
  setVerificationCode: (c: string) => void;
  dismiss: () => void;
};

export async function verifyMfaCode(params: VerifyParams) {
  const {
    pendingEnrollment,
    verificationCode,
    verifyTotp,
    refetchMfaFactors,
    setPendingEnrollment,
    setVerificationCode,
    dismiss,
  } = params;
  if (!pendingEnrollment) return;
  const code = verificationCode.trim();
  if (code.length < 6) {
    Alert.alert(
      translate('common.error'),
      translate('auth.security.mfa_code_required')
    );
    return;
  }
  try {
    await verifyTotp.mutateAsync({
      factorId: pendingEnrollment.factorId,
      code,
    });
    const sessionResponse = await supabase.auth.getSession();
    if (sessionResponse.data.session)
      useAuth.getState().updateSession(sessionResponse.data.session);
    await refetchMfaFactors();
    setPendingEnrollment(null);
    setVerificationCode('');
    dismiss();
    Alert.alert(translate('auth.security.mfa_verification_success'), undefined);
  } catch (error) {
    Alert.alert(
      translate('common.error'),
      error instanceof Error
        ? error.message
        : translate('auth.security.mfa_verification_error')
    );
  }
}

type DisableParams = {
  activeFactor: { id: string } | undefined;
  unenrollTotp: ReturnType<typeof useMfaUnenroll>;
  refetchMfaFactors: () => void;
};

export function confirmDisableMfa({
  activeFactor,
  unenrollTotp,
  refetchMfaFactors,
}: DisableParams) {
  if (!activeFactor) return;
  Alert.alert(
    translate('auth.security.mfa_disable_confirm_title'),
    translate('auth.security.mfa_disable_confirm_message'),
    [
      { text: translate('common.cancel'), style: 'cancel' },
      {
        text: translate('common.confirm'),
        style: 'destructive',
        onPress: async () => {
          try {
            await unenrollTotp.mutateAsync({ factorId: activeFactor.id });
            await refetchMfaFactors();
            Alert.alert(
              translate('auth.security.mfa_disabled_toast'),
              undefined
            );
          } catch (error) {
            showMfaError(error);
          }
        },
      },
    ]
  );
}
