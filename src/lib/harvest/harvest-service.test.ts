/**
 * Tests for Harvest Service
 * Requirements: 1.3, 1.4, 14.1
 */

import { database } from '@/lib/watermelon';
import type { HarvestModel } from '@/lib/watermelon-models/harvest';
import { HarvestStages } from '@/types/harvest';

import {
  scheduleOverdueReminder,
  scheduleStageReminder,
} from './harvest-notification-service';
import { createHarvest } from './harvest-service';

// Mock dependencies
jest.mock('@/lib/watermelon');
jest.mock('./harvest-notification-service');

describe('Harvest Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default mocks
    (scheduleStageReminder as jest.Mock).mockResolvedValue({
      notificationId: 'target-notification-id',
      scheduled: true,
    });
    (scheduleOverdueReminder as jest.Mock).mockResolvedValue({
      notificationId: 'overdue-notification-id',
      scheduled: true,
    });
  });

  describe('createHarvest', () => {
    const mockHarvestCollection = {
      create: jest.fn(),
    };

    const mockHarvest = {
      id: 'test-harvest-id',
      stage: HarvestStages.HARVEST,
      stageStartedAt: new Date('2024-01-01T00:00:00Z'),
    } as HarvestModel;

    beforeEach(() => {
      (database.get as jest.Mock).mockReturnValue(mockHarvestCollection);
      (database.write as jest.Mock).mockImplementation(async (callback) => {
        return callback();
      });
      mockHarvestCollection.create.mockResolvedValue(mockHarvest);
    });

    it('creates a harvest record successfully', async () => {
      const input = {
        plantId: 'test-plant-id',
        wetWeightG: 1000,
        dryWeightG: null,
        trimmingsWeightG: 50,
        notes: 'Test harvest',
        photos: [],
      };

      const result = await createHarvest(input);

      expect(result.success).toBe(true);
      expect(result.harvest).toBe(mockHarvest);
      expect(database.get).toHaveBeenCalledWith('harvests');
      expect(database.write).toHaveBeenCalled();
      expect(mockHarvestCollection.create).toHaveBeenCalledWith(
        expect.any(Function)
      );
    });

    it('schedules initial HARVEST-stage notifications after creation', async () => {
      const input = {
        plantId: 'test-plant-id',
        wetWeightG: 1000,
        dryWeightG: null,
        trimmingsWeightG: 50,
        notes: 'Test harvest',
        photos: [],
      };

      (scheduleStageReminder as jest.Mock).mockResolvedValue({
        notificationId: 'target-notification-id',
        scheduled: true,
      });
      (scheduleOverdueReminder as jest.Mock).mockResolvedValue({
        notificationId: 'overdue-notification-id',
        scheduled: true,
      });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await createHarvest(input);

      expect(scheduleStageReminder).toHaveBeenCalledWith(
        'test-harvest-id',
        HarvestStages.HARVEST,
        mockHarvest.stageStartedAt
      );

      expect(scheduleOverdueReminder).toHaveBeenCalledWith(
        'test-harvest-id',
        HarvestStages.HARVEST,
        mockHarvest.stageStartedAt
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        '[HarvestService] Scheduled initial notifications for HARVEST stage:',
        {
          stage: HarvestStages.HARVEST,
          targetScheduled: true,
          overdueScheduled: true,
        }
      );

      consoleSpy.mockRestore();
    });

    it('only schedules overdue notification if target notification is scheduled', async () => {
      const input = {
        plantId: 'test-plant-id',
        wetWeightG: 1000,
        dryWeightG: null,
        trimmingsWeightG: 50,
        notes: 'Test harvest',
        photos: [],
      };

      (scheduleStageReminder as jest.Mock).mockResolvedValue({
        notificationId: null,
        scheduled: false,
        error: 'permission_denied',
      });

      await createHarvest(input);

      expect(scheduleStageReminder).toHaveBeenCalledWith(
        'test-harvest-id',
        HarvestStages.HARVEST,
        mockHarvest.stageStartedAt
      );

      expect(scheduleOverdueReminder).not.toHaveBeenCalled();
    });

    it('handles creation errors', async () => {
      const input = {
        plantId: 'test-plant-id',
        wetWeightG: 1000,
        dryWeightG: null,
        trimmingsWeightG: 50,
        notes: 'Test harvest',
        photos: [],
      };

      const testError = new Error('Database error');
      mockHarvestCollection.create.mockRejectedValue(testError);

      const result = await createHarvest(input);

      expect(result.success).toBe(false);
      expect(result.harvest).toBe(null);
      expect(result.error).toBe('Database error');
    });

    it('sets correct harvest properties during creation', async () => {
      const input = {
        plantId: 'test-plant-id',
        wetWeightG: 1000,
        dryWeightG: 200,
        trimmingsWeightG: 50,
        notes: 'Test harvest notes',
        photos: [{ variant: 'wet', localUri: 'path/to/photo.jpg' }],
      };

      await createHarvest(input);

      expect(mockHarvestCollection.create).toHaveBeenCalledWith(
        expect.any(Function)
      );

      // Verify the create callback sets the correct properties
      const createCallback = mockHarvestCollection.create.mock.calls[0][0];

      // Create a mock record that captures property assignments
      const mockRecord: any = {};

      // Call the callback with our mock record
      createCallback(mockRecord);

      // Verify each property was set to the correct value
      expect(mockRecord.plantId).toBe('test-plant-id');
      expect(mockRecord.stage).toBe(HarvestStages.HARVEST);
      expect(mockRecord.wetWeightG).toBe(1000);
      expect(mockRecord.dryWeightG).toBe(200);
      expect(mockRecord.trimmingsWeightG).toBe(50);
      expect(mockRecord.notes).toBe('Test harvest notes');
      expect(mockRecord.photos).toEqual([
        { variant: 'wet', localUri: 'path/to/photo.jpg' },
      ]);
      expect(mockRecord.conflictSeen).toBe(false);
      expect(mockRecord.stageStartedAt).toBeInstanceOf(Date);
      expect(mockRecord.stageCompletedAt).toBeUndefined();
    });
  });
});
