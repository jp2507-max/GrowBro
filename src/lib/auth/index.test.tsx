import type { Session, User } from '@supabase/supabase-js';

import { signOut, useAuth } from '@/lib/auth/index';
import { stopIdleTimeout } from '@/lib/auth/session-timeout';
import { resetAgeGate } from '@/lib/compliance/age-gate';
import * as storage from '@/lib/storage';
import { supabase } from '@/lib/supabase';

// Mock dependencies
jest.mock('@/lib/compliance/age-gate', () => ({
  resetAgeGate: jest.fn(),
}));

jest.mock('@/lib/auth/session-timeout', () => ({
  startIdleTimeout: jest.fn(),
  stopIdleTimeout: jest.fn(),
  updateActivity: jest.fn(),
}));

// Mock Supabase auth state listener
jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signOut: jest.fn(),
      setSession: jest.fn().mockResolvedValue({
        data: {
          session: {
            access_token: 'test-access-token',
            refresh_token: 'test-refresh-token',
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            expires_in: 3600,
            token_type: 'bearer',
            user: {
              id: 'mock-user-id',
              aud: 'authenticated',
              role: 'authenticated',
              email: 'test@example.com',
              email_confirmed_at: new Date().toISOString(),
              phone: '',
              confirmed_at: new Date().toISOString(),
              last_sign_in_at: new Date().toISOString(),
              app_metadata: {},
              user_metadata: {},
              identities: [],
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          },
          user: {
            id: 'mock-user-id',
            aud: 'authenticated',
            role: 'authenticated',
            email: 'test@example.com',
            email_confirmed_at: new Date().toISOString(),
            phone: '',
            confirmed_at: new Date().toISOString(),
            last_sign_in_at: new Date().toISOString(),
            app_metadata: {},
            user_metadata: {},
            identities: [],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        },
        error: null,
      }),
      onAuthStateChange: jest.fn(() => ({
        data: { subscription: { unsubscribe: jest.fn() } },
      })),
    },
  },
}));

// Mock storage for testing
const mockStorage = new Map<string, string>();

// Spy on storage functions
const setItemSpy = jest
  .spyOn(storage, 'setItem')
  .mockImplementation((key: string, value: unknown) => {
    mockStorage.set(key, JSON.stringify(value));
  });
jest.spyOn(storage, 'getItem').mockImplementation((key: string) => {
  const value = mockStorage.get(key);
  return value ? JSON.parse(value) : null;
});
jest.spyOn(storage, 'removeItem').mockImplementation((key: string) => {
  mockStorage.delete(key);
});

describe('Auth', () => {
  const mockUser: User = {
    id: 'mock-user-id',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'test@example.com',
    email_confirmed_at: new Date().toISOString(),
    phone: '',
    confirmed_at: new Date().toISOString(),
    last_sign_in_at: new Date().toISOString(),
    app_metadata: {},
    user_metadata: {},
    identities: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const mockSession: Session = {
    access_token: 'test-access-token',
    refresh_token: 'test-refresh-token',
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    expires_in: 3600,
    token_type: 'bearer',
    user: mockUser,
  };

  beforeEach(() => {
    mockStorage.clear();
    jest.clearAllMocks();
  });

  describe('state transitions', () => {
    test('should start with idle status', () => {
      expect(useAuth.getState().status).toBe('idle');
      expect(useAuth.getState().token).toBeNull();
      expect(useAuth.getState().user).toBeNull();
      expect(useAuth.getState().session).toBeNull();
    });

    test('should transition from idle to signIn with legacy token', async () => {
      const token = { access: 'test-token', refresh: 'test-refresh' };
      await useAuth.getState().signIn(token);

      expect(useAuth.getState().status).toBe('signIn');
      expect(useAuth.getState().token).toEqual(token);
    });

    test('should transition from idle to signIn with session and user', async () => {
      await useAuth.getState().signIn({ session: mockSession, user: mockUser });

      const state = useAuth.getState();
      expect(state.status).toBe('signIn');
      expect(state.session).toEqual(mockSession);
      expect(state.user).toEqual(mockUser);
      expect(state.token).toEqual({
        access: mockSession.access_token,
        refresh: mockSession.refresh_token,
      });
      expect(state.lastValidatedAt).toBeTruthy();
      expect(state.offlineMode).toBe('full');
    });

    test('should transition from signIn to signOut', async () => {
      await useAuth
        .getState()
        .signIn({ access: 'test-token', refresh: 'test-refresh' });
      expect(useAuth.getState().status).toBe('signIn');

      await signOut();

      const state = useAuth.getState();
      expect(state.status).toBe('signOut');
      expect(state.token).toBeNull();
      expect(state.user).toBeNull();
      expect(state.session).toBeNull();
      expect(state.lastValidatedAt).toBeNull();
      expect(state.offlineMode).toBe('full');
    });
  });

  describe('session management', () => {
    test('should update session with updateSession action', async () => {
      // Sign in first
      await useAuth.getState().signIn({ session: mockSession, user: mockUser });

      // Update session with new token
      const newSession: Session = {
        ...mockSession,
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
      };

      await useAuth.getState().updateSession(newSession);

      const state = useAuth.getState();
      expect(state.session).toEqual(newSession);
      expect(state.token).toEqual({
        access: 'new-access-token',
        refresh: 'new-refresh-token',
      });
      expect(state.lastValidatedAt).toBeTruthy();
    });

    test('should update user with updateUser action', async () => {
      // Sign in first
      await useAuth.getState().signIn({ session: mockSession, user: mockUser });

      // Update user data
      const updatedUser: User = {
        ...mockUser,
        email: 'updated@example.com',
        user_metadata: { name: 'Updated Name' },
      };

      await useAuth.getState().updateUser(updatedUser);

      expect(useAuth.getState().user).toEqual(updatedUser);
    });

    test('should set offline mode with setOfflineMode action', () => {
      expect(useAuth.getState().offlineMode).toBe('full');

      useAuth.getState().setOfflineMode('readonly');
      expect(useAuth.getState().offlineMode).toBe('readonly');

      useAuth.getState().setOfflineMode('blocked');
      expect(useAuth.getState().offlineMode).toBe('blocked');

      useAuth.getState().setOfflineMode('full');
      expect(useAuth.getState().offlineMode).toBe('full');
    });
  });

  describe('session persistence', () => {
    test('should persist session to storage on signIn', async () => {
      await useAuth.getState().signIn({ session: mockSession, user: mockUser });

      // Verify setItem was called
      expect(setItemSpy).toHaveBeenCalledWith('token', {
        access: mockSession.access_token,
        refresh: mockSession.refresh_token,
      });

      // Verify token is stored in legacy format
      const storedToken = mockStorage.get('token');
      expect(storedToken).toBeTruthy();
      expect(JSON.parse(storedToken!)).toEqual({
        access: mockSession.access_token,
        refresh: mockSession.refresh_token,
      });
    });

    test('should hydrate session from storage', async () => {
      // Store token first
      const token = { access: 'stored-token', refresh: 'stored-refresh' };
      mockStorage.set('token', JSON.stringify(token));

      // Hydrate
      await useAuth.getState().hydrate();

      const state = useAuth.getState();
      expect(state.status).toBe('signIn');
      expect(state.token).toEqual(token);
    });

    test('should sign out if hydration fails', async () => {
      // Store invalid token
      mockStorage.set('token', 'invalid-json');

      // Hydrate
      await useAuth.getState().hydrate();

      const state = useAuth.getState();
      expect(state.status).toBe('signOut');
      expect(state.token).toBeNull();
    });

    test('should clear storage on signOut', async () => {
      await useAuth
        .getState()
        .signIn({ access: 'test-token', refresh: 'test-refresh' });
      expect(mockStorage.get('token')).toBeTruthy();

      await signOut();

      expect(mockStorage.get('token')).toBeUndefined();
    });
  });

  describe('onAuthStateChange event handling', () => {
    test('should update state on SIGNED_IN event with different session token', () => {
      // Sign in first with initial session
      useAuth.getState().signIn({ session: mockSession, user: mockUser });
      const initialState = useAuth.getState();
      expect(initialState.status).toBe('signIn');
      expect(initialState.session?.access_token).toBe('test-access-token');

      // Mock onAuthStateChange to trigger SIGNED_IN event with different token
      const mockOnAuthStateChange = jest.fn();
      (supabase.auth.onAuthStateChange as jest.Mock).mockImplementation(
        (callback) => {
          mockOnAuthStateChange.mockImplementation(callback);
          return { data: { subscription: { unsubscribe: jest.fn() } } };
        }
      );

      // Import and initialize the auth module to set up the listener
      // This will trigger the onAuthStateChange setup
      jest.isolateModules(() => {
        require('@/lib/auth/index');
      });

      // Create a new session with different access token
      const newSession: Session = {
        ...mockSession,
        access_token: 'different-access-token',
        refresh_token: 'different-refresh-token',
      };

      // Trigger SIGNED_IN event with different session
      const authStateChangeCallback = (
        supabase.auth.onAuthStateChange as jest.Mock
      ).mock.calls[0][0];
      authStateChangeCallback('SIGNED_IN', newSession);

      // Verify state was updated with new session
      const updatedState = useAuth.getState();
      expect(updatedState.status).toBe('signIn');
      expect(updatedState.session?.access_token).toBe('different-access-token');
      expect(updatedState.session?.refresh_token).toBe(
        'different-refresh-token'
      );
      expect(updatedState.token).toEqual({
        access: 'different-access-token',
        refresh: 'different-refresh-token',
      });
    });

    test('should not update state on SIGNED_IN event with same session token', () => {
      // Sign in first with initial session
      useAuth.getState().signIn({ session: mockSession, user: mockUser });
      const initialState = useAuth.getState();
      expect(initialState.status).toBe('signIn');
      expect(initialState.session?.access_token).toBe('test-access-token');

      // Mock onAuthStateChange to trigger SIGNED_IN event with same token
      const mockOnAuthStateChange = jest.fn();
      (supabase.auth.onAuthStateChange as jest.Mock).mockImplementation(
        (callback) => {
          mockOnAuthStateChange.mockImplementation(callback);
          return { data: { subscription: { unsubscribe: jest.fn() } } };
        }
      );

      // Import and initialize the auth module to set up the listener
      jest.isolateModules(() => {
        require('@/lib/auth/index');
      });

      // Trigger SIGNED_IN event with same session (should not update)
      const authStateChangeCallback = (
        supabase.auth.onAuthStateChange as jest.Mock
      ).mock.calls[0][0];
      authStateChangeCallback('SIGNED_IN', mockSession);

      // Verify state was NOT updated (same reference)
      const updatedState = useAuth.getState();
      expect(updatedState.session).toBe(initialState.session); // Same reference
      expect(updatedState.token).toBe(initialState.token); // Same reference
    });
  });

  describe('signOut', () => {
    test('should call resetAgeGate when signing out', async () => {
      // Sign in first
      await useAuth
        .getState()
        .signIn({ access: 'test-token', refresh: 'test-refresh' });

      // Sign out
      await signOut();

      // Verify resetAgeGate was called
      expect(resetAgeGate).toHaveBeenCalledTimes(1);
    });

    test('should clear auth token from storage on signOut', async () => {
      // Sign in first
      await useAuth
        .getState()
        .signIn({ access: 'test-token', refresh: 'test-refresh' });

      // Verify token is stored
      expect(mockStorage.get('token')).toBeTruthy();

      // Sign out
      await signOut();

      // Verify token is removed from storage
      expect(mockStorage.get('token')).toBeUndefined();
    });

    test('should update auth status to signOut', async () => {
      // Sign in first
      await useAuth
        .getState()
        .signIn({ access: 'test-token', refresh: 'test-refresh' });

      // Verify status is signIn
      expect(useAuth.getState().status).toBe('signIn');

      // Sign out
      await signOut();

      // Verify status is signOut
      expect(useAuth.getState().status).toBe('signOut');
    });

    test('should clear token from state on signOut', async () => {
      // Sign in first
      await useAuth
        .getState()
        .signIn({ access: 'test-token', refresh: 'test-refresh' });

      // Verify token exists
      expect(useAuth.getState().token).toEqual({
        access: 'test-token',
        refresh: 'test-refresh',
      });

      // Sign out
      await signOut();

      // Verify token is null
      expect(useAuth.getState().token).toBeNull();
    });

    test('should call stopIdleTimeout when signing out', async () => {
      // Sign in first
      await useAuth
        .getState()
        .signIn({ access: 'test-token', refresh: 'test-refresh' });

      // Sign out
      await signOut();

      // Verify stopIdleTimeout was called
      expect(stopIdleTimeout).toHaveBeenCalledTimes(1);
    });

    test('should call supabase.auth.signOut when signing out', async () => {
      // Sign in first
      await useAuth
        .getState()
        .signIn({ access: 'test-token', refresh: 'test-refresh' });

      // Sign out
      await signOut();

      // Verify supabase.auth.signOut was called
      expect(supabase.auth.signOut).toHaveBeenCalledTimes(1);
    });

    test('should skip supabase.auth.signOut when signOut is called with skipRemote=true', async () => {
      // Sign in first
      await useAuth
        .getState()
        .signIn({ access: 'test-token', refresh: 'test-refresh' });

      // Clear the mock to start fresh
      (supabase.auth.signOut as jest.Mock).mockClear();

      // Sign out with skipRemote=true
      await useAuth.getState().signOut(true);

      // Verify supabase.auth.signOut was NOT called
      expect(supabase.auth.signOut).not.toHaveBeenCalled();
    });

    test('should call supabase.auth.signOut when signOut is called with skipRemote=false or default', async () => {
      // Sign in first
      await useAuth
        .getState()
        .signIn({ access: 'test-token', refresh: 'test-refresh' });

      // Clear the mock to start fresh
      (supabase.auth.signOut as jest.Mock).mockClear();

      // Sign out with skipRemote=false
      await useAuth.getState().signOut(false);

      // Verify supabase.auth.signOut was called
      expect(supabase.auth.signOut).toHaveBeenCalledTimes(1);
    });
  });
});
