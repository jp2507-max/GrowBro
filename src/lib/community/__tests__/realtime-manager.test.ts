import { RealtimeConnectionManager } from '../realtime-manager';

// Mock Supabase
jest.mock('@/lib/supabase', () => ({
  supabase: {
    channel: jest.fn(() => ({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn((callback) => {
        // Simulate successful subscription
        setTimeout(() => callback('SUBSCRIBED'), 10);
        return {
          unsubscribe: jest.fn(),
        };
      }),
      removeChannel: jest.fn(),
    })),
    removeChannel: jest.fn(),
  },
}));

describe('RealtimeConnectionManager', () => {
  let manager: RealtimeConnectionManager;
  let mockCallbacks: any;

  beforeEach(() => {
    manager = new RealtimeConnectionManager();
    mockCallbacks = {
      onPostChange: jest.fn(),
      onCommentChange: jest.fn(),
      onLikeChange: jest.fn(),
      onConnectionStateChange: jest.fn(),
      onPollRefresh: jest.fn(),
    };
  });

  afterEach(() => {
    manager.unsubscribe();
  });

  describe('Connection Management', () => {
    it('should start disconnected', () => {
      expect(manager.getConnectionState()).toBe('disconnected');
    });

    it('should connect and notify state changes', async () => {
      manager.subscribe(mockCallbacks);

      // Wait for connection
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockCallbacks.onConnectionStateChange).toHaveBeenCalledWith(
        'connecting'
      );
      expect(mockCallbacks.onConnectionStateChange).toHaveBeenCalledWith(
        'connected'
      );
    });

    it('should handle unsubscription', async () => {
      manager.subscribe(mockCallbacks);
      await new Promise((resolve) => setTimeout(resolve, 50));

      manager.unsubscribe();

      expect(manager.getConnectionState()).toBe('disconnected');
    });
  });

  describe('Polling Fallback', () => {
    it('should not be polling initially', () => {
      expect(manager.isPollingActive()).toBe(false);
    });

    it('should call onPollRefresh during polling', async () => {
      // Make polling start immediately on the first connection error for this unit test.
      (manager as any).maxReconnectAttempts = 0;

      // Mock a failed connection that triggers polling
      const mockSupabase = require('@/lib/supabase').supabase;
      mockSupabase.channel.mockReturnValueOnce({
        on: jest.fn().mockReturnThis(),
        subscribe: jest.fn((callback) => {
          // Simulate connection failure leading to polling
          setTimeout(() => {
            callback('CHANNEL_ERROR');
          }, 10);
          return { unsubscribe: jest.fn() };
        }),
        removeChannel: jest.fn(),
      });

      manager.subscribe(mockCallbacks);

      // Wait for polling to start
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(mockCallbacks.onPollRefresh).toHaveBeenCalled();
    });

    it('should stop polling when onPollRefresh is not implemented', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const callbacksWithoutRefresh = {
        onPostChange: jest.fn(),
        onCommentChange: jest.fn(),
        onLikeChange: jest.fn(),
        onConnectionStateChange: jest.fn(),
        // onPollRefresh intentionally omitted
      };

      // Make polling start immediately on the first connection error for this unit test.
      (manager as any).maxReconnectAttempts = 0;

      // Mock a failed connection that triggers polling
      const mockSupabase = require('@/lib/supabase').supabase;
      mockSupabase.channel.mockReturnValueOnce({
        on: jest.fn().mockReturnThis(),
        subscribe: jest.fn((callback) => {
          setTimeout(() => {
            callback('CHANNEL_ERROR');
          }, 10);
          return { unsubscribe: jest.fn() };
        }),
        removeChannel: jest.fn(),
      });

      manager.subscribe(callbacksWithoutRefresh);

      // Wait for polling to start and error to be logged
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[Realtime] CRITICAL: Polling active but onPollRefresh not implemented. ' +
          'Data will NOT update. This is a bug in consumer implementation. Stopping polling.'
      );
      expect(manager.isPollingActive()).toBe(false);

      consoleErrorSpy.mockRestore();
    });

    it('should track polling state', async () => {
      // Make polling start immediately on the first connection error
      (manager as any).maxReconnectAttempts = 0;

      // Mock a failed connection that triggers polling
      const mockSupabase = require('@/lib/supabase').supabase;
      mockSupabase.channel.mockReturnValueOnce({
        on: jest.fn().mockReturnThis(),
        subscribe: jest.fn((callback) => {
          // Simulate connection failure leading to polling
          setTimeout(() => {
            callback('CHANNEL_ERROR');
          }, 10);
          return { unsubscribe: jest.fn() };
        }),
        removeChannel: jest.fn(),
      });

      manager.subscribe(mockCallbacks);

      // Wait for polling to start
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(manager.isPollingActive()).toBe(true);
    });
  });

  describe('Event Handling', () => {
    it('should transform Supabase events correctly', () => {
      const mockEvent = {
        eventType: 'INSERT' as const,
        new: { id: 'test-post', body: 'test', client_tx_id: 'tx-123' },
        old: null,
        commit_timestamp: '2024-01-01T00:00:00Z',
      };

      // Access private method through type assertion for testing
      const transformed = (manager as any).transformPayload(mockEvent, 'posts');

      expect(transformed).toEqual({
        schema: 'public',
        table: 'posts',
        eventType: 'INSERT',
        commit_timestamp: '2024-01-01T00:00:00Z',
        new: mockEvent.new,
        old: null,
        client_tx_id: 'tx-123',
      });
    });
  });
});
