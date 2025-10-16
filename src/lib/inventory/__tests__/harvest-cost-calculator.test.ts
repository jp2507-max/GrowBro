/**
 * Harvest Cost Calculator Tests
 *
 * Unit tests for harvest cost calculation utilities.
 *
 * Requirements: 9.3, 9.4
 */

import { type Database } from '@nozbe/watermelondb';

import * as CostAnalysisService from '../cost-analysis-service';
import {
  calculateHarvestCost,
  calculateMultipleHarvestCosts,
  getAverageHarvestCost,
} from '../harvest-cost-calculator';

// Mock WatermelonDB and cost analysis service
jest.mock('@nozbe/watermelondb');
jest.mock('../cost-analysis-service');

describe('Harvest Cost Calculator', () => {
  let mockDatabase: jest.Mocked<Database>;

  beforeEach(() => {
    mockDatabase = {} as any;
    jest.clearAllMocks();
  });

  describe('calculateHarvestCost', () => {
    it('should delegate to getHarvestCostSummary', async () => {
      const mockSummary = {
        taskId: 'task1',
        totalCostMinor: 5000,
        items: [],
        movementCount: 3,
      };

      jest
        .spyOn(CostAnalysisService, 'getHarvestCostSummary')
        .mockResolvedValue(mockSummary);

      const result = await calculateHarvestCost(mockDatabase, 'task1');

      expect(result).toEqual(mockSummary);
      expect(CostAnalysisService.getHarvestCostSummary).toHaveBeenCalledWith(
        mockDatabase,
        'task1'
      );
    });
  });

  describe('calculateMultipleHarvestCosts', () => {
    it('should calculate costs for multiple tasks', async () => {
      const mockSummaries = [
        {
          taskId: 'task1',
          totalCostMinor: 5000,
          items: [],
          movementCount: 2,
        },
        {
          taskId: 'task2',
          totalCostMinor: 3000,
          items: [],
          movementCount: 1,
        },
      ];

      jest
        .spyOn(CostAnalysisService, 'getHarvestCostSummary')
        .mockImplementation((db, taskId) => {
          return Promise.resolve(
            mockSummaries.find((s) => s.taskId === taskId)!
          );
        });

      const results = await calculateMultipleHarvestCosts(mockDatabase, [
        'task1',
        'task2',
      ]);

      expect(results).toEqual(mockSummaries);
    });
  });

  describe('getAverageHarvestCost', () => {
    it('should calculate average cost across tasks', async () => {
      const mockSummaries = [
        {
          taskId: 'task1',
          totalCostMinor: 5000,
          items: [],
          movementCount: 2,
        },
        {
          taskId: 'task2',
          totalCostMinor: 3000,
          items: [],
          movementCount: 1,
        },
      ];

      jest
        .spyOn(CostAnalysisService, 'getHarvestCostSummary')
        .mockImplementation((db, taskId) => {
          return Promise.resolve(
            mockSummaries.find((s) => s.taskId === taskId)!
          );
        });

      const avgCost = await getAverageHarvestCost(mockDatabase, [
        'task1',
        'task2',
      ]);

      expect(avgCost).toBe(4000); // Math.round((5000 + 3000) / 2)
    });

    it('should return 0 for empty task list', async () => {
      const avgCost = await getAverageHarvestCost(mockDatabase, []);

      expect(avgCost).toBe(0);
    });
  });
});
