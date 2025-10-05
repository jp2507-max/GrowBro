/**
 * Schedule Shifter Tests
 *
 * Tests for schedule shifting functionality including:
 * - Preview generation
 * - Atomic shift application
 * - Undo functionality
 * - Manual edit protection
 * - Outbox pattern integration
 */

import { type Database } from '@nozbe/watermelondb';

import type { AnalyticsClient } from '../analytics';
import { ScheduleShifter } from './schedule-shifter';

// Mock database
const mockDatabase = {
  get: jest.fn(),
  write: jest.fn(),
} as unknown as Database;

// Mock analytics
const mockAnalytics: AnalyticsClient = {
  track: jest.fn(),
};

describe('ScheduleShifter', () => {
  let shifter: ScheduleShifter;

  beforeEach(() => {
    jest.clearAllMocks();
    shifter = new ScheduleShifter({
      database: mockDatabase,
      analytics: mockAnalytics,
    });
  });

  describe('generatePreview', () => {
    it('should generate preview with affected task count', async () => {
      // Mock tasks query
      const mockTasks = [
        {
          id: 'task1',
          dueAtUtc: '2025-01-01T00:00:00Z',
          phaseIndex: 0,
          metadata: {},
        },
        {
          id: 'task2',
          dueAtUtc: '2025-01-02T00:00:00Z',
          phaseIndex: 0,
          metadata: {},
        },
      ];

      (mockDatabase.get as jest.Mock).mockReturnValue({
        query: jest.fn().mockReturnValue({
          fetch: jest.fn().mockResolvedValue(mockTasks),
        }),
      });

      const preview = await shifter.generatePreview('plant1', 3);

      expect(preview.affectedTaskCount).toBe(2);
      expect(preview.daysDelta).toBe(3);
      expect(preview.plantId).toBe('plant1');
      expect(mockAnalytics.track).toHaveBeenCalledWith('shift_preview', {
        plantId: 'plant1',
        daysDelta: 3,
        affectedTaskCount: 2,
        manuallyEditedCount: 0,
      });
    });

    it('should exclude manually edited tasks by default', async () => {
      const mockTasks = [
        {
          id: 'task1',
          dueAtUtc: '2025-01-01T00:00:00Z',
          phaseIndex: 0,
          metadata: {},
        },
        {
          id: 'task2',
          dueAtUtc: '2025-01-02T00:00:00Z',
          phaseIndex: 0,
          metadata: { flags: { manualEdited: true } },
        },
      ];

      (mockDatabase.get as jest.Mock).mockReturnValue({
        query: jest.fn().mockReturnValue({
          fetch: jest.fn().mockResolvedValue(mockTasks),
        }),
      });

      const preview = await shifter.generatePreview('plant1', 3);

      expect(preview.affectedTaskCount).toBe(1);
      expect(preview.manuallyEditedCount).toBe(1);
      expect(preview.collisionWarnings).toHaveLength(1);
    });

    it('should include manually edited tasks when flag is set', async () => {
      const mockTasks = [
        {
          id: 'task1',
          dueAtUtc: '2025-01-01T00:00:00Z',
          phaseIndex: 0,
          metadata: {},
        },
        {
          id: 'task2',
          dueAtUtc: '2025-01-02T00:00:00Z',
          phaseIndex: 0,
          metadata: { flags: { manualEdited: true } },
        },
      ];

      (mockDatabase.get as jest.Mock).mockReturnValue({
        query: jest.fn().mockReturnValue({
          fetch: jest.fn().mockResolvedValue(mockTasks),
        }),
      });

      const preview = await shifter.generatePreview('plant1', 3, {
        includeManuallyEdited: true,
      });

      expect(preview.affectedTaskCount).toBe(2);
      expect(preview.manuallyEditedCount).toBe(0);
    });

    it('should return empty preview when no tasks to shift', async () => {
      (mockDatabase.get as jest.Mock).mockReturnValue({
        query: jest.fn().mockReturnValue({
          fetch: jest.fn().mockResolvedValue([]),
        }),
      });

      const preview = await shifter.generatePreview('plant1', 3);

      expect(preview.affectedTaskCount).toBe(0);
      expect(preview.firstNewDate).toBeNull();
      expect(preview.lastNewDate).toBeNull();
    });
  });

  describe('applyShift', () => {
    it('should throw error if preview not found', async () => {
      await expect(shifter.applyShift('invalid-shift-id')).rejects.toThrow(
        'Shift preview not found'
      );
    });

    it('should throw error if no tasks to shift', async () => {
      // Generate empty preview first
      (mockDatabase.get as jest.Mock).mockReturnValue({
        query: jest.fn().mockReturnValue({
          fetch: jest.fn().mockResolvedValue([]),
        }),
      });

      const preview = await shifter.generatePreview('plant1', 3);

      await expect(shifter.applyShift(preview.shiftId)).rejects.toThrow(
        'No tasks to shift'
      );
    });

    // Note: Full integration test would require mocking WatermelonDB write operations
    // which is complex. This should be tested in integration tests.
  });

  describe('undoShift', () => {
    it('should throw error if undo descriptor not found', async () => {
      (mockDatabase.get as jest.Mock).mockReturnValue({
        query: jest.fn().mockReturnValue({
          fetch: jest.fn().mockResolvedValue([]),
        }),
      });

      await expect(shifter.undoShift('plant1', 'shift1')).rejects.toThrow(
        'Undo window expired or shift not found'
      );
    });

    // Note: Full undo test requires complex mocking of WatermelonDB
    // Should be tested in integration tests
  });

  describe('cleanupExpiredUndos', () => {
    it('should delete expired undo descriptors', async () => {
      const mockExpiredDescriptor = {
        destroyPermanently: jest.fn(),
      };

      (mockDatabase.get as jest.Mock).mockReturnValue({
        query: jest.fn().mockReturnValue({
          fetch: jest.fn().mockResolvedValue([mockExpiredDescriptor]),
        }),
      });

      (mockDatabase.write as jest.Mock).mockImplementation(async (fn) => {
        await fn();
      });

      await shifter.cleanupExpiredUndos();

      expect(mockExpiredDescriptor.destroyPermanently).toHaveBeenCalled();
    });
  });
});
