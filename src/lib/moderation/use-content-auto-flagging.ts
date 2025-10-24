/**
 * Content Auto-Flagging Hook
 *
 * React hook for automatically flagging age-restricted content on creation
 * Implements DSA Art. 28 automatic content detection
 *
 * Requirements:
 * - 8.2: Automatically flag age-restricted content
 * - 8.7: Build content tagging system for age-sensitive material
 */

import { useCallback, useMemo } from 'react';

import { supabase } from '@/lib/supabase';

import { ContentAgeGatingEngine } from './content-age-gating';

interface UseContentAutoFlaggingOptions {
  enabled?: boolean;
}

interface UseContentAutoFlaggingResult {
  autoFlagContent: (
    contentId: string,
    contentType: 'post' | 'comment' | 'image' | 'profile' | 'other',
    contentText: string
  ) => Promise<boolean>;
  isEnabled: boolean;
}

/**
 * Hook for automatically flagging age-restricted content
 *
 * @param options - Configuration options
 * @returns Auto-flagging utilities
 */
export function useContentAutoFlagging(
  options: UseContentAutoFlaggingOptions = {}
): UseContentAutoFlaggingResult {
  const { enabled = true } = options;

  const gatingEngine = useMemo(() => new ContentAgeGatingEngine(supabase), []);

  /**
   * Automatically detect and flag age-restricted content
   */
  const autoFlagContent = useCallback(
    async (
      contentId: string,
      contentType: 'post' | 'comment' | 'image' | 'profile' | 'other',
      contentText: string
    ): Promise<boolean> => {
      if (!enabled) {
        return false;
      }

      try {
        const wasFlagged = await gatingEngine.autoFlagContent(
          contentId,
          contentType,
          contentText
        );

        if (wasFlagged) {
          console.log(
            `Content ${contentId} (${contentType}) was auto-flagged as age-restricted`
          );
        }

        return wasFlagged;
      } catch (error) {
        console.error('Failed to auto-flag content:', error);
        return false;
      }
    },
    [enabled, gatingEngine]
  );

  return {
    autoFlagContent,
    isEnabled: enabled,
  };
}
