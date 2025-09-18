import { InMemoryMetrics } from '@/lib/analytics';

describe('InMemoryMetrics', () => {
  it('stores and retrieves events', () => {
    const metrics = new InMemoryMetrics();
    metrics.track('notif_scheduled', { taskId: 't1' });
    metrics.track('sync_push', { pushed: 3, queue_length: 5 });
    const events = metrics.getAll();
    expect(events.length).toBe(2);
    expect(events[0].name).toBe('notif_scheduled');
    expect((events[0].payload as any).taskId).toBe('t1');
    expect(events[1].name).toBe('sync_push');
  });

  it('clears events', () => {
    const metrics = new InMemoryMetrics();
    metrics.track('notif_scheduled', { taskId: 't1' });
    metrics.clear();
    expect(metrics.getAll().length).toBe(0);
  });
});
