import { resetAgeGate } from '../compliance/age-gate';
import { signOut, useAuth } from './index';

// Mock dependencies
jest.mock('../compliance/age-gate', () => ({
  resetAgeGate: jest.fn(),
}));

jest.mock('./session-timeout', () => ({
  startIdleTimeout: jest.fn(),
  stopIdleTimeout: jest.fn(),
  updateActivity: jest.fn(),
}));

// Mock storage for testing
const mockStorage = new Map<string, string>();
jest.mock('@/lib/storage', () => ({
  storage: {
    getString: jest.fn((key: string) => mockStorage.get(key)),
    set: jest.fn((key: string, value: string) => mockStorage.set(key, value)),
    delete: jest.fn((key: string) => mockStorage.delete(key)),
  },
}));

describe('Auth', () => {
  beforeEach(() => {
    mockStorage.clear();
    jest.clearAllMocks();
  });

  describe('signOut', () => {
    test('should call resetAgeGate when signing out', () => {
      // Sign in first
      useAuth
        .getState()
        .signIn({ access: 'test-token', refresh: 'test-refresh' });

      // Sign out
      signOut();

      // Verify resetAgeGate was called
      expect(resetAgeGate).toHaveBeenCalledTimes(1);
    });

    test('should clear auth token from storage on signOut', () => {
      // Sign in first
      useAuth
        .getState()
        .signIn({ access: 'test-token', refresh: 'test-refresh' });

      // Verify token is stored
      expect(mockStorage.get('auth.token')).toBeTruthy();

      // Sign out
      signOut();

      // Verify token is removed from storage
      expect(mockStorage.get('auth.token')).toBeUndefined();
    });

    test('should update auth status to signOut', () => {
      // Sign in first
      useAuth
        .getState()
        .signIn({ access: 'test-token', refresh: 'test-refresh' });

      // Verify status is signIn
      expect(useAuth.getState().status).toBe('signIn');

      // Sign out
      signOut();

      // Verify status is signOut
      expect(useAuth.getState().status).toBe('signOut');
    });

    test('should clear token from state on signOut', () => {
      // Sign in first
      useAuth
        .getState()
        .signIn({ access: 'test-token', refresh: 'test-refresh' });

      // Verify token exists
      expect(useAuth.getState().token).toEqual({
        access: 'test-token',
        refresh: 'test-refresh',
      });

      // Sign out
      signOut();

      // Verify token is null
      expect(useAuth.getState().token).toBeNull();
    });
  });
});
