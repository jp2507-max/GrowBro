import { processOutboxOnce } from './outbox';
import { supabase } from './supabase';

jest.mock('./supabase', () => {
  const chain: any = {};
  const methods = [
    'from',
    'insert',
    'select',
    'eq',
    'or',
    'limit',
    'order',
    'update',
    'delete',
  ];

  methods.forEach((method) => {
    chain[method] = jest.fn().mockReturnValue(chain);
  });

  return { supabase: chain };
});

const mockedSupabase: any = supabase as any;

function setupMocks() {
  // All methods are already set to return 'this' for chaining
  // In each test, we'll override the terminal method to return a resolved value
}

function createMockEntry(overrides: Record<string, any> = {}) {
  return {
    id: '1',
    status: 'pending',
    action_type: 'schedule',
    payload: { notificationId: 'n1' },
    attempted_count: 0,
    expires_at: null,
    ...overrides,
  };
}

describe('outbox worker', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  test('processes schedule action successfully', async () => {
    await testSuccessfulScheduleAction();
  });

  test('retries on failure and sets next_attempt_at', async () => {
    await testFailureRetry();
  });

  test('marks expired entries as expired', async () => {
    await testExpiredEntries();
  });
});

async function testSuccessfulScheduleAction() {
  const entry = createMockEntry();
  setupMocks();
  // fetchPendingEntries ends with .limit() - mock limit to return data
  mockedSupabase.limit.mockResolvedValue({ data: [entry], error: null });
  // claimEntry ends with .select('id') - return claimed entry only for that shape
  mockedSupabase.select.mockImplementation((arg?: any) => {
    if (arg === 'id') {
      return Promise.resolve({ data: [{ id: entry.id }], error: null });
    }
    return mockedSupabase;
  });

  const scheduler = {
    scheduleNotification: jest.fn().mockResolvedValue(undefined),
    cancelNotification: jest.fn(),
  };

  const result = await processOutboxOnce({
    scheduler,
    maxBatch: 1,
    now: new Date(),
  });

  expect(result.processed).toBe(1);
  expect(scheduler.scheduleNotification).toHaveBeenCalledTimes(1);
  expect(scheduler.scheduleNotification).toHaveBeenCalledWith(entry.payload);
  expect(mockedSupabase.update).toHaveBeenCalledWith(
    expect.objectContaining({
      status: 'processed',
      processed_at: expect.any(String),
    })
  );
}

async function testFailureRetry() {
  const entry = createMockEntry({
    id: '2',
    payload: { notificationId: 'n2' },
  });

  setupMocks();
  // fetchPendingEntries ends with .limit() - mock limit to return data
  mockedSupabase.limit.mockResolvedValue({ data: [entry], error: null });
  // claimEntry ends with .select('id') - return claimed entry
  mockedSupabase.select.mockImplementation((arg?: any) => {
    if (arg === 'id') {
      return Promise.resolve({ data: [{ id: '2' }], error: null });
    }
    return mockedSupabase;
  });

  const scheduler = {
    scheduleNotification: jest.fn().mockRejectedValue(new Error('boom')),
    cancelNotification: jest.fn(),
  };

  const result = await processOutboxOnce({
    scheduler,
    maxBatch: 1,
    now: new Date(),
  });

  expect(result.processed).toBe(0);
  expect(scheduler.scheduleNotification).toHaveBeenCalled();
}

async function testExpiredEntries() {
  const past = new Date(Date.now() - 1000 * 60 * 60).toISOString();
  const entry = createMockEntry({
    id: '3',
    payload: { notificationId: 'n3' },
    expires_at: past,
  });

  setupMocks();
  // fetchPendingEntries ends with .limit() - mock limit to return data
  mockedSupabase.limit.mockResolvedValue({ data: [entry], error: null });

  const scheduler = {
    scheduleNotification: jest.fn(),
    cancelNotification: jest.fn(),
  };

  const result = await processOutboxOnce({
    scheduler,
    maxBatch: 1,
    now: new Date(),
  });

  expect(result.processed).toBe(0);
}
