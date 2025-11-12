import * as React from 'react';
import { Alert } from 'react-native';

import {
  useMfaChallengeAndVerify,
  useMfaEnrollTotp,
  useMfaFactors,
  useMfaUnenroll,
} from '@/api/auth';
import { translate } from '@/lib';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export type PendingMfaEnrollment = {
  factorId: string;
  secret: string;
  uri: string;
  friendlyName?: string;
};

async function enrollMfaFactor(params: {
  enrollTotp: ReturnType<typeof useMfaEnrollTotp>;
  setPendingEnrollment: (enrollment: PendingMfaEnrollment | null) => void;
  setVerificationCode: (code: string) => void;
  setMfaModalVisible: (visible: boolean) => void;
}) {
  const {
    enrollTotp,
    setPendingEnrollment,
    setVerificationCode,
    setMfaModalVisible,
  } = params;
  try {
    const enrollment = await enrollTotp.mutateAsync({
      friendlyName: translate('auth.security.primary_mfa_label'),
    });
    setPendingEnrollment({
      factorId: enrollment.id,
      secret: enrollment.totp.secret,
      uri: enrollment.totp.uri,
      friendlyName: enrollment.friendly_name,
    });
    setVerificationCode('');
    setMfaModalVisible(true);
  } catch (error) {
    Alert.alert(
      translate('common.error'),
      error instanceof Error ? error.message : String(error)
    );
  }
}

async function verifyMfaCode(params: {
  pendingEnrollment: PendingMfaEnrollment | null;
  verificationCode: string;
  verifyTotp: ReturnType<typeof useMfaChallengeAndVerify>;
  refetchMfaFactors: () => Promise<any>;
  setPendingEnrollment: (enrollment: PendingMfaEnrollment | null) => void;
  setVerificationCode: (code: string) => void;
  setMfaModalVisible: (visible: boolean) => void;
}) {
  const {
    pendingEnrollment,
    verificationCode,
    verifyTotp,
    refetchMfaFactors,
    setPendingEnrollment,
    setVerificationCode,
    setMfaModalVisible,
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
    if (sessionResponse.data.session) {
      const { updateSession } = useAuth.getState();
      updateSession(sessionResponse.data.session);
    }
    await refetchMfaFactors();
    setPendingEnrollment(null);
    setVerificationCode('');
    setMfaModalVisible(false);
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

function disableMfaFactor(params: {
  activeFactor: any;
  unenrollTotp: ReturnType<typeof useMfaUnenroll>;
  refetchMfaFactors: () => Promise<any>;
}) {
  const { activeFactor, unenrollTotp, refetchMfaFactors } = params;
  if (!activeFactor) return;
  Alert.alert(
    translate('auth.security.mfa_disable_confirm_title'),
    translate('auth.security.mfa_disable_confirm_message'),
    [
      {
        text: translate('common.cancel'),
        style: 'cancel',
      },
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
            Alert.alert(
              translate('common.error'),
              error instanceof Error ? error.message : String(error)
            );
          }
        },
      },
    ]
  );
}

export function useMfaManagement() {
  const {
    data: mfaFactors,
    isLoading: isMfaLoading,
    refetch: refetchMfaFactors,
  } = useMfaFactors();
  const enrollTotp = useMfaEnrollTotp();
  const verifyTotp = useMfaChallengeAndVerify();
  const unenrollTotp = useMfaUnenroll();
  const [mfaModalVisible, setMfaModalVisible] = React.useState(false);
  const [pendingEnrollment, setPendingEnrollment] =
    React.useState<PendingMfaEnrollment | null>(null);
  const [verificationCode, setVerificationCode] = React.useState('');

  const allFactors = mfaFactors?.all ?? [];
  const totpFactors = allFactors.filter(
    (factor: any) => factor.factor_type === 'totp'
  );
  const activeFactor = totpFactors[0];
  const isMfaEnabled = totpFactors.length > 0;

  const handleStartEnableMfa = () =>
    enrollMfaFactor({
      enrollTotp,
      setPendingEnrollment,
      setVerificationCode,
      setMfaModalVisible,
    });

  const handleVerifyMfa = () =>
    verifyMfaCode({
      pendingEnrollment,
      verificationCode,
      verifyTotp,
      refetchMfaFactors,
      setPendingEnrollment,
      setVerificationCode,
      setMfaModalVisible,
    });

  const handleDisableMfa = () =>
    disableMfaFactor({ activeFactor, unenrollTotp, refetchMfaFactors });

  const handleCloseMfaModal = () => {
    setMfaModalVisible(false);
    setPendingEnrollment(null);
    setVerificationCode('');
  };

  return {
    isMfaEnabled,
    isMfaLoading,
    mfaModalVisible,
    pendingEnrollment,
    verificationCode,
    enrollTotp,
    unenrollTotp,
    verifyTotp,
    setVerificationCode,
    handleStartEnableMfa,
    handleVerifyMfa,
    handleDisableMfa,
    handleCloseMfaModal,
  };
}
