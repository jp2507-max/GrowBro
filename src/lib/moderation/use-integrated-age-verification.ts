/**
 * Integrated Age Verification Hook
 *
 * Integrates age verification with existing authentication flow
 * Provides seamless age-gating across the app
 *
 * Requirements: 8.7
 */

import { useEffect, useState } from 'react';

import { getOptionalAuthenticatedUserId } from '@/lib/auth/user-utils';
import { supabase } from '@/lib/supabase';

import { AgeVerificationService } from './age-verification-service';

// Initialize age verification service
const ageVerificationService = new AgeVerificationService(supabase);

export interface UseIntegratedAgeVerificationResult {
  isAgeVerified: boolean;
  isLoading: boolean;
  requiresVerification: boolean;
  verifyAge: () => Promise<void>;
  checkVerificationStatus: () => Promise<void>;
}

/**
 * Hook to integrate age verification with authentication
 *
 * Automatically checks age verification status when user authenticates
 * Provides methods to verify age and check status
 */
export function useIntegratedAgeVerification(): UseIntegratedAgeVerificationResult {
  const [isAgeVerified, setIsAgeVerified] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [requiresVerification, setRequiresVerification] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Check authentication status and age verification
  useEffect(() => {
    const checkStatus = async () => {
      setIsLoading(true);
      try {
        const currentUserId = await getOptionalAuthenticatedUserId();
        setUserId(currentUserId);

        if (!currentUserId) {
          // Not authenticated - no age verification needed
          setIsAgeVerified(false);
          setRequiresVerification(false);
          return;
        }

        // Check age verification status
        const status =
          await ageVerificationService.getUserAgeStatus(currentUserId);

        const verified = status?.isAgeVerified ?? false;
        setIsAgeVerified(verified);
        setRequiresVerification(!verified);
      } catch (error) {
        console.error('Error checking age verification status:', error);
        setIsAgeVerified(false);
        setRequiresVerification(true);
      } finally {
        setIsLoading(false);
      }
    };

    checkStatus();
  }, []);

  /**
   * Verify user's age
   * Opens age verification flow
   */
  const verifyAge = async (): Promise<void> => {
    if (!userId) {
      throw new Error('User must be authenticated to verify age');
    }

    try {
      // TODO: Implement age verification flow
      // This should open a modal or navigate to age verification screen
      // For now, we'll just log
      console.log('Opening age verification flow for user:', userId);

      // After successful verification, update status
      await checkVerificationStatus();
    } catch (error) {
      console.error('Error verifying age:', error);
      throw error;
    }
  };

  /**
   * Check current verification status
   * Useful for refreshing after verification
   */
  const checkVerificationStatus = async (): Promise<void> => {
    if (!userId) return;

    try {
      const status = await ageVerificationService.getUserAgeStatus(userId);
      const verified = status?.isAgeVerified ?? false;
      setIsAgeVerified(verified);
      setRequiresVerification(!verified);
    } catch (error) {
      console.error('Error checking verification status:', error);
    }
  };

  return {
    isAgeVerified,
    isLoading,
    requiresVerification,
    verifyAge,
    checkVerificationStatus,
  };
}
