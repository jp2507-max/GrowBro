import { nanoid } from 'nanoid/non-secure';

import { apiSubmitAppeal } from '@/api/moderation/appeals';
import { getItem, removeItem, setItem } from '@/lib/storage';

export type Appeal = {
  id: string;
  contentId: string | number;
  reason: string;
  details?: string;
  createdAt: number;
  attempts: number;
  status: 'queued' | 'sent' | 'failed';
  notBefore?: number;
};

const KEY = 'moderation.appeals.queue.v1';

function now(): number {
  return Date.now();
}

export class AppealsQueue {
  private load(): Appeal[] {
    return getItem<Appeal[]>(KEY) ?? [];
  }
  private save(items: Appeal[]): void {
    setItem(KEY, items);
  }
  reset(): void {
    removeItem(KEY);
  }
  getAll(): Appeal[] {
    return this.load();
  }
  enqueue(
    contentId: string | number,
    reason: string,
    details?: string
  ): Appeal {
    const items = this.load();
    const item: Appeal = {
      id: nanoid(10),
      contentId,
      reason,
      details,
      createdAt: now(),
      attempts: 0,
      status: 'queued',
    };
    items.push(item);
    this.save(items);
    return item;
  }
  async processOne(item: Appeal): Promise<Appeal> {
    if (item.notBefore && now() < item.notBefore) return item;
    try {
      await apiSubmitAppeal({
        contentId: item.contentId,
        reason: item.reason,
        details: item.details,
      });
      const items = this.load().filter((x) => x.id !== item.id);
      this.save(items);
      return { ...item, status: 'sent', attempts: item.attempts + 1 };
    } catch {
      const updated: Appeal = {
        ...item,
        status: 'failed',
        attempts: item.attempts + 1,
      };
      const items = this.load().map((x) => (x.id === item.id ? updated : x));
      this.save(items);
      return updated;
    }
  }
  async processAll(): Promise<void> {
    const items = this.load();
    for (const a of items) {
      if (a.status !== 'queued') continue;
      if (a.notBefore && now() < a.notBefore) continue;
      await this.processOne(a);
    }
  }
}

export const appealsQueue = new AppealsQueue();
