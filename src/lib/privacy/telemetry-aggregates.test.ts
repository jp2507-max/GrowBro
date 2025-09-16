import {
  getAggregates,
  incrementAggregate,
} from '@/lib/privacy/telemetry-aggregates';

test('increments aggregate buckets', () => {
  const day = '2025-09-16';
  incrementAggregate(day, 3);
  incrementAggregate(day, 2);
  const agg = getAggregates();
  expect(agg[day]).toBeGreaterThanOrEqual(5);
});
