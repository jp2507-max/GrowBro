import { setItem } from '@/lib/storage';
import { synchronize } from '@/lib/sync-engine';

// Mock dependencies
jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({
        data: { session: { access_token: 'mock-token' } },
      }),
    },
  },
}));

jest.mock('@/lib/storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

jest.mock('@/lib/analytics', () => ({
  NoopAnalytics: {
    track: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('@/lib/task-notifications', () => ({
  TaskNotificationService: jest.fn().mockImplementation(() => ({
    rehydrateNotifications: jest.fn().mockResolvedValue(undefined),
  })),
}));

// Mock fetch globally
global.fetch = jest.fn();

describe('Sync Engine 404 Handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
  });

  it('should disable sync for 5 minutes on 404', async () => {
    // Mock fetch to return 404 for pull
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/sync/pull')) {
        return Promise.resolve({
          ok: false,
          status: 404,
        });
      }
      if (url.includes('/sync/push')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        });
      }
      return Promise.reject(new Error('Unknown endpoint'));
    });

    // Expect synchronize to throw
    await expect(synchronize()).rejects.toThrow('pull failed: 404');

    // Check if setItem was called with correct cooldown
    const setItemMock = setItem as jest.Mock;

    // Find call to 'sync.disabledUntilMs'
    const call = setItemMock.mock.calls.find(
      (args) => args[0] === 'sync.disabledUntilMs'
    );
    expect(call).toBeDefined();

    const disabledUntil = call[1];
    const now = Date.now();
    const expectedDelay = 5 * 60 * 1000;

    // Check if the set time is close to now + 5 mins
    const diff = disabledUntil - now;
    if (Math.abs(diff - expectedDelay) > 5000) {
      throw new Error(
        `Expected approx ${expectedDelay}ms delay (5 mins), got ${diff}ms. disabledUntil=${disabledUntil}, now=${now}`
      );
    }
  });
});
