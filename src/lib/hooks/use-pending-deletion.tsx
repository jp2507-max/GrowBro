/**
 * usePendingDeletion Hook
 * Requirements: 6.7 - Check for pending deletion on auth state change
 *
 * Checks if the authenticated user has a pending account deletion request
 * and returns the request details for displaying the restore banner.
 *
 * Usage:
 * - Call in app root layout or auth context
 * - Automatically checks on mount and auth state changes
 * - Returns null if no pending deletion, or deletion details if found
 *
 * Return format:
 * {
 *   requestId: string
 *   scheduledFor: Date
 *   daysRemaining: number
 * }
 */

import { useEffect, useState } from 'react';

import { checkPendingDeletion } from '@/api/auth';
import { useAuth } from '@/lib/auth';

interface PendingDeletionInfo {
  requestId: string;
  scheduledFor: Date;
  daysRemaining: number;
}

export function usePendingDeletion() {
  const { user } = useAuth();
  const [pendingDeletion, setPendingDeletion] =
    useState<PendingDeletionInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Reset state when user logs out
    if (!user) {
      setPendingDeletion(null);
      setIsLoading(false);
      return;
    }

    // Check for pending deletion when user is authenticated
    const checkDeletion = async () => {
      try {
        setIsLoading(true);
        const result = await checkPendingDeletion(user.id);

        if (result) {
          // Calculate days remaining
          const scheduledDate = new Date(result.scheduledFor);
          const now = new Date();
          const daysRemaining = Math.ceil(
            (scheduledDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
          );

          setPendingDeletion({
            requestId: result.requestId,
            scheduledFor: scheduledDate,
            daysRemaining: Math.max(0, daysRemaining),
          });
        } else {
          setPendingDeletion(null);
        }
      } catch (error) {
        console.error('Failed to check pending deletion:', error);
        // Don't set pending deletion on error to avoid false positives
        setPendingDeletion(null);
      } finally {
        setIsLoading(false);
      }
    };

    checkDeletion();
  }, [user]);

  return {
    pendingDeletion,
    isLoading,
    hasPendingDeletion: pendingDeletion !== null,
  };
}
