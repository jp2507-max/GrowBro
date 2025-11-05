/**
 * Unit tests for account deletion request hooks
 *
 * Tests account deletion request creation and cancellation with proper
 * snake_case column name handling for Supabase.
 *
 * Requirements: 6.5, 6.6, 6.7, 6.9, 6.12
 */

import type { User } from '@supabase/supabase-js';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react-native';
import React from 'react';

import { useAuth } from '@/lib/auth';

import {
  checkPendingDeletion,
  useCancelAccountDeletion,
  useRequestAccountDeletion,
} from './use-request-account-deletion';

// Centralized mock user for both test suites
const mockUser: User = {
  id: 'user-123',
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
      const accountDeletionIndex = mockSupabase.from.mock.calls.findIndex(
        (call: any) => call[0] === 'account_deletion_requests'
      );
      expect(accountDeletionIndex).toBeGreaterThanOrEqual(0);
      const insertCall =
        mockSupabase.from.mock.results[accountDeletionIndex].value.insert;
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
      const auditLogsIndex = mockSupabase.from.mock.calls.findIndex(
        (call: any) => call[0] === 'audit_logs'
      );
      expect(auditLogsIndex).toBeGreaterThanOrEqual(0);
      const auditInsertCall =
        mockSupabase.from.mock.results[auditLogsIndex].value.insert;
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

      // Create individual mocks for the chain
      const singleMock = jest.fn(() =>
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
      );

      const secondEqMock = jest.fn(() => ({
        single: singleMock,
      }));

      const firstEqMock = jest.fn(() => ({
        eq: secondEqMock,
      }));

      const selectMock = jest.fn(() => ({
        eq: firstEqMock,
      }));

      mockSupabase.from.mockReturnValue({
        select: selectMock,
      });

      const result = await checkPendingDeletion('user-123');

      expect(mockSupabase.from).toHaveBeenCalledWith(
        'account_deletion_requests'
      );
      expect(selectMock).toHaveBeenCalledWith('*');

      // Verify the eq calls use snake_case
      expect(firstEqMock).toHaveBeenNthCalledWith(1, 'user_id', 'user-123');
      expect(secondEqMock).toHaveBeenNthCalledWith(1, 'status', 'pending');

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

      // Mock the select chain
      const selectSingleMock = jest.fn(() =>
        Promise.resolve({
          data: {
            request_id: 'req-123',
            user_id: 'user-123',
            status: 'pending',
            policy_version: '1.0.0',
          },
          error: null,
        })
      );

      const selectSecondEqMock = jest.fn(() => ({
        single: selectSingleMock,
      }));

      const selectFirstEqMock = jest.fn(() => ({
        eq: selectSecondEqMock,
      }));

      const selectMock = jest.fn(() => ({
        eq: selectFirstEqMock,
      }));

      // Mock the update chain
      const updateEqMock = jest.fn(() => Promise.resolve({ error: null }));

      const updateMock = jest.fn(() => ({
        eq: updateEqMock,
      }));

      // Mock the audit insert
      const auditInsertMock = jest.fn(() => Promise.resolve({ error: null }));

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'account_deletion_requests') {
          return {
            select: selectMock,
            update: updateMock,
          };
        }

        if (table === 'audit_logs') {
          return {
            insert: auditInsertMock,
          };
        }

        return {} as any;
      });

      const { result } = renderHook(() => useCancelAccountDeletion(), {
        wrapper: createWrapper(),
      });

      await result.current.mutateAsync();

      // Find the builder returned for account_deletion_requests
      const accountDeletionCallIndex = mockSupabase.from.mock.calls.findIndex(
        (call: any) => call[0] === 'account_deletion_requests'
      );
      expect(accountDeletionCallIndex).toBeGreaterThanOrEqual(0);
      const builder =
        mockSupabase.from.mock.results[accountDeletionCallIndex].value;

      // Verify the select query uses snake_case
      expect(builder.select).toHaveBeenCalledWith('*');
      expect(selectFirstEqMock).toHaveBeenCalledWith('user_id', 'user-123');
      expect(selectSecondEqMock).toHaveBeenCalledWith('status', 'pending');

      // Verify the update uses snake_case
      expect(builder.update).toHaveBeenCalledWith({ status: 'cancelled' });
      expect(updateEqMock).toHaveBeenCalledWith('request_id', 'req-123');
    });

    test('rolls back status to pending when audit log fails', async () => {
      const mockSupabase = require('@/lib/supabase').supabase;
      const mockLogAuthError =
        require('@/lib/auth/auth-telemetry').logAuthError;

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

      // Mock the select chain
      const selectSingleMock = jest.fn(() =>
        Promise.resolve({
          data: {
            request_id: 'req-123',
            user_id: 'user-123',
            status: 'pending',
            policy_version: '1.0.0',
          },
          error: null,
        })
      );

      const selectSecondEqMock = jest.fn(() => ({
        single: selectSingleMock,
      }));

      const selectFirstEqMock = jest.fn(() => ({
        eq: selectSecondEqMock,
      }));

      const selectMock = jest.fn(() => ({
        eq: selectFirstEqMock,
      }));

      // Mock the update chains - first for status update, second for rollback
      let updateCallCount = 0;
      const updateMock = jest.fn(() => ({
        eq: jest.fn(() => {
          updateCallCount++;
          return Promise.resolve({ error: null });
        }),
      }));

      // Mock the audit insert to fail
      const auditInsertMock = jest.fn(() =>
        Promise.resolve({
          error: { message: 'Database connection failed' },
        })
      );

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'account_deletion_requests') {
          return {
            select: selectMock,
            update: updateMock,
          };
        }

        if (table === 'audit_logs') {
          return {
            insert: auditInsertMock,
          };
        }

        return {} as any;
      });

      const { result } = renderHook(() => useCancelAccountDeletion(), {
        wrapper: createWrapper(),
      });

      // The mutation should fail due to audit log error
      await expect(result.current.mutateAsync()).rejects.toThrow(
        'settings.delete_account.error_audit_log_failed'
      );

      // Find the builder returned for account_deletion_requests
      const accountDeletionCallIndex = mockSupabase.from.mock.calls.findIndex(
        (call: any) => call[0] === 'account_deletion_requests'
      );
      expect(accountDeletionCallIndex).toBeGreaterThanOrEqual(0);
      const builder =
        mockSupabase.from.mock.results[accountDeletionCallIndex].value;

      // Verify the initial update to 'cancelled' was called
      expect(builder.update).toHaveBeenCalledWith({ status: 'cancelled' });

      // Verify the rollback update to 'pending' was called
      expect(builder.update).toHaveBeenCalledWith({ status: 'pending' });

      // Verify both update calls were made with the correct request_id
      expect(updateCallCount).toBe(2);

      // Verify error was logged
      expect(mockLogAuthError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          errorKey: 'settings.delete_account.error_audit_log_failed',
          flow: 'cancel_account_deletion',
          requestId: 'req-123',
          userId: 'user-123',
        })
      );
    });
  });
});
