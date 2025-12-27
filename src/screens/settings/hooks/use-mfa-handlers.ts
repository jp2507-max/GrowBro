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
  refetchMfaFactors: () => void;
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

  const handleStartEnableMfa = () =>
    startMfaEnrollment({
      enrollTotp,
      setPendingEnrollment,
      setVerificationCode,
      present: mfaModal.present,
    });

  const handleVerifyMfa = () =>
    verifyMfaCode({
      pendingEnrollment,
      verificationCode,
      verifyTotp,
      refetchMfaFactors,
      setPendingEnrollment,
      setVerificationCode,
      dismiss: mfaModal.dismiss,
    });

  const handleDisableMfa = () =>
    confirmDisableMfa({ activeFactor, unenrollTotp, refetchMfaFactors });

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
