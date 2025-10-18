/**
 * useIsModerator hook
 *
 * Checks if the current user has moderator or admin role based on session.user claims.
 * Requirements: 10.3 (role verification via session.user/app_metadata)
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

        // Check session.user claims for role
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
