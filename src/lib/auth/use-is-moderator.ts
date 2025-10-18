/**
 * useIsModerator hook
 *
 * Checks if the current user has moderator or admin role based on JWT claims.
 * Requirements: 10.3 (role verification via JWT)
 */

import { useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';

type UserRole = 'user' | 'moderator' | 'admin';

export function useIsModerator(): boolean {
  const [isModerator, setIsModerator] = useState(false);

  useEffect(() => {
    const checkRole = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.user) {
          setIsModerator(false);
          return;
        }

        // Check JWT claims for role
        const jwt = session.access_token;
        if (!jwt) {
          setIsModerator(false);
          return;
        }

        // Decode JWT to check claims
        // In production, the JWT should contain role in either:
        // 1. top-level 'role' claim
        // 2. app_metadata.roles array
        const user = session.user;
        const appMetadata = user.app_metadata as {
          roles?: UserRole[];
          role?: UserRole;
        };
        const userMetadata = user.user_metadata as { role?: UserRole };

        // Check multiple possible locations for role
        const role =
          appMetadata?.role ||
          userMetadata?.role ||
          (appMetadata?.roles?.includes('moderator') ||
          appMetadata?.roles?.includes('admin')
            ? 'moderator'
            : 'user');

        setIsModerator(role === 'moderator' || role === 'admin');
      } catch (error) {
        console.error('Error checking moderator role:', error);
        setIsModerator(false);
      }
    };

    void checkRole();
  }, []);

  return isModerator;
}
