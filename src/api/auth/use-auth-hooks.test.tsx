/**
 * Unit tests for authentication hooks
 *
 * Tests all auth operations including sign in, sign up, OAuth,
 * password reset, email verification, error mapping, and lockout enforcement.
 *
 * Requirements: 1.1, 1.2, 1.3, 2.3, 3.1, 3.4, 4.1, 8.1, 15.1
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import React from 'react';

import { useAuth } from '@/lib/auth';

import {
  getLockoutMinutes,
  isAccountLocked,
  mapAuthError,
} from './error-mapper';
import {
  useResendVerificationEmail,
  useVerifyEmail,
} from './use-email-verification';
import {
  useExchangeOAuthCode,
  useSignInWithIdToken,
  useSignInWithOAuth,
} from './use-oauth';
import {
  useConfirmPasswordReset,
  useResetPassword,
} from './use-password-reset';
import { useSignIn } from './use-sign-in';
import { useSignUp, validatePassword } from './use-sign-up';

// Mock dependencies
jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signUp: jest.fn(),
      signInWithOAuth: jest.fn(),
      exchangeCodeForSession: jest.fn(),
      signInWithIdToken: jest.fn(),
      resetPasswordForEmail: jest.fn(),
      verifyOtp: jest.fn(),
      resend: jest.fn(),
      updateUser: jest.fn(),
    },
  },
}));

jest.mock('@/lib/auth', () => ({
  useAuth: {
    getState: jest.fn(),
  },
}));

jest.mock('@/lib/privacy-consent', () => ({
  hasConsent: jest.fn(),
}));

jest.mock('expo-constants', () => ({
  default: {
    expoConfig: {
      version: '1.0.0',
    },
  },
}));

// Import mocked modules
const { supabase } = require('@/lib/supabase');
const { hasConsent } = require('@/lib/privacy-consent');

// Test wrapper with React Query
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  function Wrapper({ children }: any) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }

  return Wrapper;
}

describe('Auth Hooks', () => {
  // Mock auth store
  const mockSignIn = jest.fn();
  const mockUpdateUser = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock useAuth store
    (useAuth.getState as any).mockReturnValue({
      signIn: mockSignIn,
      updateUser: mockUpdateUser,
      user: null,
    });

    // Default: no consent
    (hasConsent as jest.Mock).mockReturnValue(false);

    // Mock fetch for Edge Functions
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('useSignIn', () => {
    it('should successfully sign in with valid credentials', async () => {
      // Arrange
      const mockSession = {
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
        expires_in: 3600,
        expires_at: Date.now() + 3600000,
        token_type: 'bearer',
        user: {
          id: 'user-123',
          email: 'test@example.com',
        },
      };

      const mockResponse = {
        success: true,
        session: {
          access_token: mockSession.access_token,
          refresh_token: mockSession.refresh_token,
          expires_in: mockSession.expires_in,
          expires_at: mockSession.expires_at,
        },
        user: mockSession.user,
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      // Act
      const { result } = renderHook(() => useSignIn(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({
        email: 'test@example.com',
        password: 'Password123!',
      });

      // Assert
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockSignIn).toHaveBeenCalledWith({
        session: expect.objectContaining({
          access_token: 'mock-access-token',
          refresh_token: 'mock-refresh-token',
        }),
        user: mockSession.user,
      });
    });

    it('should handle invalid credentials error', async () => {
      // Arrange
      const mockErrorResponse = {
        success: false,
        code: 'INVALID_CREDENTIALS',
        metadata: { lockout: false },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => mockErrorResponse,
      });

      // Act
      const { result } = renderHook(() => useSignIn(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({
        email: 'test@example.com',
        password: 'WrongPassword',
      });

      // Assert
      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error?.message).toBe(
        'auth.error_invalid_credentials'
      );
      expect(mockSignIn).not.toHaveBeenCalled();
    });

    it('should handle account lockout error', async () => {
      // Arrange
      const mockErrorResponse = {
        success: false,
        code: 'INVALID_CREDENTIALS',
        metadata: {
          lockout: true,
          minutes_remaining: 15,
        },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => mockErrorResponse,
      });

      // Act
      const { result } = renderHook(() => useSignIn(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({
        email: 'test@example.com',
        password: 'WrongPassword',
      });

      // Assert
      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error?.message).toBe('auth.error_account_locked');
      expect((result.current.error as any)?.metadata?.lockout).toBe(true);
    });

    it('should track analytics when consent is granted', async () => {
      // Arrange
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      (hasConsent as jest.Mock).mockReturnValue(true);

      const mockResponse = {
        success: true,
        session: {
          access_token: 'token',
          refresh_token: 'refresh',
          expires_in: 3600,
          expires_at: Date.now() + 3600000,
        },
        user: { id: 'user-123', email: 'test@example.com' },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      // Act
      const { result } = renderHook(() => useSignIn(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({
        email: 'test@example.com',
        password: 'Password123!',
      });

      // Assert
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        '[Auth] Sign in successful (analytics consented)'
      );

      consoleSpy.mockRestore();
    });

    it('should handle offline login attempt', async () => {
      // Arrange
      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error('Network request failed')
      );

      // Act
      const { result } = renderHook(() => useSignIn(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({
        email: 'test@example.com',
        password: 'Password123!',
      });

      // Assert
      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error?.message).toContain('Network');
    });
  });

  describe('useSignUp', () => {
    it('should successfully sign up with valid credentials', async () => {
      // Arrange
      const mockUser = {
        id: 'user-123',
        email: 'newuser@example.com',
        email_confirmed_at: null,
      };

      supabase.auth.signUp.mockResolvedValueOnce({
        data: {
          session: null,
          user: mockUser,
        },
        error: null,
      });

      // Act
      const { result } = renderHook(() => useSignUp(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({
        email: 'newuser@example.com',
        password: 'SecurePass123!',
      });

      // Assert
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(supabase.auth.signUp).toHaveBeenCalledWith({
        email: 'newuser@example.com',
        password: 'SecurePass123!',
        options: {
          emailRedirectTo: 'growbro://verify-email',
        },
      });
    });

    it('should reject password that is too short', async () => {
      // Act
      const { result } = renderHook(() => useSignUp(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({
        email: 'test@example.com',
        password: 'Short1',
      });

      // Assert
      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error?.message).toBe(
        'auth.error_password_too_short'
      );
    });

    it('should reject password without uppercase letter', async () => {
      // Act
      const { result } = renderHook(() => useSignUp(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({
        email: 'test@example.com',
        password: 'password123',
      });

      // Assert
      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error?.message).toBe(
        'auth.error_password_no_uppercase'
      );
    });

    it('should reject password without lowercase letter', async () => {
      // Act
      const { result } = renderHook(() => useSignUp(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({
        email: 'test@example.com',
        password: 'PASSWORD123',
      });

      // Assert
      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error?.message).toBe(
        'auth.error_password_no_lowercase'
      );
    });

    it('should reject password without number', async () => {
      // Act
      const { result } = renderHook(() => useSignUp(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({
        email: 'test@example.com',
        password: 'PasswordOnly',
      });

      // Assert
      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error?.message).toBe(
        'auth.error_password_no_number'
      );
    });

    it('should handle email already exists error', async () => {
      // Arrange
      supabase.auth.signUp.mockResolvedValueOnce({
        data: { session: null, user: null },
        error: {
          message: 'User already registered',
          status: 422,
        },
      });

      // Act
      const { result } = renderHook(() => useSignUp(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({
        email: 'existing@example.com',
        password: 'ValidPass123!',
      });

      // Assert
      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error?.message).toBe('auth.error_email_exists');
    });
  });

  describe('validatePassword', () => {
    it('should validate a strong password', () => {
      const result = validatePassword('SecurePass123!');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return errors for weak password', () => {
      const result = validatePassword('weak');
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('OAuth Hooks', () => {
    describe('useSignInWithOAuth', () => {
      it('should initiate Apple OAuth flow', async () => {
        // Arrange
        supabase.auth.signInWithOAuth.mockResolvedValueOnce({
          data: { url: 'https://apple.com/oauth' },
          error: null,
        });

        // Act
        const { result } = renderHook(() => useSignInWithOAuth(), {
          wrapper: createWrapper(),
        });

        result.current.mutate({ provider: 'apple' });

        // Assert
        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(supabase.auth.signInWithOAuth).toHaveBeenCalledWith({
          provider: 'apple',
          options: {
            redirectTo: 'growbro://auth/callback',
          },
        });

        expect(result.current.data).toEqual({
          provider: 'apple',
          url: 'https://apple.com/oauth',
        });
      });

      it('should initiate Google OAuth flow', async () => {
        // Arrange
        supabase.auth.signInWithOAuth.mockResolvedValueOnce({
          data: { url: 'https://google.com/oauth' },
          error: null,
        });

        // Act
        const { result } = renderHook(() => useSignInWithOAuth(), {
          wrapper: createWrapper(),
        });

        result.current.mutate({ provider: 'google' });

        // Assert
        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data?.url).toBe('https://google.com/oauth');
      });

      it('should handle OAuth initiation failure', async () => {
        // Arrange
        supabase.auth.signInWithOAuth.mockResolvedValueOnce({
          data: { url: null },
          error: { message: 'OAuth failed' },
        });

        // Act
        const { result } = renderHook(() => useSignInWithOAuth(), {
          wrapper: createWrapper(),
        });

        result.current.mutate({ provider: 'apple' });

        // Assert
        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });
      });
    });

    describe('useExchangeOAuthCode', () => {
      it('should exchange code for session', async () => {
        // Arrange
        const mockSession = {
          access_token: 'oauth-token',
          refresh_token: 'oauth-refresh',
          expires_in: 3600,
          expires_at: Date.now() + 3600000,
          token_type: 'bearer' as const,
          user: {
            id: 'user-123',
            email: 'oauth@example.com',
          },
        };

        supabase.auth.exchangeCodeForSession.mockResolvedValueOnce({
          data: {
            session: mockSession,
            user: mockSession.user,
          },
          error: null,
        });

        // Act
        const { result } = renderHook(() => useExchangeOAuthCode(), {
          wrapper: createWrapper(),
        });

        result.current.mutate({ code: 'auth-code-123' });

        // Assert
        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(supabase.auth.exchangeCodeForSession).toHaveBeenCalledWith(
          'auth-code-123'
        );

        expect(mockSignIn).toHaveBeenCalledWith({
          session: mockSession,
          user: mockSession.user,
        });
      });

      it('should handle invalid authorization code', async () => {
        // Arrange
        supabase.auth.exchangeCodeForSession.mockResolvedValueOnce({
          data: { session: null, user: null },
          error: { message: 'Invalid authorization code' },
        });

        // Act
        const { result } = renderHook(() => useExchangeOAuthCode(), {
          wrapper: createWrapper(),
        });

        result.current.mutate({ code: 'invalid-code' });

        // Assert
        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });

        expect(mockSignIn).not.toHaveBeenCalled();
      });
    });

    describe('useSignInWithIdToken', () => {
      it('should sign in with Apple ID token', async () => {
        // Arrange
        const mockSession = {
          access_token: 'apple-token',
          refresh_token: 'apple-refresh',
          expires_in: 3600,
          expires_at: Date.now() + 3600000,
          token_type: 'bearer' as const,
          user: {
            id: 'user-123',
            email: 'apple@example.com',
          },
        };

        supabase.auth.signInWithIdToken.mockResolvedValueOnce({
          data: {
            session: mockSession,
            user: mockSession.user,
          },
          error: null,
        });

        // Act
        const { result } = renderHook(() => useSignInWithIdToken(), {
          wrapper: createWrapper(),
        });

        result.current.mutate({
          provider: 'apple',
          idToken: 'apple-id-token',
          nonce: 'nonce-123',
        });

        // Assert
        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(supabase.auth.signInWithIdToken).toHaveBeenCalledWith({
          provider: 'apple',
          token: 'apple-id-token',
          nonce: 'nonce-123',
        });
      });
    });
  });

  describe('Password Reset Hooks', () => {
    describe('useResetPassword', () => {
      it('should request password reset email', async () => {
        // Arrange
        supabase.auth.resetPasswordForEmail.mockResolvedValueOnce({
          data: {},
          error: null,
        });

        // Act
        const { result } = renderHook(() => useResetPassword(), {
          wrapper: createWrapper(),
        });

        result.current.mutate({ email: 'reset@example.com' });

        // Assert
        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith(
          'reset@example.com',
          {
            redirectTo: 'growbro://reset-password',
          }
        );
      });

      it('should not reveal if email does not exist', async () => {
        // Arrange - Supabase returns success even if email doesn't exist
        supabase.auth.resetPasswordForEmail.mockResolvedValueOnce({
          data: {},
          error: null,
        });

        // Act
        const { result } = renderHook(() => useResetPassword(), {
          wrapper: createWrapper(),
        });

        result.current.mutate({ email: 'nonexistent@example.com' });

        // Assert
        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });
      });
    });

    describe('useConfirmPasswordReset', () => {
      it('should confirm password reset with valid token', async () => {
        // Arrange
        supabase.auth.verifyOtp.mockResolvedValueOnce({
          data: { session: {}, user: {} },
          error: null,
        });

        supabase.auth.updateUser.mockResolvedValueOnce({
          data: { user: {} },
          error: null,
        });

        // Act
        const { result } = renderHook(() => useConfirmPasswordReset(), {
          wrapper: createWrapper(),
        });

        result.current.mutate({
          tokenHash: 'valid-token-hash',
          newPassword: 'NewSecure123!',
        });

        // Assert
        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(supabase.auth.verifyOtp).toHaveBeenCalledWith({
          type: 'recovery',
          token_hash: 'valid-token-hash',
        });

        expect(supabase.auth.updateUser).toHaveBeenCalledWith({
          password: 'NewSecure123!',
        });
      });

      it('should handle invalid or expired token', async () => {
        // Arrange
        supabase.auth.verifyOtp.mockResolvedValueOnce({
          data: { session: null, user: null },
          error: { message: 'Token has expired or is invalid' },
        });

        // Act
        const { result } = renderHook(() => useConfirmPasswordReset(), {
          wrapper: createWrapper(),
        });

        result.current.mutate({
          tokenHash: 'expired-token',
          newPassword: 'NewPassword123!',
        });

        // Assert
        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });

        expect(result.current.error?.message).toBe('auth.error_invalid_token');
      });
    });
  });

  describe('Email Verification Hooks', () => {
    describe('useVerifyEmail', () => {
      it('should verify email with valid token', async () => {
        // Arrange
        const mockUser = {
          id: 'user-123',
          email: 'verify@example.com',
          email_confirmed_at: null,
        };

        (useAuth.getState as any).mockReturnValue({
          signIn: mockSignIn,
          updateUser: mockUpdateUser,
          user: mockUser,
        });

        supabase.auth.verifyOtp.mockResolvedValueOnce({
          data: { session: {}, user: mockUser },
          error: null,
        });

        // Act
        const { result } = renderHook(() => useVerifyEmail(), {
          wrapper: createWrapper(),
        });

        result.current.mutate({
          tokenHash: 'verify-token-hash',
          type: 'signup',
        });

        // Assert
        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(supabase.auth.verifyOtp).toHaveBeenCalledWith({
          type: 'signup',
          token_hash: 'verify-token-hash',
        });

        expect(mockUpdateUser).toHaveBeenCalledWith(
          expect.objectContaining({
            email_confirmed_at: expect.any(String),
          })
        );
      });

      it('should handle invalid verification token', async () => {
        // Arrange
        supabase.auth.verifyOtp.mockResolvedValueOnce({
          data: { session: null, user: null },
          error: { message: 'Token invalid or expired' },
        });

        // Act
        const { result } = renderHook(() => useVerifyEmail(), {
          wrapper: createWrapper(),
        });

        result.current.mutate({
          tokenHash: 'invalid-token',
          type: 'signup',
        });

        // Assert
        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });

        expect(result.current.error?.message).toBe('auth.error_invalid_token');
      });
    });

    describe('useResendVerificationEmail', () => {
      it('should resend verification email', async () => {
        // Arrange
        supabase.auth.resend.mockResolvedValueOnce({
          data: {},
          error: null,
        });

        // Act
        const { result } = renderHook(() => useResendVerificationEmail(), {
          wrapper: createWrapper(),
        });

        result.current.mutate({ email: 'resend@example.com' });

        // Assert
        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(supabase.auth.resend).toHaveBeenCalledWith({
          type: 'signup',
          email: 'resend@example.com',
        });
      });
    });
  });

  describe('Error Mapper', () => {
    it('should map invalid credentials error', () => {
      const error = {
        code: 'INVALID_CREDENTIALS',
        metadata: { lockout: false },
      };

      const result = mapAuthError(error);
      expect(result).toBe('auth.error_invalid_credentials');
    });

    it('should map account locked error', () => {
      const error = {
        code: 'INVALID_CREDENTIALS',
        metadata: { lockout: true },
      };

      const result = mapAuthError(error);
      expect(result).toBe('auth.error_account_locked');
    });

    it('should map email already exists error', () => {
      const error = {
        message: 'User already registered',
        status: 422,
      };

      const result = mapAuthError(error);
      expect(result).toBe('auth.error_email_exists');
    });

    it('should map rate limit error', () => {
      const error = {
        message: 'Rate limit exceeded',
        status: 429,
      };

      const result = mapAuthError(error);
      expect(result).toBe('auth.error_rate_limit');
    });

    it('should map network error', () => {
      const error = {
        message: 'Network request failed',
      };

      const result = mapAuthError(error);
      expect(result).toBe('auth.error_network');
    });

    it('should map invalid token error', () => {
      const error = {
        message: 'Token has expired or is invalid',
      };

      const result = mapAuthError(error);
      expect(result).toBe('auth.error_invalid_token');
    });

    it('should map session expired error', () => {
      const error = {
        message: 'Session expired',
      };

      const result = mapAuthError(error);
      expect(result).toBe('auth.error_session_expired');
    });

    it('should fallback to generic error', () => {
      const error = {
        message: 'Unknown error occurred',
      };

      const result = mapAuthError(error);
      expect(result).toBe('auth.error_generic');
    });
  });

  describe('Lockout Helper Functions', () => {
    it('should detect account lockout', () => {
      const error = {
        code: 'INVALID_CREDENTIALS',
        metadata: { lockout: true },
      };

      expect(isAccountLocked(error)).toBe(true);
    });

    it('should return false for non-lockout error', () => {
      const error = {
        code: 'INVALID_CREDENTIALS',
        metadata: { lockout: false },
      };

      expect(isAccountLocked(error)).toBe(false);
    });

    it('should get lockout minutes', () => {
      const error = {
        code: 'INVALID_CREDENTIALS',
        metadata: {
          lockout: true,
          minutes_remaining: 15,
        },
      };

      expect(getLockoutMinutes(error)).toBe(15);
    });

    it('should return null for non-lockout error', () => {
      const error = {
        code: 'INVALID_CREDENTIALS',
        metadata: { lockout: false },
      };

      expect(getLockoutMinutes(error)).toBeNull();
    });
  });
});
