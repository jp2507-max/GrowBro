import { analyticsService } from '../service';

// Mock dependencies
jest.mock('@sentry/react-native', () => ({
  addBreadcrumb: jest.fn(),
  captureException: jest.fn(),
}));

jest.mock('react-native-mmkv', () => ({
  MMKV: jest.fn().mockImplementation(() => ({
    getString: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
  })),
}));

describe('AnalyticsService Queue Limits', () => {
  const service = analyticsService;

  beforeEach(() => {
    service.clearQueue();
    service.configure({
      maxQueueSize: 1000, // Reset to default
      enabled: true,
      batchSize: 10000, // Large batch size to manual control flushing
    });
  });

  it('should respect maxQueueSize limit', () => {
    // Set a small limit for testing
    service.configure({ maxQueueSize: 5 });

    // Add 10 events via track
    for (let i = 0; i < 10; i++) {
      service.track('sync_start', { operation: 'push' });
    }

    expect(service.getQueueSize()).toBe(5);
  });

  it('should handle NaN maxQueueSize safely by defaulting to 1000', () => {
    service.configure({ maxQueueSize: NaN });

    // Add more than default 1000 items to verify cap
    const eventsToAdd = 1050;
    for (let i = 0; i < eventsToAdd; i++) {
      service.track('sync_start', { operation: 'push' });
    }

    expect(service.getQueueSize()).toBe(1000);
  });

  it('should handle Infinity maxQueueSize safely by defaulting to 1000', () => {
    service.configure({ maxQueueSize: Infinity });

    const eventsToAdd = 1050;
    for (let i = 0; i < eventsToAdd; i++) {
      service.track('sync_start', { operation: 'push' });
    }

    expect(service.getQueueSize()).toBe(1000);
  });

  it('should handle negative maxQueueSize safely by treating as 0', () => {
    // The implementation uses Math.max(0, ...)
    service.configure({ maxQueueSize: -10 });

    service.track('sync_start', { operation: 'push' });

    expect(service.getQueueSize()).toBe(0);
  });
});
