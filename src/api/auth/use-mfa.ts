import type {
  AuthMFAEnrollTOTPResponse,
  AuthMFAListFactorsResponse,
  AuthMFAVerifyResponse,
} from '@supabase/auth-js';
import { createMutation, createQuery } from 'react-query-kit';

import { supabase } from '@/lib/supabase';

type FactorsData = NonNullable<AuthMFAListFactorsResponse['data']>;

export const useMfaFactors = createQuery<FactorsData>({
  queryKey: ['auth', 'mfa', 'factors'],
  fetcher: async () => {
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error || !data) {
      throw error ?? new Error('Unable to list MFA factors');
    }
    return data;
  },
});

type EnrollTotpResult = NonNullable<AuthMFAEnrollTOTPResponse['data']>;

export const useMfaEnrollTotp = createMutation<
  EnrollTotpResult,
  { friendlyName?: string },
  Error
>({
  mutationFn: async ({ friendlyName }) => {
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName,
    });
    if (error || !data) {
      throw error ?? new Error('Failed to enroll authenticator');
    }
    return data;
  },
});

type VerifyResult = NonNullable<AuthMFAVerifyResponse['data']>;

export const useMfaChallengeAndVerify = createMutation<
  VerifyResult,
  { factorId: string; code: string },
  Error
>({
  mutationFn: async ({ factorId, code }) => {
    const { data, error } = await supabase.auth.mfa.challengeAndVerify({
      factorId,
      code,
    });
    if (error || !data) {
      throw error ?? new Error('Invalid verification code');
    }
    return data;
  },
});

export const useMfaUnenroll = createMutation<
  { id: string },
  { factorId: string },
  Error
>({
  mutationFn: async ({ factorId }) => {
    const { data, error } = await supabase.auth.mfa.unenroll({ factorId });
    if (error || !data) {
      throw error ?? new Error('Failed to disable MFA');
    }
    return data;
  },
});
