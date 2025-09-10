import { schema } from '@/lib/watermelon-schema';

// Make slow hangs explicit in CI logs and fail faster than the default.
jest.setTimeout(10000);

console.log('[test-debug] watermelon-migrations test file loaded');

describe('WatermelonDB migrations', () => {
  it('exposes occurrence_overrides with deleted_at column in schema mock', () => {
    console.log('[test-debug] watermelon-migrations test started');
    const tables = (schema as any).tables as any[];
    const table = tables.find((t) => t.name === 'occurrence_overrides');
    expect(table).toBeTruthy();
    expect(table.columns.some((c: any) => c.name === 'deleted_at')).toBe(true);
    console.log('[test-debug] watermelon-migrations test finished');
  });
});

afterAll(() => {
  // Defensive: ensure all timers/listeners from mocks are cleared
  jest.clearAllTimers();
});
