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

import type { RealtimeChannel } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';

import { useAuth } from '.';
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
    .limit(1);

  if (error) {
    throw error;
  }

  const row = data?.[0] ?? null;
  if (!row) {
    return {
      isVerified: false,
      isLoading: false,
    };
  }

  return mapStatusRowToState(row);
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
  const user = useAuth.use.user();
  const [status, setStatus] = useState<AgeVerificationStatus>({
    isVerified: false,
    isLoading: true,
  });

  useEffect(() => {
    let mounted = true;
    let subscription: RealtimeChannel | null = null;

    const fetchStatus = async () => {
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

    const setupSubscription = async () => {
      const userId = await getOptionalAuthenticatedUserId();
      if (!mounted || !userId) return;

      const channel = supabase.channel(`age_verification_${userId}`).on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_age_status',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          fetchStatus();
        }
      );

      if (!mounted) {
        supabase.removeChannel(channel);
        return;
      }

      channel.subscribe();

      if (!mounted) {
        supabase.removeChannel(channel);
        return;
      }

      subscription = channel;
    };

    fetchStatus();
    setupSubscription();

    return () => {
      mounted = false;
      if (subscription) {
        supabase.removeChannel(subscription);
        subscription = null;
      }
    };
  }, [user?.id]);

  return status;
}
