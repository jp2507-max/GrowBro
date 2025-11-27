import { useAuth } from '@/lib/auth';
import { stopIdleTimeout } from '@/lib/auth/session-timeout';
import { removeToken } from '@/lib/auth/utils';
import { resetAgeGate } from '@/lib/compliance/age-gate';

export function getCurrentUser() {
  return useAuth.getState().user;
}

export function clearLocalAuthState() {
  // Clear persisted token and related local states
  removeToken();

  // Reset any compliance/age gate state
  resetAgeGate();

  // Stop any session timeout/idle timers
  stopIdleTimeout();

  // Reset Zustand auth state to signed out defaults
  useAuth.setState({
    status: 'signOut',
    token: null,
    user: null,
    session: null,
    lastValidatedAt: null,
    offlineMode: 'full',
  });
}

export default clearLocalAuthState;
