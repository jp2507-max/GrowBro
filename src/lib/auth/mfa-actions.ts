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

export type PendingMfaEnrollment = {
  factorId: string;
  secret: string;
  uri: string;
  friendlyName: string | null;
};

export const showMfaError = (error: unknown) => {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : translate('auth.security.mfa_verification_error');

  Alert.alert(translate('common.error'), message);
};

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
}: EnrollParams): Promise<void> {
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
  refetchMfaFactors: () => Promise<unknown>;
  setPendingEnrollment: (e: PendingMfaEnrollment | null) => void;
  setVerificationCode: (c: string) => void;
  dismiss: () => void;
};

export async function verifyMfaCode(params: VerifyParams): Promise<void> {
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
  if (code.length !== 6) {
    showMfaError(translate('auth.security.mfa_code_required'));
    return;
  }
  try {
    await verifyTotp.mutateAsync({
      factorId: pendingEnrollment.factorId,
      code,
    });
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.error('Failed to refresh session after MFA verification:', error);
    }
    if (data.session) {
      useAuth.getState().updateSession(data.session);
    }
    await refetchMfaFactors();
    setPendingEnrollment(null);
    setVerificationCode('');
    dismiss();
    Alert.alert(translate('auth.security.mfa_verification_success'), undefined);
  } catch (error) {
    showMfaError(error);
  }
}

type DisableParams = {
  activeFactor: { id: string } | undefined;
  unenrollTotp: ReturnType<typeof useMfaUnenroll>;
  refetchMfaFactors: () => Promise<unknown>;
};

export function confirmDisableMfa({
  activeFactor,
  unenrollTotp,
  refetchMfaFactors,
}: DisableParams): void {
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
