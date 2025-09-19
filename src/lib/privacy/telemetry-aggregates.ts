import { getItem, setItem } from '@/lib/storage';

const AGG_KEY = 'privacy.telemetry.aggregates.v1';

export type AggregateSnapshot = Record<string, number>; // bucket YYYY-MM-DD -> count

export function getAggregates(): AggregateSnapshot {
  return getItem<AggregateSnapshot>(AGG_KEY) ?? {};
}

export function incrementAggregate(bucket: string, count: number): void {
  const agg = getAggregates();
  agg[bucket] = (agg[bucket] ?? 0) + count;
  setItem(AGG_KEY, agg);
}
