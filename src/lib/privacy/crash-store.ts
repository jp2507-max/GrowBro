import { getItem, setItem } from '@/lib/storage';

const CRASH_KEY = 'privacy.crash.raw.v1';

export type CrashRecord = {
  id: string;
  createdAt: number;
  payload: unknown;
};

export function addCrash(r: CrashRecord): void {
  const list = getItem<CrashRecord[]>(CRASH_KEY) ?? [];
  setItem(CRASH_KEY, [...list, r]);
}

export function getCrashes(): CrashRecord[] {
  return getItem<CrashRecord[]>(CRASH_KEY) ?? [];
}

export function anonymizeAndTruncate(beforeMs: number): number {
  const list = getCrashes();
  let changed = 0;
  const kept: CrashRecord[] = [];
  for (const c of list) {
    if (c.createdAt < beforeMs) {
      // Replace payload with minimal stats to respect storage limitation
      changed += 1;
      kept.push({ ...c, payload: { redacted: true } });
    } else {
      kept.push(c);
    }
  }
  setItem(CRASH_KEY, kept);
  return changed;
}
