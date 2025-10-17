/**
 * Forecasting Service Tests
 *
 * Unit tests for consumption forecasting algorithms (SMA and SES).
 *
 * Requirements: 6.3, 6.6
 *
 * Note: Full integration tests with real database operations will be
 * implemented in forecasting-integration.test.ts as part of Task 16.
 */

import { ForecastingService } from '../forecasting-service';

describe('ForecastingService', () => {
  describe('Configuration', () => {
    it('should initialize with default configuration', () => {
      const mockDb = {} as any;
      const service = new ForecastingService(mockDb);

      expect(service).toBeDefined();
    });

    it('should initialize with custom configuration', () => {
      const mockDb = {} as any;
      const customConfig = {
        smaWindowDays: 42,
        smaMinDataPoints: 10,
        sesAlpha: 0.4,
        sesMinDays: 70,
        safetyBufferPercent: 0.15,
        predictionIntervalZScore: 1.64,
      };

      const service = new ForecastingService(mockDb, customConfig);

      expect(service).toBeDefined();
    });
  });

  describe('API Contract', () => {
    it('should expose required methods', () => {
      const mockDb = {} as any;
      const service = new ForecastingService(mockDb);

      expect(typeof service.calculateConsumptionRate).toBe('function');
      expect(typeof service.calculateDaysToZero).toBe('function');
      expect(typeof service.generateReorderRecommendation).toBe('function');
      expect(typeof service.getStockForecast).toBe('function');
    });
  });

  // TODO: Add integration tests with mocked WatermelonDB queries
  // covering:
  // - SMA calculation with 8 weeks of data
  // - SES upgrade with ≥12 weeks of data
  // - Days-to-zero forecast with safety buffer
  // - Reorder recommendations with lead time
  // - Edge cases: insufficient data, zero stock, sparse data
});
