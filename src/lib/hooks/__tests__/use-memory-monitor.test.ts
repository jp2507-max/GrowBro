/**
 * Unit tests for useMemoryMonitor hook
 */

import { renderHook, waitFor } from '@testing-library/react-native';

import { useMemoryMonitor } from '../use-memory-monitor';

// Mock memory monitor utilities
jest.mock('@/lib/performance/memory-monitor', () => ({
  getMemoryMetrics: jest.fn(() => ({
    timestamp: Date.now(),
    heapUsed: 10 * 1024 * 1024,
    heapTotal: 20 * 1024 * 1024,
    rssMemory: 30 * 1024 * 1024,
  })),
}));

describe('useMemoryMonitor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns initial state when disabled', () => {
    const { result } = renderHook(() => useMemoryMonitor({ enabled: false }));

    expect(result.current.current).toBeNull();
    expect(result.current.baseline).toBeNull();
    expect(result.current.deltaMB).toBe(0);
    expect(result.current.isMonitoring).toBe(false);
  });

  it('captures baseline when enabled', async () => {
    const { result } = renderHook(() => useMemoryMonitor({ enabled: true }));

    await waitFor(() => {
      expect(result.current.baseline).not.toBeNull();
    });

    expect(result.current.baseline).toHaveProperty('timestamp');
    expect(result.current.baseline).toHaveProperty('heapUsed');
    expect(result.current.baseline).toHaveProperty('heapTotal');
    expect(result.current.baseline).toHaveProperty('rssMemory');
  });

  it('updates current metrics on interval', async () => {
    const { result } = renderHook(() =>
      useMemoryMonitor({ enabled: true, intervalMs: 1000 })
    );

    await waitFor(() => {
      expect(result.current.current).not.toBeNull();
    });

    const initialTimestamp = result.current.current?.timestamp;

    // Fast-forward time
    jest.advanceTimersByTime(1000);

    await waitFor(() => {
      expect(result.current.current?.timestamp).not.toBe(initialTimestamp);
    });
  });

  it('calculates memory delta correctly', async () => {
    const mockGetMemoryMetrics = require('@/lib/performance/memory-monitor')
      .getMemoryMetrics as jest.Mock;

    // First call (baseline)
    mockGetMemoryMetrics.mockReturnValueOnce({
      timestamp: Date.now(),
      heapUsed: 10 * 1024 * 1024,
      heapTotal: 20 * 1024 * 1024,
      rssMemory: 30 * 1024 * 1024,
    });

    // Second call (current)
    mockGetMemoryMetrics.mockReturnValueOnce({
      timestamp: Date.now(),
      heapUsed: 15 * 1024 * 1024,
      heapTotal: 25 * 1024 * 1024,
      rssMemory: 80 * 1024 * 1024, // +50MB
    });

    const { result } = renderHook(() =>
      useMemoryMonitor({ enabled: true, intervalMs: 1000 })
    );

    await waitFor(() => {
      expect(result.current.baseline).not.toBeNull();
    });

    // Fast-forward to trigger interval
    jest.advanceTimersByTime(1000);

    await waitFor(() => {
      expect(result.current.deltaMB).toBeCloseTo(50, 0);
    });
  });

  it('cleans up interval on unmount', async () => {
    const { unmount } = renderHook(() =>
      useMemoryMonitor({ enabled: true, intervalMs: 1000 })
    );

    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

    unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();
  });

  it('does not start interval when disabled', () => {
    const setIntervalSpy = jest.spyOn(global, 'setInterval');

    renderHook(() => useMemoryMonitor({ enabled: false }));

    expect(setIntervalSpy).not.toHaveBeenCalled();
  });
});
