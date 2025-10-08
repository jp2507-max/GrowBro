/**
 * Chart Data Utilities Tests
 *
 * Requirements: 4.3, 4.4
 */

import { HarvestStage } from '@/types/harvest';

import {
  aggregateByDate,
  filterByPlant,
  filterByTimeRange,
  getTimeRangeDays,
  getTimeRangeLabel,
  harvestsToChartData,
} from './chart-data-utils';

describe('filterByPlant', () => {
  const mockData = [
    {
      date: new Date('2024-01-01'),
      weight_g: 100,
      stage: HarvestStage.HARVEST,
      plant_id: 'plant-1',
    },
    {
      date: new Date('2024-01-02'),
      weight_g: 200,
      stage: HarvestStage.DRYING,
      plant_id: 'plant-2',
    },
    {
      date: new Date('2024-01-03'),
      weight_g: 150,
      stage: HarvestStage.CURING,
      plant_id: 'plant-1',
    },
  ];

  it('should filter data by plant ID (Requirement 4.3)', () => {
    const result = filterByPlant(mockData, 'plant-1');

    expect(result).toHaveLength(2);
    expect(result[0].plant_id).toBe('plant-1');
    expect(result[1].plant_id).toBe('plant-1');
  });

  it('should return empty array when no matches', () => {
    const result = filterByPlant(mockData, 'plant-3');
    expect(result).toHaveLength(0);
  });

  it('should return empty array for empty input', () => {
    const result = filterByPlant([], 'plant-1');
    expect(result).toHaveLength(0);
  });
});

describe('aggregateByDate', () => {
  it('should aggregate weights by date (Requirement 4.4)', () => {
    const mockData = [
      {
        date: new Date('2024-01-01T10:00:00Z'),
        weight_g: 100,
        stage: HarvestStage.HARVEST,
        plant_id: 'plant-1',
      },
      {
        date: new Date('2024-01-01T14:00:00Z'),
        weight_g: 200,
        stage: HarvestStage.HARVEST,
        plant_id: 'plant-2',
      },
      {
        date: new Date('2024-01-02T10:00:00Z'),
        weight_g: 150,
        stage: HarvestStage.DRYING,
        plant_id: 'plant-1',
      },
    ];

    const result = aggregateByDate(mockData);

    expect(result).toHaveLength(2);
    expect(result[0].weight_g).toBe(300); // 100 + 200
    expect(result[1].weight_g).toBe(150);
    expect(result[0].plant_id).toBeUndefined(); // No plant_id in batch view
  });

  it('should sort results by date ascending', () => {
    const mockData = [
      {
        date: new Date('2024-01-03'),
        weight_g: 150,
        stage: HarvestStage.CURING,
      },
      {
        date: new Date('2024-01-01'),
        weight_g: 100,
        stage: HarvestStage.HARVEST,
      },
      {
        date: new Date('2024-01-02'),
        weight_g: 200,
        stage: HarvestStage.DRYING,
      },
    ];

    const result = aggregateByDate(mockData);

    expect(result[0].date.toISOString().split('T')[0]).toBe('2024-01-01');
    expect(result[1].date.toISOString().split('T')[0]).toBe('2024-01-02');
    expect(result[2].date.toISOString().split('T')[0]).toBe('2024-01-03');
  });

  it('should handle empty input', () => {
    const result = aggregateByDate([]);
    expect(result).toHaveLength(0);
  });

  it('should normalize dates to day (ignore time)', () => {
    const mockData = [
      {
        date: new Date('2024-01-01T08:00:00Z'),
        weight_g: 100,
        stage: HarvestStage.HARVEST,
      },
      {
        date: new Date('2024-01-01T20:00:00Z'),
        weight_g: 200,
        stage: HarvestStage.HARVEST,
      },
    ];

    const result = aggregateByDate(mockData);

    expect(result).toHaveLength(1);
    expect(result[0].weight_g).toBe(300);
  });
});

describe('filterByTimeRange', () => {
  // Mock dates - creating them programmatically relative to "now"
  const createMockData = () => {
    const now = new Date();
    return [
      {
        date: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000), // 6 days ago
        weight_g: 100,
        stage: HarvestStage.HARVEST,
      },
      {
        date: new Date(now.getTime() - 16 * 24 * 60 * 60 * 1000), // 16 days ago
        weight_g: 200,
        stage: HarvestStage.DRYING,
      },
      {
        date: new Date(now.getTime() - 61 * 24 * 60 * 60 * 1000), // 61 days ago
        weight_g: 150,
        stage: HarvestStage.CURING,
      },
      {
        date: new Date(now.getTime() - 335 * 24 * 60 * 60 * 1000), // 335 days ago
        weight_g: 180,
        stage: HarvestStage.INVENTORY,
      },
    ];
  };

  it('should filter by 7 days', () => {
    const mockData = createMockData();
    const result = filterByTimeRange(mockData, '7d');
    expect(result).toHaveLength(1);
    expect(result[0].weight_g).toBe(100);
  });

  it('should filter by 30 days', () => {
    const mockData = createMockData();
    const result = filterByTimeRange(mockData, '30d');
    expect(result).toHaveLength(2);
  });

  it('should filter by 90 days', () => {
    const mockData = createMockData();
    const result = filterByTimeRange(mockData, '90d');
    expect(result).toHaveLength(3);
  });

  it('should filter by 365 days', () => {
    const mockData = createMockData();
    const result = filterByTimeRange(mockData, '365d');
    expect(result).toHaveLength(4);
  });

  it('should return all data for "all" range', () => {
    const mockData = createMockData();
    const result = filterByTimeRange(mockData, 'all');
    expect(result).toHaveLength(4);
  });
  it('should handle empty input', () => {
    const result = filterByTimeRange([], '30d');
    expect(result).toHaveLength(0);
  });
});

describe('harvestsToChartData', () => {
  const mockHarvests = [
    {
      stage_started_at: new Date('2024-01-01'),
      stage: 'harvest',
      wet_weight_g: 1000,
      dry_weight_g: 250,
      trimmings_weight_g: 100,
      plant_id: 'plant-1',
    },
    {
      stage_started_at: new Date('2024-01-02'),
      stage: 'drying',
      wet_weight_g: undefined,
      dry_weight_g: 240,
      trimmings_weight_g: undefined,
      plant_id: 'plant-1',
    },
    {
      stage_started_at: new Date('2024-01-03'),
      stage: 'curing',
      wet_weight_g: undefined,
      dry_weight_g: 235,
      trimmings_weight_g: undefined,
      plant_id: 'plant-1',
    },
  ];

  it('should convert harvests to chart data using dry weight by default', () => {
    const result = harvestsToChartData(mockHarvests);

    expect(result).toHaveLength(3);
    expect(result[0].weight_g).toBe(250);
    expect(result[1].weight_g).toBe(240);
    expect(result[2].weight_g).toBe(235);
  });

  it('should use wet weight when specified', () => {
    const result = harvestsToChartData(mockHarvests, 'wet_weight_g');

    expect(result).toHaveLength(1); // Only first harvest has wet weight
    expect(result[0].weight_g).toBe(1000);
  });

  it('should use trimmings weight when specified', () => {
    const result = harvestsToChartData(mockHarvests, 'trimmings_weight_g');

    expect(result).toHaveLength(1);
    expect(result[0].weight_g).toBe(100);
  });

  it('should filter out harvests with null/undefined weights', () => {
    const harvestsWithNulls = [
      {
        stage_started_at: new Date('2024-01-01'),
        stage: 'harvest',
        wet_weight_g: 1000,
        dry_weight_g: undefined,
      },
      {
        stage_started_at: new Date('2024-01-02'),
        stage: 'drying',
        dry_weight_g: 240,
      },
    ];

    const result = harvestsToChartData(harvestsWithNulls, 'dry_weight_g');

    expect(result).toHaveLength(1);
    expect(result[0].weight_g).toBe(240);
  });

  it('should sort by date ascending', () => {
    const unsortedHarvests = [
      {
        stage_started_at: new Date('2024-01-03'),
        stage: 'curing',
        dry_weight_g: 235,
      },
      {
        stage_started_at: new Date('2024-01-01'),
        stage: 'harvest',
        dry_weight_g: 250,
      },
      {
        stage_started_at: new Date('2024-01-02'),
        stage: 'drying',
        dry_weight_g: 240,
      },
    ];

    const result = harvestsToChartData(unsortedHarvests);

    expect(result[0].date.toISOString()).toBe(
      new Date('2024-01-01').toISOString()
    );
    expect(result[1].date.toISOString()).toBe(
      new Date('2024-01-02').toISOString()
    );
    expect(result[2].date.toISOString()).toBe(
      new Date('2024-01-03').toISOString()
    );
  });

  it('should handle empty input', () => {
    const result = harvestsToChartData([]);
    expect(result).toHaveLength(0);
  });
});

describe('getTimeRangeLabel', () => {
  it('should return correct labels for each range', () => {
    expect(getTimeRangeLabel('7d')).toBe('Last 7 days');
    expect(getTimeRangeLabel('30d')).toBe('Last 30 days');
    expect(getTimeRangeLabel('90d')).toBe('Last 90 days');
    expect(getTimeRangeLabel('365d')).toBe('Last year');
    expect(getTimeRangeLabel('all')).toBe('All time');
  });
});

describe('getTimeRangeDays', () => {
  it('should return correct day counts', () => {
    expect(getTimeRangeDays('7d')).toBe(7);
    expect(getTimeRangeDays('30d')).toBe(30);
    expect(getTimeRangeDays('90d')).toBe(90);
    expect(getTimeRangeDays('365d')).toBe(365);
    expect(getTimeRangeDays('all')).toBeNull();
  });
});
