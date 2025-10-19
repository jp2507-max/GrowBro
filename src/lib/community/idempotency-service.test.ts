import { cleanup } from '@/lib/test-utils';

import { supabase } from '../supabase';
import { IdempotencyService } from './idempotency-service';

afterEach(cleanup);

// Mock Supabase client
jest.mock('../supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({ maybeSingle: jest.fn() })),
      })),
      upsert: jest.fn(() => ({ select: jest.fn() })),
      update: jest.fn(() => ({ eq: jest.fn() })),
      rpc: jest.fn(),
    })),
    rpc: jest.fn(),
  },
}));

describe('IdempotencyService', () => {
  let service: IdempotencyService;
  const mockUserId = 'test-user-id';
  const mockKey = 'test-idempotency-key';
  const mockClientTxId = 'test-client-tx-id';
  const mockEndpoint = 'create-post';
  const mockPayload = { content: 'test post' };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new IdempotencyService();
  });

  describe('processWithIdempotency', () => {
    test('processes new request successfully', async () => {
      // Mock no existing key
      const mockSelect = jest.fn().mockResolvedValue({ data: null });
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: mockSelect,
      });

      // Mock successful key claim
      const mockRpc = jest
        .fn()
        .mockResolvedValue({ data: { success: true }, error: null });
      (supabase.rpc as jest.Mock).mockImplementation(mockRpc);

      // Mock successful operation
      const mockOperation = jest.fn().mockResolvedValue('operation result');

      // Mock successful completion
      const mockUpdate = jest.fn().mockResolvedValue({ error: null });
      (supabase.from as jest.Mock).mockReturnValueOnce({
        update: mockUpdate,
        eq: jest.fn().mockReturnThis(),
      });

      const result = await service.processWithIdempotency({
        key: mockKey,
        clientTxId: mockClientTxId,
        userId: mockUserId,
        endpoint: mockEndpoint,
        payload: mockPayload,
        operation: mockOperation,
      });

      expect(result).toBe('operation result');
      expect(mockRpc).toHaveBeenCalledWith('claim_idempotency_key', {
        p_user_id: mockUserId,
        p_idempotency_key: mockKey,
        p_endpoint: mockEndpoint,
        p_client_tx_id: mockClientTxId,
        p_payload_hash: expect.any(String),
      });
      expect(mockOperation).toHaveBeenCalled();
    });

    test('returns cached result for completed request', async () => {
      const mockCompletedKey = {
        status: 'completed',
        payload_hash: 'test-hash',
        response_payload: 'cached result',
      };

      // Mock existing completed key
      const mockSelect = jest
        .fn()
        .mockResolvedValue({ data: mockCompletedKey });
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: mockSelect,
      });

      const mockOperation = jest.fn();

      const result = await service.processWithIdempotency({
        key: mockKey,
        clientTxId: mockClientTxId,
        userId: mockUserId,
        endpoint: mockEndpoint,
        payload: mockPayload,
        operation: mockOperation,
      });

      expect(result).toBe('cached result');
      expect(mockOperation).not.toHaveBeenCalled();
    });

    test('throws error for processing request', async () => {
      const mockProcessingKey = { status: 'processing' };

      // Mock existing processing key
      const mockSelect = jest
        .fn()
        .mockResolvedValue({ data: mockProcessingKey });
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: mockSelect,
      });

      const mockOperation = jest.fn();

      await expect(
        service.processWithIdempotency({
          key: mockKey,
          clientTxId: mockClientTxId,
          userId: mockUserId,
          endpoint: mockEndpoint,
          payload: mockPayload,
          operation: mockOperation,
        })
      ).rejects.toThrow('Request already being processed');

      expect(mockOperation).not.toHaveBeenCalled();
    });

    test('handles operation failure and marks as failed', async () => {
      // Mock no existing key
      const mockSelect = jest.fn().mockResolvedValue({ data: null });
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: mockSelect,
      });

      // Mock successful key claim
      const mockRpc = jest
        .fn()
        .mockResolvedValue({ data: { success: true }, error: null });
      (supabase.rpc as jest.Mock).mockImplementation(mockRpc);

      // Mock operation failure
      const mockOperation = jest
        .fn()
        .mockRejectedValue(new Error('Operation failed'));

      // Mock failure update
      const mockUpdate = jest.fn().mockResolvedValue({ error: null });
      (supabase.from as jest.Mock).mockReturnValueOnce({
        update: mockUpdate,
        eq: jest.fn().mockReturnThis(),
      });

      await expect(
        service.processWithIdempotency({
          key: mockKey,
          clientTxId: mockClientTxId,
          userId: mockUserId,
          endpoint: mockEndpoint,
          payload: mockPayload,
          operation: mockOperation,
        })
      ).rejects.toThrow('Operation failed');
    });

    test('throws error when key claim fails due to existing key', async () => {
      // Mock no existing key in initial check
      const mockSelect = jest.fn().mockResolvedValue({ data: null });
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: mockSelect,
      });

      // Mock key claim failure (already exists)
      const mockRpc = jest.fn().mockResolvedValue({
        data: {
          success: false,
          error: 'Key already exists',
          existing_key: { status: 'processing' },
        },
        error: null,
      });
      (supabase.rpc as jest.Mock).mockImplementation(mockRpc);

      const mockOperation = jest.fn();

      await expect(
        service.processWithIdempotency({
          key: mockKey,
          clientTxId: mockClientTxId,
          userId: mockUserId,
          endpoint: mockEndpoint,
          payload: mockPayload,
          operation: mockOperation,
        })
      ).rejects.toThrow('Request already being processed');

      expect(mockOperation).not.toHaveBeenCalled();
    });
  });

  describe('cleanupExpiredKeys', () => {
    test('cleans up expired keys successfully', async () => {
      const mockDelete = jest.fn().mockResolvedValue({ error: null });
      (supabase.from as jest.Mock).mockReturnValue({
        delete: mockDelete,
        lt: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
      });

      await expect(service.cleanupExpiredKeys()).resolves.toBeUndefined();
      expect(mockDelete).toHaveBeenCalled();
    });

    test('throws error on cleanup failure', async () => {
      const mockDelete = jest
        .fn()
        .mockResolvedValue({ error: new Error('Cleanup failed') });
      (supabase.from as jest.Mock).mockReturnValue({
        delete: mockDelete,
        lt: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
      });

      await expect(service.cleanupExpiredKeys()).rejects.toThrow(
        'Failed to cleanup expired keys: Cleanup failed'
      );
    });
  });
});
