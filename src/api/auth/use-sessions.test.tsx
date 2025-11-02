/**
 * Unit tests for session tracking hooks
 *
 * Tests session query, revocation mutations, and session key derivation.
 *
 * Requirements: 6.2, 6.3, 6.4, 6.5
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import * as Crypto from 'expo-crypto';
import React from 'react';

import type { UserSession } from '@/api/auth';
import { deriveSessionKey } from '@/lib/auth/utils';

import {
  useCheckSessionRevocation,
  useRevokeAllOtherSessions,
  useRevokeSession,
  useSessions,
} from './use-sessions';

// Mock dependencies
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    auth: {
      getSession: jest.fn(),
    },
    functions: {
      invoke: jest.fn(),
    },
  },
}));

jest.mock('expo-crypto', () => ({
  digestStringAsync: jest.fn(),
  CryptoDigestAlgorithm: {
    SHA256: 'SHA-256',
  },
}));

// Import mocked modules
const { supabase } = require('@/lib/supabase');

// Test wrapper with React Query
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }

  return Wrapper;
}

describe('Session Tracking Hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('deriveSessionKey', () => {
    it('should derive session key from refresh token', async () => {
      // Arrange
      const refreshToken = 'mock-refresh-token-abc123';
      const expectedHash = 'abc123def456hash';

      (Crypto.digestStringAsync as jest.Mock).mockResolvedValueOnce(
        expectedHash
      );

      // Act
      const result = await deriveSessionKey(refreshToken);

      // Assert
      expect(result).toBe(expectedHash);
      expect(Crypto.digestStringAsync).toHaveBeenCalledWith(
        'SHA-256',
        refreshToken
      );
    });

    it('should return empty string for undefined token', async () => {
      // Act
      const result = await deriveSessionKey(undefined);

      // Assert
      expect(result).toBe('');
      expect(Crypto.digestStringAsync).not.toHaveBeenCalled();
    });

    it('should return empty string for empty token', async () => {
      // Act
      const result = await deriveSessionKey('');

      // Assert
      expect(result).toBe('');
      expect(Crypto.digestStringAsync).not.toHaveBeenCalled();
    });
  });

  describe('useSessions', () => {
    it('should fetch active sessions successfully', async () => {
      // Arrange
      const mockSessions: UserSession[] = [
        {
          id: 'session-1',
          user_id: 'user-123',
          session_key: 'key-1',
          device_name: 'iPhone 14 Pro',
          device_os: 'iOS 17.0',
          app_version: '1.0.0',
          ip_address_truncated: '192.168.1.x',
          last_active_at: '2025-01-15T10:00:00Z',
          created_at: '2025-01-15T08:00:00Z',
          revoked_at: null,
        },
        {
          id: 'session-2',
          user_id: 'user-123',
          session_key: 'key-2',
          device_name: 'MacBook Pro',
          device_os: 'macOS 14.0',
          app_version: '1.0.0',
          ip_address_truncated: '10.0.0.x',
          last_active_at: '2025-01-14T15:30:00Z',
          created_at: '2025-01-10T12:00:00Z',
          revoked_at: null,
        },
      ];

      const mockSelect = jest.fn().mockReturnThis();
      const mockIs = jest.fn().mockReturnThis();
      const mockOrder = jest.fn().mockResolvedValueOnce({
        data: mockSessions,
        error: null,
      });

      supabase.from.mockReturnValueOnce({
        select: mockSelect,
      });

      mockSelect.mockReturnValueOnce({
        is: mockIs,
      });

      mockIs.mockReturnValueOnce({
        order: mockOrder,
      });

      // Act
      const { result } = renderHook(() => useSessions(), {
        wrapper: createWrapper(),
      });

      // Assert
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(supabase.from).toHaveBeenCalledWith('user_sessions');
      expect(mockSelect).toHaveBeenCalledWith('*');
      expect(mockIs).toHaveBeenCalledWith('revoked_at', null);
      expect(mockOrder).toHaveBeenCalledWith('last_active_at', {
        ascending: false,
      });
      expect(result.current.data).toEqual(mockSessions);
    });

    it('should handle fetch error gracefully', async () => {
      // Arrange
      const mockError = new Error('Database error');

      const mockSelect = jest.fn().mockReturnThis();
      const mockIs = jest.fn().mockReturnThis();
      const mockOrder = jest.fn().mockResolvedValueOnce({
        data: null,
        error: mockError,
      });

      supabase.from.mockReturnValueOnce({
        select: mockSelect,
      });

      mockSelect.mockReturnValueOnce({
        is: mockIs,
      });

      mockIs.mockReturnValueOnce({
        order: mockOrder,
      });

      // Act
      const { result } = renderHook(() => useSessions(), {
        wrapper: createWrapper(),
      });

      // Assert
      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toEqual(mockError);
    });

    it('should return empty array when no sessions exist', async () => {
      // Arrange
      const mockSelect = jest.fn().mockReturnThis();
      const mockIs = jest.fn().mockReturnThis();
      const mockOrder = jest.fn().mockResolvedValueOnce({
        data: [],
        error: null,
      });

      supabase.from.mockReturnValueOnce({
        select: mockSelect,
      });

      mockSelect.mockReturnValueOnce({
        is: mockIs,
      });

      mockIs.mockReturnValueOnce({
        order: mockOrder,
      });

      // Act
      const { result } = renderHook(() => useSessions(), {
        wrapper: createWrapper(),
      });

      // Assert
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual([]);
    });
  });

  describe('useRevokeSession', () => {
    it('should revoke a specific session successfully', async () => {
      // Arrange
      const sessionKey = 'session-key-to-revoke';
      const mockSession = {
        access_token: 'current-token',
        refresh_token: 'current-refresh',
      };

      supabase.auth.getSession.mockResolvedValueOnce({
        data: { session: mockSession },
        error: null,
      });

      supabase.functions.invoke.mockResolvedValueOnce({
        data: {},
        error: null,
      });

      // Act
      const { result } = renderHook(() => useRevokeSession(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({ sessionKey });

      // Assert
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(supabase.auth.getSession).toHaveBeenCalled();
      expect(supabase.functions.invoke).toHaveBeenCalledWith('revoke-session', {
        body: { sessionKey },
      });
    });

    it('should throw error when no active session', async () => {
      // Arrange
      supabase.auth.getSession.mockResolvedValueOnce({
        data: { session: null },
        error: null,
      });

      // Act
      const { result } = renderHook(() => useRevokeSession(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({ sessionKey: 'any-key' });

      // Assert
      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error?.message).toBe('No active session');
      expect(supabase.functions.invoke).not.toHaveBeenCalled();
    });

    it('should handle Edge Function error', async () => {
      // Arrange
      const sessionKey = 'session-key';
      const mockSession = {
        access_token: 'token',
        refresh_token: 'refresh',
      };

      supabase.auth.getSession.mockResolvedValueOnce({
        data: { session: mockSession },
        error: null,
      });

      supabase.functions.invoke.mockResolvedValueOnce({
        data: null,
        error: { message: 'Session not found' },
      });

      // Act
      const { result } = renderHook(() => useRevokeSession(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({ sessionKey });

      // Assert
      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error?.message).toBe('Session not found');
    });
  });

  describe('useRevokeAllOtherSessions', () => {
    it('should revoke all other sessions successfully', async () => {
      // Arrange
      const mockSession = {
        access_token: 'current-token',
        refresh_token: 'current-refresh',
      };
      const sessionKey = 'hashed-session-key';

      supabase.auth.getSession.mockResolvedValueOnce({
        data: { session: mockSession },
        error: null,
      });

      (Crypto.digestStringAsync as jest.Mock).mockResolvedValueOnce(sessionKey);

      supabase.functions.invoke.mockResolvedValueOnce({
        data: {},
        error: null,
      });

      // Act
      const { result } = renderHook(() => useRevokeAllOtherSessions(), {
        wrapper: createWrapper(),
      });

      result.current.mutate();

      // Assert
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(supabase.auth.getSession).toHaveBeenCalled();
      expect(Crypto.digestStringAsync).toHaveBeenCalledWith(
        'SHA-256',
        mockSession.refresh_token
      );
      expect(supabase.functions.invoke).toHaveBeenCalledWith(
        'revoke-all-sessions-except',
        {
          body: { currentSessionKey: sessionKey },
        }
      );
    });

    it('should throw error when no active session', async () => {
      // Arrange
      supabase.auth.getSession.mockResolvedValueOnce({
        data: { session: null },
        error: null,
      });

      // Act
      const { result } = renderHook(() => useRevokeAllOtherSessions(), {
        wrapper: createWrapper(),
      });

      result.current.mutate();

      // Assert
      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error?.message).toBe('No active session');
      expect(supabase.functions.invoke).not.toHaveBeenCalled();
    });

    it('should handle Edge Function error', async () => {
      // Arrange
      const mockSession = {
        access_token: 'token',
        refresh_token: 'refresh-token-123',
      };
      const sessionKey = 'hashed-session-key';

      supabase.auth.getSession.mockResolvedValueOnce({
        data: { session: mockSession },
        error: null,
      });

      (Crypto.digestStringAsync as jest.Mock).mockResolvedValueOnce(sessionKey);

      supabase.functions.invoke.mockResolvedValueOnce({
        data: null,
        error: { message: 'Failed to revoke sessions' },
      });

      // Act
      const { result } = renderHook(() => useRevokeAllOtherSessions(), {
        wrapper: createWrapper(),
      });

      result.current.mutate();

      // Assert
      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error?.message).toBe('Failed to revoke sessions');
    });
  });

  describe('useCheckSessionRevocation', () => {
    it('should detect revoked session', async () => {
      // Arrange
      const mockSession = {
        access_token: 'token',
        refresh_token: 'refresh-token-123',
      };

      const sessionKey = 'hashed-session-key';

      supabase.auth.getSession.mockResolvedValueOnce({
        data: { session: mockSession },
        error: null,
      });

      (Crypto.digestStringAsync as jest.Mock).mockResolvedValueOnce(sessionKey);

      const mockSelect = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockReturnThis();
      const mockMaybeSingle = jest.fn().mockResolvedValueOnce({
        data: { revoked_at: '2025-01-15T10:00:00Z' },
        error: null,
      });

      supabase.from.mockReturnValueOnce({
        select: mockSelect,
      });

      mockSelect.mockReturnValueOnce({
        eq: mockEq,
      });

      mockEq.mockReturnValueOnce({
        maybeSingle: mockMaybeSingle,
      });

      // Act
      const { result } = renderHook(() => useCheckSessionRevocation(), {
        wrapper: createWrapper(),
      });

      // Manually trigger the query and wait for it to complete
      const refetchResult = await result.current.refetch();

      // Assert
      expect(refetchResult.data).toBe(true);
      expect(supabase.from).toHaveBeenCalledWith('user_sessions');
      expect(mockSelect).toHaveBeenCalledWith('revoked_at');
      expect(mockEq).toHaveBeenCalledWith('session_key', sessionKey);
    });

    it('should return false for active session', async () => {
      // Arrange
      const mockSession = {
        access_token: 'token',
        refresh_token: 'refresh-token-456',
      };

      const sessionKey = 'hashed-key-456';

      supabase.auth.getSession.mockResolvedValueOnce({
        data: { session: mockSession },
        error: null,
      });

      (Crypto.digestStringAsync as jest.Mock).mockResolvedValueOnce(sessionKey);

      const mockSelect = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockReturnThis();
      const mockMaybeSingle = jest.fn().mockResolvedValueOnce({
        data: { revoked_at: null }, // Not revoked
        error: null,
      });

      supabase.from.mockReturnValueOnce({
        select: mockSelect,
      });

      mockSelect.mockReturnValueOnce({
        eq: mockEq,
      });

      mockEq.mockReturnValueOnce({
        maybeSingle: mockMaybeSingle,
      });

      // Act
      const { result } = renderHook(() => useCheckSessionRevocation(), {
        wrapper: createWrapper(),
      });

      // Manually trigger the query and wait for it to complete
      const refetchResult = await result.current.refetch();

      // Assert
      expect(refetchResult.data).toBe(false);
    });

    it('should return false when no session exists', async () => {
      // Arrange
      supabase.auth.getSession.mockResolvedValueOnce({
        data: { session: null },
        error: null,
      });

      // Act
      const { result } = renderHook(() => useCheckSessionRevocation(), {
        wrapper: createWrapper(),
      });

      // Manually trigger the query and wait for it to complete
      const refetchResult = await result.current.refetch();

      // Assert
      expect(refetchResult.data).toBe(false);
      expect(Crypto.digestStringAsync).not.toHaveBeenCalled();
    });

    it('should return false when session not found in database', async () => {
      // Arrange
      const mockSession = {
        access_token: 'token',
        refresh_token: 'refresh-token-789',
      };

      const sessionKey = 'hashed-key-789';

      supabase.auth.getSession.mockResolvedValueOnce({
        data: { session: mockSession },
        error: null,
      });

      (Crypto.digestStringAsync as jest.Mock).mockResolvedValueOnce(sessionKey);

      const mockSelect = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockReturnThis();
      const mockMaybeSingle = jest.fn().mockResolvedValueOnce({
        data: null, // Session not found
        error: null,
      });

      supabase.from.mockReturnValueOnce({
        select: mockSelect,
      });

      mockSelect.mockReturnValueOnce({
        eq: mockEq,
      });

      mockEq.mockReturnValueOnce({
        maybeSingle: mockMaybeSingle,
      });

      // Act
      const { result } = renderHook(() => useCheckSessionRevocation(), {
        wrapper: createWrapper(),
      });

      // Manually trigger the query and wait for it to complete
      const refetchResult = await result.current.refetch();

      // Assert
      expect(refetchResult.data).toBe(false);
    });

    it('should handle database error gracefully', async () => {
      // Arrange
      const mockSession = {
        access_token: 'token',
        refresh_token: 'refresh-token-error',
      };

      const sessionKey = 'hashed-key-error';

      supabase.auth.getSession.mockResolvedValueOnce({
        data: { session: mockSession },
        error: null,
      });

      (Crypto.digestStringAsync as jest.Mock).mockResolvedValueOnce(sessionKey);

      const mockSelect = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockReturnThis();
      const mockMaybeSingle = jest.fn().mockResolvedValueOnce({
        data: null,
        error: new Error('Database connection failed'),
      });

      supabase.from.mockReturnValueOnce({
        select: mockSelect,
      });

      mockSelect.mockReturnValueOnce({
        eq: mockEq,
      });

      mockEq.mockReturnValueOnce({
        maybeSingle: mockMaybeSingle,
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // Act
      const { result } = renderHook(() => useCheckSessionRevocation(), {
        wrapper: createWrapper(),
      });

      // Manually trigger the query and wait for it to complete
      const refetchResult = await result.current.refetch();

      // Assert
      expect(refetchResult.data).toBe(false); // Don't block user on error
      expect(consoleSpy).toHaveBeenCalledWith(
        'Session revocation check error:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });
});
