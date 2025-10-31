import type { Session } from '@supabase/supabase-js';

import { deriveSessionKey } from '@/api/auth';

import { supabase } from '../supabase';
import { useAuth } from './index';
import { sessionManager } from './session-manager';

// Mock deriveSessionKey
jest.mock('@/api/auth', () => ({
  deriveSessionKey: jest.fn(),
}));

// Mock Supabase client
jest.mock('../supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      refreshSession: jest.fn(),
      onAuthStateChange: jest.fn(() => ({
        data: { subscription: { unsubscribe: jest.fn() } },
      })),
    },
    from: jest.fn(() => ({
      update: jest.fn(() => ({
        eq: jest.fn(() => ({
          is: jest.fn(() => Promise.resolve({ error: null })),
        })),
      })),
    })),
  },
}));

// Mock auth store
jest.mock('./index', () => {
  const actual = jest.requireActual('./index');
  return {
    ...actual,
    useAuth: {
      getState: jest.fn(),
      use: {
        session: jest.fn(),
      },
    },
  };
});

describe('SessionManager', () => {
  const mockSession: Session = {
    access_token: 'mock-access-token',
    refresh_token: 'mock-refresh-token',
    expires_at: Math.floor(Date.now() / 1000) + 3600, // Expires in 1 hour
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
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateSession', () => {
    it('should return "blocked" when no session exists', async () => {
      (useAuth.getState as jest.Mock).mockReturnValue({
        session: null,
        lastValidatedAt: null,
      });

      const mode = await sessionManager.validateSession();
      expect(mode).toBe('blocked');
    });

    it('should return "full" when session is new (never validated)', async () => {
      (useAuth.getState as jest.Mock).mockReturnValue({
        session: mockSession,
        lastValidatedAt: null,
      });

      const mode = await sessionManager.validateSession();
      expect(mode).toBe('full');
    });

    it('should return "full" when session age is less than 7 days', async () => {
      const now = Date.now();
      const threeDaysAgo = now - 3 * 24 * 60 * 60 * 1000;

      (useAuth.getState as jest.Mock).mockReturnValue({
        session: mockSession,
        lastValidatedAt: threeDaysAgo,
      });

      const mode = await sessionManager.validateSession();
      expect(mode).toBe('full');
    });

    it('should return "readonly" when session age is between 7-30 days', async () => {
      const now = Date.now();
      const fifteenDaysAgo = now - 15 * 24 * 60 * 60 * 1000;

      (useAuth.getState as jest.Mock).mockReturnValue({
        session: mockSession,
        lastValidatedAt: fifteenDaysAgo,
      });

      const mode = await sessionManager.validateSession();
      expect(mode).toBe('readonly');
    });

    it('should return "blocked" when session age is greater than 30 days', async () => {
      const now = Date.now();
      const fortyDaysAgo = now - 40 * 24 * 60 * 60 * 1000;

      (useAuth.getState as jest.Mock).mockReturnValue({
        session: mockSession,
        lastValidatedAt: fortyDaysAgo,
      });

      const mode = await sessionManager.validateSession();
      expect(mode).toBe('blocked');
    });
  });

  describe('refreshSession', () => {
    it('should refresh session successfully and update store', async () => {
      const updateSession = jest.fn();
      (useAuth.getState as jest.Mock).mockReturnValue({
        session: mockSession,
        updateSession,
      });

      const refreshedSession = {
        ...mockSession,
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
      };

      (supabase.auth.refreshSession as jest.Mock).mockResolvedValue({
        data: { session: refreshedSession },
        error: null,
      });

      (deriveSessionKey as jest.Mock).mockResolvedValueOnce('old-session-key');
      (deriveSessionKey as jest.Mock).mockResolvedValueOnce('new-session-key');

      const result = await sessionManager.refreshSession();

      expect(result).toEqual(refreshedSession);
      expect(updateSession).toHaveBeenCalledWith(refreshedSession);
      expect(deriveSessionKey).toHaveBeenCalledWith(mockSession.refresh_token);
      expect(deriveSessionKey).toHaveBeenCalledWith(
        refreshedSession.refresh_token
      );
    });

    it('should return null when refresh fails with error', async () => {
      (useAuth.getState as jest.Mock).mockReturnValue({
        session: mockSession,
        updateSession: jest.fn(),
      });

      (supabase.auth.refreshSession as jest.Mock).mockResolvedValue({
        data: { session: null },
        error: { message: 'Refresh failed' },
      });

      const result = await sessionManager.refreshSession();

      expect(result).toBeNull();
    });

    it('should return null when refresh throws exception', async () => {
      (useAuth.getState as jest.Mock).mockReturnValue({
        session: mockSession,
        updateSession: jest.fn(),
      });

      (supabase.auth.refreshSession as jest.Mock).mockRejectedValue(
        new Error('Network error')
      );

      const result = await sessionManager.refreshSession();

      expect(result).toBeNull();
    });
  });

  describe('isSessionExpired', () => {
    it('should return true when no session exists', () => {
      (useAuth.getState as jest.Mock).mockReturnValue({
        session: null,
      });

      const expired = sessionManager.isSessionExpired();
      expect(expired).toBe(true);
    });

    it('should return true when session has no expires_at', () => {
      (useAuth.getState as jest.Mock).mockReturnValue({
        session: { ...mockSession, expires_at: undefined },
      });

      const expired = sessionManager.isSessionExpired();
      expect(expired).toBe(true);
    });

    it('should return false when session is not expired', () => {
      const futureExpiry = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      (useAuth.getState as jest.Mock).mockReturnValue({
        session: { ...mockSession, expires_at: futureExpiry },
      });

      const expired = sessionManager.isSessionExpired();
      expect(expired).toBe(false);
    });

    it('should return true when session is expired', () => {
      const pastExpiry = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
      (useAuth.getState as jest.Mock).mockReturnValue({
        session: { ...mockSession, expires_at: pastExpiry },
      });

      const expired = sessionManager.isSessionExpired();
      expect(expired).toBe(true);
    });
  });

  describe('getTimeUntilExpiry', () => {
    it('should return 0 when no session exists', () => {
      (useAuth.getState as jest.Mock).mockReturnValue({
        session: null,
      });

      const timeRemaining = sessionManager.getTimeUntilExpiry();
      expect(timeRemaining).toBe(0);
    });

    it('should return 0 when session has no expires_at', () => {
      (useAuth.getState as jest.Mock).mockReturnValue({
        session: { ...mockSession, expires_at: undefined },
      });

      const timeRemaining = sessionManager.getTimeUntilExpiry();
      expect(timeRemaining).toBe(0);
    });

    it('should return correct time remaining when session is not expired', () => {
      const now = Math.floor(Date.now() / 1000);
      const expiresIn = 3600; // 1 hour
      const futureExpiry = now + expiresIn;

      (useAuth.getState as jest.Mock).mockReturnValue({
        session: { ...mockSession, expires_at: futureExpiry },
      });

      const timeRemaining = sessionManager.getTimeUntilExpiry();

      // Allow some tolerance for execution time
      expect(timeRemaining).toBeGreaterThanOrEqual(expiresIn * 1000 - 100);
      expect(timeRemaining).toBeLessThanOrEqual(expiresIn * 1000);
    });

    it('should return 0 when session is expired', () => {
      const pastExpiry = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
      (useAuth.getState as jest.Mock).mockReturnValue({
        session: { ...mockSession, expires_at: pastExpiry },
      });

      const timeRemaining = sessionManager.getTimeUntilExpiry();
      expect(timeRemaining).toBe(0);
    });
  });

  describe('forceValidation', () => {
    it('should validate session successfully and update store', async () => {
      const updateSession = jest.fn();
      (useAuth.getState as jest.Mock).mockReturnValue({
        updateSession,
      });

      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      const isValid = await sessionManager.forceValidation();

      expect(isValid).toBe(true);
      expect(updateSession).toHaveBeenCalledWith(mockSession);
    });

    it('should sign out when no valid session exists', async () => {
      const signOut = jest.fn();
      (useAuth.getState as jest.Mock).mockReturnValue({
        signOut,
        updateSession: jest.fn(),
      });

      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: null },
        error: null,
      });

      const isValid = await sessionManager.forceValidation();

      expect(isValid).toBe(false);
      expect(signOut).toHaveBeenCalled();
    });

    it('should return false when validation fails with error', async () => {
      (useAuth.getState as jest.Mock).mockReturnValue({
        signOut: jest.fn(),
        updateSession: jest.fn(),
      });

      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: null },
        error: { message: 'Validation failed' },
      });

      const isValid = await sessionManager.forceValidation();

      expect(isValid).toBe(false);
    });

    it('should return false when validation throws exception', async () => {
      (useAuth.getState as jest.Mock).mockReturnValue({
        signOut: jest.fn(),
        updateSession: jest.fn(),
      });

      (supabase.auth.getSession as jest.Mock).mockRejectedValue(
        new Error('Network error')
      );

      const isValid = await sessionManager.forceValidation();

      expect(isValid).toBe(false);
    });
  });
});
