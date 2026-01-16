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
  // Access private members for testing using 'any'
  const service = analyticsService as any;

  beforeEach(() => {
    service.eventQueue = [];
    service.config.maxQueueSize = 1000; // Reset to default
    service.config.enabled = true;
  });

  it('should respect maxQueueSize limit', () => {
    // Set a small limit for testing
    service.configure({ maxQueueSize: 5 });

    // Add 10 events directly or via track
    for (let i = 0; i < 10; i++) {
      service.track('playbook_apply', {
        playbookId: `pb-${i}`,
        plantId: 'p1',
        appliedTaskCount: 1,
        durationMs: 100,
        jobId: 'j1',
      });
    }

    expect(service.eventQueue.length).toBe(5);
    // Should keep latest events (queue is trimmed from start: FIFO drop)
    // index 0 was the earliest remaining event.
    // Events added: 0, 1, 2, ..., 9.
    // If we keep last 5, we have 5, 6, 7, 8, 9.
    expect(service.eventQueue[0].playbookId).toBe('pb-5');
    expect(service.eventQueue[4].playbookId).toBe('pb-9');
  });

  it('should handle NaN maxQueueSize safely by defaulting to 1000', () => {
    service.configure({ maxQueueSize: NaN });

    // Add more than default 1000 items to verify cap
    const eventsToAdd = 1050;
    // We can push directly to speed up test
    for (let i = 0; i < eventsToAdd; i++) {
      service.eventQueue.push({ type: 'test', timestamp: i } as any);
    }

    // Trigger trim
    service.trimToQueueCap();

    expect(service.eventQueue.length).toBe(1000);
  });

  it('should handle Infinity maxQueueSize safely by defaulting to 1000', () => {
    service.configure({ maxQueueSize: Infinity });

    const eventsToAdd = 1050;
    for (let i = 0; i < eventsToAdd; i++) {
      service.eventQueue.push({ type: 'test', timestamp: i } as any);
    }

    service.trimToQueueCap();

    expect(service.eventQueue.length).toBe(1000);
  });

  it('should handle negative maxQueueSize safely by treating as 0', () => {
    // The implementation uses Math.max(0, ...)
    // But if we pass negative, normalizedMaxQueueSize will be negative, then Math.max makes it 0.
    service.configure({ maxQueueSize: -10 });

    service.eventQueue.push({ type: 'test' } as any);
    service.trimToQueueCap();

    expect(service.eventQueue.length).toBe(0);
  });
});
