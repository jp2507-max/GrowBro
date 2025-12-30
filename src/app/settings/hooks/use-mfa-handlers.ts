import * as React from 'react';

import {
  type useMfaChallengeAndVerify,
  type useMfaEnrollTotp,
  type useMfaUnenroll,
} from '@/api/auth';
import { type useModal } from '@/components/settings/mfa-setup-modal';

import {
  confirmDisableMfa,
  startMfaEnrollment,
  verifyMfaCode,
} from './mfa-actions';

export type PendingMfaEnrollment = {
  factorId: string;
  secret: string;
  uri: string;
  friendlyName: string | null;
};

type UseMfaHandlersParams = {
  enrollTotp: ReturnType<typeof useMfaEnrollTotp>;
  verifyTotp: ReturnType<typeof useMfaChallengeAndVerify>;
  unenrollTotp: ReturnType<typeof useMfaUnenroll>;
  refetchMfaFactors: () => Promise<unknown>;
  activeFactor: { id: string } | undefined;
  mfaModal: ReturnType<typeof useModal>;
};

export function useMfaHandlers(params: UseMfaHandlersParams) {
  const {
    enrollTotp,
    verifyTotp,
    unenrollTotp,
    refetchMfaFactors,
    activeFactor,
    mfaModal,
  } = params;
  const [pendingEnrollment, setPendingEnrollment] =
    React.useState<PendingMfaEnrollment | null>(null);
  const [verificationCode, setVerificationCode] = React.useState('');

  const handleStartEnableMfa = React.useCallback(
    () =>
      startMfaEnrollment({
        enrollTotp,
        setPendingEnrollment,
        setVerificationCode,
        present: mfaModal.present,
      }),
    [enrollTotp, mfaModal.present]
  );

  const handleVerifyMfa = React.useCallback(
    () =>
      verifyMfaCode({
        pendingEnrollment,
        verificationCode,
        verifyTotp,
        refetchMfaFactors,
        setPendingEnrollment,
        setVerificationCode,
        dismiss: mfaModal.dismiss,
      }),
    [
      pendingEnrollment,
      verificationCode,
      verifyTotp,
      refetchMfaFactors,
      mfaModal.dismiss,
    ]
  );

  const handleDisableMfa = React.useCallback(
    () => confirmDisableMfa({ activeFactor, unenrollTotp, refetchMfaFactors }),
    [activeFactor, unenrollTotp, refetchMfaFactors]
  );

  const handleCloseMfaModal = React.useCallback(() => {
    mfaModal.dismiss();
    setPendingEnrollment(null);
    setVerificationCode('');
  }, [mfaModal]);

  return {
    pendingEnrollment,
    verificationCode,
    setVerificationCode,
    handleStartEnableMfa,
    handleVerifyMfa,
    handleDisableMfa,
    handleCloseMfaModal,
  };
}
