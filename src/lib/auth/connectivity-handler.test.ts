import { renderHook, waitFor } from '@testing-library/react-native';

import type { NetworkState } from '../sync/network-manager';
import * as NetworkManager from '../sync/network-manager';
import {
  getBlockedMutationError,
  shouldBlockMutation,
  useConnectivityHandler,
} from './connectivity-handler';
import { sessionManager } from './session-manager';

// Mock dependencies
jest.mock('../sync/network-manager');
jest.mock('./session-manager');

// Create a mock for useAuth with proper typing
const mockOfflineMode = jest.fn<'full' | 'readonly' | 'blocked', []>();
const mockSetOfflineMode = jest.fn();

jest.mock('./index', () => ({
  useAuth: {
    use: {
      offlineMode: () => mockOfflineMode(),
    },
    getState: jest.fn(() => ({
      setOfflineMode: mockSetOfflineMode,
    })),
  },
}));

const mockOnConnectivityChange =
  NetworkManager.onConnectivityChange as jest.MockedFunction<
    typeof NetworkManager.onConnectivityChange
  >;
const mockSessionManager = sessionManager as jest.Mocked<typeof sessionManager>;

describe('connectivity-handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('shouldBlockMutation', () => {
    it('should block mutations in blocked mode', () => {
      expect(shouldBlockMutation('blocked')).toBe(true);
    });

    it('should block mutations in readonly mode', () => {
      expect(shouldBlockMutation('readonly')).toBe(true);
    });

    it('should allow mutations in full mode', () => {
      expect(shouldBlockMutation('full')).toBe(false);
    });
  });

  describe('getBlockedMutationError', () => {
    it('should return session expired error for blocked mode', () => {
      expect(getBlockedMutationError('blocked')).toBe(
        'errors.sync.unauthorized'
      );
    });

    it('should return readonly error for readonly mode', () => {
      expect(getBlockedMutationError('readonly')).toBe(
        'errors.sync.network_timeout'
      );
    });

    it('should return sensitive op error for readonly mode with sensitive operation', () => {
      expect(getBlockedMutationError('readonly', true)).toBe(
        'errors.sync.permission_denied'
      );
    });

    it('should return generic error for full mode', () => {
      expect(getBlockedMutationError('full')).toBe('errors.sync.unknown');
    });
  });

  describe('useConnectivityHandler', () => {
    it('should subscribe to connectivity changes', () => {
      const unsubscribe = jest.fn();
      mockOnConnectivityChange.mockReturnValue(unsubscribe);
      mockOfflineMode.mockReturnValue('full');

      const { unmount } = renderHook(() => useConnectivityHandler());

      expect(mockOnConnectivityChange).toHaveBeenCalledWith(
        expect.any(Function)
      );

      unmount();
      expect(unsubscribe).toHaveBeenCalled();
    });

    it('should validate session when connectivity is restored', async () => {
      let connectivityCallback: ((state: NetworkState) => void) | null = null;
      const unsubscribe = jest.fn();

      mockOnConnectivityChange.mockImplementation((callback) => {
        connectivityCallback = callback as (state: NetworkState) => void;
        return unsubscribe;
      });

      mockOfflineMode.mockReturnValue('readonly');
      mockSessionManager.forceValidation.mockResolvedValue(true);

      renderHook(() => useConnectivityHandler());

      // Simulate going offline
      connectivityCallback!({
        type: 'wifi',
        isConnected: false,
        isInternetReachable: false,
        isMetered: false,
      });

      // Simulate coming back online
      connectivityCallback!({
        type: 'wifi',
        isConnected: true,
        isInternetReachable: true,
        isMetered: false,
      });

      await waitFor(() => {
        expect(mockSessionManager.forceValidation).toHaveBeenCalled();
      });

      expect(mockSetOfflineMode).toHaveBeenCalledWith('full');
    });

    it('should not validate if already online', async () => {
      let connectivityCallback: ((state: NetworkState) => void) | null = null;
      const unsubscribe = jest.fn();

      mockOnConnectivityChange.mockImplementation((callback) => {
        connectivityCallback = callback as (state: NetworkState) => void;
        return unsubscribe;
      });

      mockOfflineMode.mockReturnValue('full');
      mockSessionManager.forceValidation.mockResolvedValue(true);

      renderHook(() => useConnectivityHandler());

      // Simulate staying online
      connectivityCallback!({
        type: 'wifi',
        isConnected: true,
        isInternetReachable: true,
        isMetered: false,
      });

      connectivityCallback!({
        type: 'wifi',
        isConnected: true,
        isInternetReachable: true,
        isMetered: false,
      });

      // Should not validate since we never went offline
      expect(mockSessionManager.forceValidation).not.toHaveBeenCalled();
    });

    it('should handle failed session validation', async () => {
      let connectivityCallback: ((state: NetworkState) => void) | null = null;
      const unsubscribe = jest.fn();

      mockOnConnectivityChange.mockImplementation((callback) => {
        connectivityCallback = callback as (state: NetworkState) => void;
        return unsubscribe;
      });

      mockOfflineMode.mockReturnValue('readonly');
      mockSessionManager.forceValidation.mockResolvedValue(false);

      renderHook(() => useConnectivityHandler());

      // Simulate offline then online
      connectivityCallback!({
        type: 'wifi',
        isConnected: false,
        isInternetReachable: false,
        isMetered: false,
      });

      connectivityCallback!({
        type: 'wifi',
        isConnected: true,
        isInternetReachable: true,
        isMetered: false,
      });

      await waitFor(() => {
        expect(mockSessionManager.forceValidation).toHaveBeenCalled();
      });

      // Should not set offline mode to full if validation failed
      expect(mockSetOfflineMode).not.toHaveBeenCalledWith('full');
    });
  });
});
