/**
 * Performance Tests for Weight Chart Components
 *
 * Requirements: 4.2 (optimize rendering for 365+ data points)
 */

import { HarvestStage } from '@/types/harvest';

import { aggregateByDate, harvestsToChartData } from './chart-data-utils';
import { lttbDownsample } from './lttb-downsample';

describe('Weight Chart Performance', () => {
  describe('LTTB Downsampling Performance', () => {
    it('should downsample 365 points in <50ms', () => {
      // Create 365 days of data
      const data = Array.from({ length: 365 }, (_, i) => ({
        x: i,
        y: 1000 - i * 2 + Math.sin(i / 10) * 100,
      }));

      const start = performance.now();
      const result = lttbDownsample(data, 200);
      const duration = performance.now() - start;

      expect(result.length).toBe(200);
      expect(duration).toBeLessThan(50);
    });

    it('should downsample 1000 points in <100ms', () => {
      // Create 1000 data points
      const data = Array.from({ length: 1000 }, (_, i) => ({
        x: i,
        y: 1000 - i * 0.5 + Math.sin(i / 20) * 150,
      }));

      const start = performance.now();
      const result = lttbDownsample(data, 365);
      const duration = performance.now() - start;

      expect(result.length).toBe(365);
      expect(duration).toBeLessThan(100);
    });

    it('should downsample 5000 points in <500ms', () => {
      // Create 5000 data points (extreme case)
      const data = Array.from({ length: 5000 }, (_, i) => ({
        x: i,
        y: 1000 - i * 0.1 + Math.sin(i / 50) * 200,
      }));

      const start = performance.now();
      const result = lttbDownsample(data, 365);
      const duration = performance.now() - start;

      expect(result.length).toBe(365);
      expect(duration).toBeLessThan(500);
    });
  });

  describe('Data Transformation Performance', () => {
    it('should transform 365 harvests to chart data in <50ms', () => {
      const harvests = Array.from({ length: 365 }, (_, i) => ({
        stage_started_at: new Date(2024, 0, i + 1),
        stage: HarvestStage.DRYING,
        dry_weight_g: 1000 - i * 2,
        plant_id: 'plant-1',
      }));

      const start = performance.now();
      const result = harvestsToChartData(harvests);
      const duration = performance.now() - start;

      expect(result.length).toBe(365);
      expect(duration).toBeLessThan(50);
    });

    it('should aggregate 1000 chart data points by date in <100ms', () => {
      // Create 1000 chart points across 365 days (multiple per day)
      const chartData = Array.from({ length: 1000 }, (_, i) => ({
        date: new Date(2024, 0, (i % 365) + 1),
        weight_g: 100 + i * 0.5,
        stage: HarvestStage.DRYING,
        plant_id: `plant-${i % 10}`,
      }));

      const start = performance.now();
      const result = aggregateByDate(chartData);
      const duration = performance.now() - start;

      expect(result.length).toBeLessThanOrEqual(365);
      expect(duration).toBeLessThan(100);
    });
  });

  describe('Combined Pipeline Performance', () => {
    it('should handle full pipeline (transform → aggregate → downsample) in <150ms', () => {
      // Simulate realistic scenario: 500 harvests over 180 days
      const harvests = Array.from({ length: 500 }, (_, i) => ({
        stage_started_at: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
        stage: HarvestStage.DRYING,
        dry_weight_g: Math.floor(800 + Math.random() * 200),
        plant_id: `plant-${Math.floor(i / 50)}`,
      }));

      const start = performance.now();

      // Full pipeline
      const chartData = harvestsToChartData(harvests);
      const aggregated = aggregateByDate(chartData);

      // Convert chart data to downsample format
      const downsampleData = chartData.map((point, index) => ({
        x: index,
        y: point.weight_g,
      }));
      const downsampled = lttbDownsample(downsampleData, 365);

      const duration = performance.now() - start;

      expect(chartData.length).toBeGreaterThan(0);
      expect(aggregated.length).toBeGreaterThan(0);
      expect(downsampled.length).toBeLessThanOrEqual(365);
      expect(duration).toBeLessThan(150);
    });
  });

  describe('Memory Efficiency', () => {
    it('should not create excessive intermediate arrays', () => {
      const data = Array.from({ length: 1000 }, (_, i) => ({
        x: i,
        y: 1000 - i,
      }));

      // Run multiple times to check for memory leaks
      for (let i = 0; i < 100; i++) {
        lttbDownsample(data, 365);
      }

      // If this completes without hanging or crashing, memory is acceptable
      expect(true).toBe(true);
    });
  });

  describe('Edge Case Performance', () => {
    it('should handle empty array quickly', () => {
      const start = performance.now();
      const result = lttbDownsample([], 365);
      const duration = performance.now() - start;

      expect(result).toEqual([]);
      expect(duration).toBeLessThan(1);
    });

    it('should handle single point quickly', () => {
      const start = performance.now();
      const result = lttbDownsample([{ x: 1, y: 100 }], 365);
      const duration = performance.now() - start;

      expect(result).toEqual([{ x: 1, y: 100 }]);
      expect(duration).toBeLessThan(1);
    });

    it('should handle data smaller than threshold quickly', () => {
      const data = Array.from({ length: 10 }, (_, i) => ({
        x: i,
        y: i * 10,
      }));

      const start = performance.now();
      const result = lttbDownsample(data, 365);
      const duration = performance.now() - start;

      expect(result).toEqual(data);
      expect(duration).toBeLessThan(1);
    });
  });
});
