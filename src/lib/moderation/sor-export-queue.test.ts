import { cleanup } from '@/lib/test-utils';

import { sorExportQueueManager } from './sor-export-queue';

// Mock Supabase
jest.mock('../supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

afterEach(cleanup);

describe('SoRExportQueueManager', () => {
  let mockSupabase: any;

  beforeAll(() => {
    mockSupabase = require('../supabase').supabase;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('enqueue', () => {
    const mockRedactedSoR = {
      id: 'test-statement-id',
      content: 'Redacted content for testing',
      violations: [],
    };

    test('enqueues new Statement of Reasons successfully', async () => {
      // Mock no existing entry (first enqueue) - .maybeSingle returns null
      mockSupabase.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({ data: null }),
            }),
          }),
        })
        .mockReturnValueOnce({
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { id: 'new-queue-id' },
                error: null,
              }),
            }),
          }),
        });

      const result = await sorExportQueueManager.enqueue(
        'test-statement-id',
        mockRedactedSoR as any
      );

      expect(result.success).toBe(true);
      expect(result.queue_id).toBe('new-queue-id');
      expect(result.already_enqueued).toBe(false);
    });

    test('returns existing queue entry for already enqueued statement', async () => {
      // Mock existing entry found - .maybeSingle returns data
      const existingEntry = { id: 'existing-queue-id', status: 'pending' };
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({ data: existingEntry }),
          }),
        }),
      });

      const result = await sorExportQueueManager.enqueue(
        'test-statement-id',
        mockRedactedSoR as any
      );

      expect(result.success).toBe(true);
      expect(result.queue_id).toBe('existing-queue-id');
      expect(result.already_enqueued).toBe(true);
    });

    test('fails validation when PII scrubbing fails', async () => {
      const invalidSoR = {
        ...mockRedactedSoR,
        violations: ['PII detected'],
      };

      const result = await sorExportQueueManager.enqueue(
        'test-statement-id',
        invalidSoR as any
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('PII validation failed');
    });
  });

  describe('updateStatus', () => {
    test('updates status to submitted successfully', async () => {
      // Mock getting current attempts count
      mockSupabase.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { attempts: 1 },
                error: null,
              }),
            }),
          }),
        })
        // Mock the update operation
        .mockReturnValueOnce({
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              error: null,
            }),
          }),
        });

      const result = await sorExportQueueManager.updateStatus({
        queueId: 'test-queue-id',
        status: 'submitted',
        transparencyDbResponse: 'success-response',
      });

      expect(result.success).toBe(true);
    });

    test('transitions to retry status when failed but under DLQ threshold', async () => {
      // Mock getting current attempts count (attempt 2 out of 5)
      mockSupabase.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { attempts: 2 },
                error: null,
              }),
            }),
          }),
        })
        // Mock the update operation
        .mockReturnValueOnce({
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              error: null,
            }),
          }),
        });

      const result = await sorExportQueueManager.updateStatus({
        queueId: 'test-queue-id',
        status: 'failed',
        errorMessage: 'API timeout',
      });

      expect(result.success).toBe(true);
      // Verify the update was called with retry status
      const updateMock = mockSupabase.from().update;
      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'retry',
          attempts: 3, // incremented
          error_message: 'API timeout',
        })
      );
    });

    test('transitions to DLQ status when failed and at DLQ threshold', async () => {
      // Mock getting current attempts count (attempt 5, at DLQ threshold)
      mockSupabase.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { attempts: 4 }, // Will become 5 after increment
                error: null,
              }),
            }),
          }),
        })
        // Mock the update operation
        .mockReturnValueOnce({
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              error: null,
            }),
          }),
        });

      const result = await sorExportQueueManager.updateStatus({
        queueId: 'test-queue-id',
        status: 'failed',
        errorMessage: 'API timeout',
      });

      expect(result.success).toBe(true);
      // Verify the update was called with dlq status
      const updateMock = mockSupabase.from().update;
      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'dlq',
          attempts: 5, // incremented to threshold
          error_message: 'API timeout',
        })
      );
    });

    test('transitions to DLQ status when failed and over DLQ threshold', async () => {
      // Mock getting current attempts count (attempt 6, over DLQ threshold)
      mockSupabase.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { attempts: 5 }, // Already at threshold
                error: null,
              }),
            }),
          }),
        })
        // Mock the update operation
        .mockReturnValueOnce({
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              error: null,
            }),
          }),
        });

      const result = await sorExportQueueManager.updateStatus({
        queueId: 'test-queue-id',
        status: 'failed',
        errorMessage: 'API timeout',
      });

      expect(result.success).toBe(true);
      // Verify the update was called with dlq status
      const updateMock = mockSupabase.from().update;
      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'dlq',
          attempts: 6, // incremented past threshold
          error_message: 'API timeout',
        })
      );
    });

    test('handles database error during status update', async () => {
      // Mock getting current attempts count
      mockSupabase.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { attempts: 1 },
                error: null,
              }),
            }),
          }),
        })
        // Mock the update operation with error
        .mockReturnValueOnce({
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              error: { message: 'Database connection failed' },
            }),
          }),
        });

      const result = await sorExportQueueManager.updateStatus({
        queueId: 'test-queue-id',
        status: 'submitted',
        transparencyDbResponse: 'success-response',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to update queue status');
    });

    test('handles error when fetching current attempts', async () => {
      // Mock getting current attempts count with error
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Record not found' },
            }),
          }),
        }),
      });

      const result = await sorExportQueueManager.updateStatus({
        queueId: 'test-queue-id',
        status: 'submitted',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Status update failed');
    });
  });
});
