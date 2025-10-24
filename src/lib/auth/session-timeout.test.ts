import { AppState } from 'react-native';

import {
  getIdleTimeoutDuration,
  getRemainingIdleTime,
  startIdleTimeout,
  stopIdleTimeout,
  updateActivity,
} from './session-timeout';

// Mock React Native AppState
jest.mock('react-native', () => ({
  AppState: {
    addEventListener: jest.fn(),
  },
}));

// Mock signOut
jest.mock('./index', () => ({
  signOut: jest.fn(),
}));

describe('Session Timeout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AppState.addEventListener as jest.Mock).mockReturnValue({
      remove: jest.fn(),
    });
  });

  afterEach(() => {
    stopIdleTimeout(); // Clean up any running timeouts
  });

  describe('startIdleTimeout', () => {
    test('should initialize idle timeout monitoring', () => {
      const mockSignOutCallback = jest.fn();
      startIdleTimeout(mockSignOutCallback);

      // Should add AppState listener
      expect(AppState.addEventListener).toHaveBeenCalledWith(
        'change',
        expect.any(Function)
      );
    });
  });

  describe('updateActivity', () => {
    test('should update last activity time', () => {
      updateActivity();

      // Remaining time should be close to full timeout duration
      const remainingTime = getRemainingIdleTime();
      const timeoutDuration = getIdleTimeoutDuration();

      expect(remainingTime).toBeLessThanOrEqual(timeoutDuration);
      expect(remainingTime).toBeGreaterThan(timeoutDuration - 1000); // Within 1 second
    });
  });

  describe('getRemainingIdleTime', () => {
    test('should return remaining idle time', () => {
      updateActivity();

      const remainingTime = getRemainingIdleTime();
      const timeoutDuration = getIdleTimeoutDuration();

      expect(remainingTime).toBeGreaterThan(0);
      expect(remainingTime).toBeLessThanOrEqual(timeoutDuration);
    });
  });

  describe('getIdleTimeoutDuration', () => {
    test('should return the configured timeout duration', () => {
      const duration = getIdleTimeoutDuration();

      // Should be 2 hours in milliseconds
      expect(duration).toBe(2 * 60 * 60 * 1000);
    });
  });
});
