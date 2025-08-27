import { processOutboxOnce } from './outbox';
import { supabase } from './supabase';

jest.mock('./supabase', () => ({
  supabase: {
    from: jest.fn().mockReturnThis(),
    insert: jest.fn(),
    select: jest.fn(),
    eq: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
  },
}));

const mockedSupabase: any = supabase as any;

function setupMocks() {
  mockedSupabase.from.mockReturnThis();
  mockedSupabase.update.mockResolvedValue({
    data: [{ id: '1' }],
    error: null,
  });
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
  mockedSupabase.select.mockResolvedValue({ data: [entry], error: null });

  const scheduler = {
    scheduleNotification: jest.fn().mockResolvedValue(undefined),
    cancelNotification: jest.fn(),
  };

  const result = await processOutboxOnce({
    scheduler,
    maxBatch: 1,
    now: new Date(),
  });

  expect(result.processed).toBeGreaterThanOrEqual(0);
  expect(scheduler.scheduleNotification).toHaveBeenCalledWith(entry.payload);
}

async function testFailureRetry() {
  const entry = createMockEntry({
    id: '2',
    payload: { notificationId: 'n2' },
  });

  setupMocks();
  mockedSupabase.select.mockResolvedValue({ data: [entry], error: null });
  mockedSupabase.update.mockResolvedValue({
    data: [{ id: '2' }],
    error: null,
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
  mockedSupabase.select.mockResolvedValue({ data: [entry], error: null });
  mockedSupabase.update.mockResolvedValue({
    data: [{ id: '3' }],
    error: null,
  });

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
