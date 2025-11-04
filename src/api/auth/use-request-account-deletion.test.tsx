/**
 * Unit tests for account deletion request hooks
 *
 * Tests account deletion request creation and cancellation with proper
 * snake_case column name handling for Supabase.
 *
 * Requirements: 6.5, 6.6, 6.7, 6.9, 6.12
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react-native';
import React from 'react';

import { useAuth } from '@/lib/auth';

import {
  checkPendingDeletion,
  useCancelAccountDeletion,
  useRequestAccountDeletion,
} from './use-request-account-deletion';

// Mock dependencies
jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => 'mock-uuid-123'),
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        single: jest.fn(),
        eq: jest.fn(() => ({
          single: jest.fn(),
        })),
      })),
      insert: jest.fn(() => ({
        select: jest.fn(),
        single: jest.fn(),
      })),
      update: jest.fn(() => ({
        eq: jest.fn(),
      })),
    })),
  },
}));

jest.mock('@/lib/auth/auth-telemetry', () => ({
  logAuthError: jest.fn(),
  trackAuthEvent: jest.fn(),
}));

jest.mock('@/lib/auth', () => ({
  useAuth: {
    getState: jest.fn(),
  },
}));

// Create wrapper for React Query
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useRequestAccountDeletion', () => {
  describe('useRequestAccountDeletion', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test('uses snake_case column names for database operations', async () => {
      const mockUser = { id: 'user-123' };
      const mockSupabase = require('@/lib/supabase').supabase;

      // Mock the auth state
      const mockUseAuth = jest.mocked(useAuth);
      mockUseAuth.getState.mockReturnValue({
        user: mockUser,
        session: null,
        status: 'signIn',
        token: null,
        lastValidatedAt: null,
        offlineMode: 'full',
        _authOperationInProgress: false,
        signIn: jest.fn(),
        signOut: jest.fn(),
        hydrate: jest.fn(),
        updateSession: jest.fn(),
        updateUser: jest.fn(),
        updateLastValidatedAt: jest.fn(),
        setOfflineMode: jest.fn(),
        getStableSessionId: jest.fn(),
      });

      // Mock app_config query
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'app_config') {
          return {
            select: jest.fn(() => ({
              single: jest.fn(() =>
                Promise.resolve({
                  data: { policy_version: '1.0.0' },
                  error: null,
                })
              ),
            })),
          };
        }

        if (table === 'account_deletion_requests') {
          return {
            insert: jest.fn(() => Promise.resolve({ error: null })),
          };
        }

        if (table === 'audit_logs') {
          return {
            insert: jest.fn(() => Promise.resolve({ error: null })),
          };
        }

        return {} as any;
      });

      const { result } = renderHook(() => useRequestAccountDeletion(), {
        wrapper: createWrapper(),
      });

      await result.current.mutateAsync({ reason: 'Test deletion' });

      // Verify snake_case column names were used in the insert
      expect(mockSupabase.from).toHaveBeenCalledWith(
        'account_deletion_requests'
      );

      // Find the actual insert mock that was called during hook execution
      const accountDeletionResult = mockSupabase.from.mock.results.find(
        (result: any) =>
          result.value &&
          mockSupabase.from.mock.calls[result.index][0] ===
            'account_deletion_requests'
      );
      expect(accountDeletionResult).toBeDefined();
      const insertCall = accountDeletionResult.value.insert;
      expect(insertCall).toHaveBeenCalledWith(
        expect.objectContaining({
          request_id: expect.any(String),
          user_id: 'user-123',
          requested_at: expect.any(String),
          scheduled_for: expect.any(String),
          status: 'pending',
          reason: 'Test deletion',
          policy_version: '1.0.0',
        })
      );

      // Verify audit_logs also uses snake_case
      const auditLogsResult = mockSupabase.from.mock.results.find(
        (result: any) =>
          result.value &&
          mockSupabase.from.mock.calls[result.index][0] === 'audit_logs'
      );
      expect(auditLogsResult).toBeDefined();
      const auditInsertCall = auditLogsResult.value.insert;
      expect(auditInsertCall).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-123',
          event_type: 'account_deletion_requested',
          policy_version: '1.0.0',
          app_version: expect.any(String),
        })
      );
    });
  });

  describe('checkPendingDeletion', () => {
    test('uses snake_case column names in queries', async () => {
      const mockSupabase = require('@/lib/supabase').supabase;

      mockSupabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn(() =>
                Promise.resolve({
                  data: {
                    request_id: 'req-123',
                    user_id: 'user-123',
                    requested_at: '2023-01-01T00:00:00Z',
                    scheduled_for: '2023-01-31T00:00:00Z',
                    status: 'pending',
                    reason: 'Test reason',
                    policy_version: '1.0.0',
                  },
                  error: null,
                })
              ),
            })),
          })),
        })),
      });

      const result = await checkPendingDeletion('user-123');

      expect(mockSupabase.from).toHaveBeenCalledWith(
        'account_deletion_requests'
      );
      const selectChain = mockSupabase.from('account_deletion_requests').select;
      expect(selectChain).toHaveBeenCalledWith('*');

      // Verify the eq calls use snake_case
      const firstEqResult =
        mockSupabase.from.mock.results[0].value.select.mock.results[0].value;
      expect(firstEqResult.eq).toHaveBeenNthCalledWith(
        1,
        'user_id',
        'user-123'
      );

      const secondEqResult = firstEqResult.eq.mock.results[0].value;
      expect(secondEqResult.eq).toHaveBeenNthCalledWith(1, 'status', 'pending');

      // Verify the return value is mapped to camelCase
      expect(result).toEqual({
        requestId: 'req-123',
        userId: 'user-123',
        requestedAt: '2023-01-01T00:00:00Z',
        scheduledFor: '2023-01-31T00:00:00Z',
        status: 'pending',
        reason: 'Test reason',
        policyVersion: '1.0.0',
      });
    });
  });

  describe('useCancelAccountDeletion', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test('uses snake_case column names in update operations', async () => {
      const mockUser = { id: 'user-123' };
      const mockSupabase = require('@/lib/supabase').supabase;

      // Mock the auth state
      const mockUseAuth = jest.mocked(useAuth);
      mockUseAuth.getState.mockReturnValue({
        user: mockUser,
        session: null,
        status: 'signIn',
        token: null,
        lastValidatedAt: null,
        offlineMode: 'full',
        _authOperationInProgress: false,
        signIn: jest.fn(),
        signOut: jest.fn(),
        hydrate: jest.fn(),
        updateSession: jest.fn(),
        updateUser: jest.fn(),
        updateLastValidatedAt: jest.fn(),
        setOfflineMode: jest.fn(),
        getStableSessionId: jest.fn(),
      });

      // Mock the fetch query
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'account_deletion_requests') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                eq: jest.fn(() => ({
                  single: jest.fn(() =>
                    Promise.resolve({
                      data: {
                        request_id: 'req-123',
                        user_id: 'user-123',
                        status: 'pending',
                        policy_version: '1.0.0',
                      },
                      error: null,
                    })
                  ),
                })),
              })),
            })),
            update: jest.fn(() => ({
              eq: jest.fn(() => Promise.resolve({ error: null })),
            })),
          };
        }

        if (table === 'audit_logs') {
          return {
            insert: jest.fn(() => Promise.resolve({ error: null })),
          };
        }

        return {} as any;
      });

      const { result } = renderHook(() => useCancelAccountDeletion(), {
        wrapper: createWrapper(),
      });

      await result.current.mutateAsync();

      // Verify the select query uses snake_case
      const selectChain = mockSupabase.from('account_deletion_requests').select;
      const eqCalls = selectChain('*').eq;
      expect(eqCalls).toHaveBeenNthCalledWith(1, 'user_id', 'user-123');
      expect(eqCalls).toHaveBeenNthCalledWith(2, 'status', 'pending');

      // Verify the update uses snake_case
      const updateCall = mockSupabase.from('account_deletion_requests').update;
      expect(updateCall).toHaveBeenCalledWith({ status: 'cancelled' });
      const updateEqCall = updateCall({ status: 'cancelled' }).eq;
      expect(updateEqCall).toHaveBeenCalledWith('request_id', 'req-123');
    });
  });
});
