import { supabase } from '@/lib/supabase';
import type { UserProfile } from '@/types/settings';

/**
 * Profile sync service
 * Requirements: 9.6, 9.7, 4.6
 *
 * Handles queue-and-retry synchronization of profile data between
 * local WatermelonDB and Supabase backend with exponential backoff.
 */

export interface SyncResult {
  success: boolean;
  error?: string;
}

interface RetryState {
  attempts: number;
  nextRetryAt: number;
}

const MAX_RETRIES = 6;
const BACKOFF_DELAYS_MS = [1000, 2000, 4000, 8000, 16000, 60000]; // 1s, 2s, 4s, 8s, 16s, 60s (cap)

const retryStates = new Map<string, RetryState>();

/**
 * Syncs profile data to Supabase backend
 * @param profile - The profile data to sync
 * @returns Sync result indicating success or failure
 */
export async function syncProfileToBackend(
  profile: Partial<UserProfile> & { userId: string }
): Promise<SyncResult> {
  const retryKey = `profile-${profile.userId}`;

  try {
    // Check if we should retry based on backoff schedule
    const retryState = retryStates.get(retryKey);
    if (retryState && Date.now() < retryState.nextRetryAt) {
      return {
        success: false,
        error: 'Retry scheduled for later',
      };
    }

    // Upsert profile to Supabase
    const { error } = await supabase.from('profiles').upsert(
      {
        user_id: profile.userId,
        display_name: profile.displayName,
        bio: profile.bio,
        avatar_url: profile.avatarUrl,
        location: profile.location,
        show_profile_to_community: profile.showProfileToCommunity,
        allow_direct_messages: profile.allowDirectMessages,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'user_id',
      }
    );

    if (error) {
      throw new Error(error.message);
    }

    // Clear retry state on success
    retryStates.delete(retryKey);

    return { success: true };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred';

    // Update retry state with exponential backoff
    const retryState = retryStates.get(retryKey) || {
      attempts: 0,
      nextRetryAt: 0,
    };
    const attemptIndex = Math.min(retryState.attempts, MAX_RETRIES - 1);
    const delay = BACKOFF_DELAYS_MS[attemptIndex];

    retryStates.set(retryKey, {
      attempts: retryState.attempts + 1,
      nextRetryAt: Date.now() + delay,
    });

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Fetches profile data from Supabase backend
 * @param userId - The user ID to fetch profile for
 * @returns Profile data or null if not found
 */
export async function fetchProfileFromBackend(
  userId: string
): Promise<UserProfile | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // Not found
        return null;
      }
      throw new Error(error.message);
    }

    return {
      id: data.id,
      userId: data.user_id,
      displayName: data.display_name,
      bio: data.bio,
      avatarUrl: data.avatar_url,
      location: data.location,
      showProfileToCommunity: data.show_profile_to_community,
      allowDirectMessages: data.allow_direct_messages,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  } catch (error) {
    console.error('Failed to fetch profile from backend:', error);
    return null;
  }
}

/**
 * Gets the current retry state for a profile sync operation
 * @param userId - The user ID
 * @returns Retry state or null if no retry is pending
 */
export function getRetryState(userId: string): RetryState | null {
  return retryStates.get(`profile-${userId}`) || null;
}

/**
 * Clears the retry state for a profile sync operation
 * @param userId - The user ID
 */
export function clearRetryState(userId: string): void {
  retryStates.delete(`profile-${userId}`);
}
