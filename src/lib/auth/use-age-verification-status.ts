/**
 * Age Verification Status Hook
 *
 * Integrates age verification with user authentication flow
 * Automatically checks age verification status when user authenticates
 *
 * Requirements:
 * - 8.1: Privacy-preserving age verification
 * - 8.2: Restrict visibility to verified 18+ users
 * - 8.7: Filter age-restricted content in feeds
 */

import { useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';

import { getOptionalAuthenticatedUserId } from './user-utils';

type AgeStatusRow = {
  is_verified: boolean;
  verified_at: string | null;
  token_expiry: string | null;
};

function mapStatusRowToState(row: AgeStatusRow): AgeVerificationStatus {
  const tokenExpiry = row.token_expiry ? new Date(row.token_expiry) : undefined;
  const isExpired = tokenExpiry ? tokenExpiry < new Date() : false;

  return {
    isVerified: row.is_verified && !isExpired,
    verificationDate: row.verified_at ? new Date(row.verified_at) : undefined,
    tokenExpiry,
    isLoading: false,
  };
}

async function fetchAgeVerificationStatusForUser(
  userId: string
): Promise<AgeVerificationStatus> {
  const { data, error } = await supabase
    .from('user_age_status')
    .select('is_verified, verified_at, token_expiry')
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  if (!data) {
    return {
      isVerified: false,
      isLoading: false,
    };
  }

  return mapStatusRowToState(data);
}

async function resolveAgeVerificationStatus(): Promise<AgeVerificationStatus> {
  const userId = await getOptionalAuthenticatedUserId();

  if (!userId) {
    return {
      isVerified: false,
      isLoading: false,
    };
  }

  return fetchAgeVerificationStatusForUser(userId);
}

export interface AgeVerificationStatus {
  isVerified: boolean;
  verificationDate?: Date;
  tokenExpiry?: Date;
  isLoading: boolean;
  error?: string;
}

/**
 * Hook to check user's age verification status
 *
 * Automatically checks status when user authenticates
 * Returns cached status to avoid repeated database queries
 */
export function useAgeVerificationStatus(): AgeVerificationStatus {
  const [status, setStatus] = useState<AgeVerificationStatus>({
    isVerified: false,
    isLoading: true,
  });

  useEffect(() => {
    let mounted = true;

    const syncStatus = async () => {
      if (!mounted) return;
      setStatus((previous) => ({ ...previous, isLoading: true }));

      try {
        const nextStatus = await resolveAgeVerificationStatus();
        if (mounted) {
          setStatus(nextStatus);
        }
      } catch (error) {
        console.error('Error in age verification check:', error);
        if (mounted) {
          setStatus({
            isVerified: false,
            isLoading: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    };

    syncStatus();

    const subscription = supabase
      .channel('age_verification_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_age_status',
        },
        (_payload) => {
          syncStatus();
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return status;
}

/**
 * Hook to check if user needs age verification
 *
 * Returns true if user is authenticated but not age-verified
 */
export function useNeedsAgeVerification(): boolean {
  const [needsVerification, setNeedsVerification] = useState(false);

  useEffect(() => {
    let mounted = true;

    const checkNeedsVerification = async () => {
      try {
        const userId = await getOptionalAuthenticatedUserId();

        if (!userId) {
          if (mounted) setNeedsVerification(false);
          return;
        }

        const { data, error } = await supabase
          .from('user_age_status')
          .select('is_verified')
          .eq('user_id', userId)
          .single();

        if (error && error.code !== 'PGRST116') {
          console.error('Error checking age verification need:', error);
          if (mounted) setNeedsVerification(false);
          return;
        }

        // User needs verification if no record or not verified
        if (mounted) {
          setNeedsVerification(!data || !data.is_verified);
        }
      } catch (error) {
        console.error('Error in needs verification check:', error);
        if (mounted) setNeedsVerification(false);
      }
    };

    checkNeedsVerification();

    return () => {
      mounted = false;
    };
  }, []);

  return needsVerification;
}
