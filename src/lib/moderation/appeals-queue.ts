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

// Simple mutex for coordinating access to the appeals queue
class Mutex {
  private locked = false;
  private waiting: (() => void)[] = [];

  async acquire(): Promise<() => void> {
    return new Promise((resolve) => {
      if (!this.locked) {
        this.locked = true;
        resolve(() => this.release());
      } else {
        this.waiting.push(() => {
          this.locked = true;
          resolve(() => this.release());
        });
      }
    });
  }

  private release(): void {
    this.locked = false;
    if (this.waiting.length > 0) {
      const next = this.waiting.shift()!;
      next();
    }
  }
}

// Global mutex instance for queue operations
const queueMutex = new Mutex();

// Retry with exponential backoff
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 50
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      if (attempt === maxRetries) {
        throw lastError;
      }

      // Exponential backoff: 50ms, 100ms, 200ms
      const delay = baseDelay * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
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

    return withRetry(async () => {
      // Acquire lock for the critical section
      const release = await queueMutex.acquire();

      try {
        // Load current state
        const items = this.load();

        // Check if item still exists and is in expected state
        const currentItem = items.find((x) => x.id === item.id);
        if (!currentItem || currentItem.status !== 'queued') {
          return currentItem || item;
        }

        try {
          // Attempt to submit the appeal
          await apiSubmitAppeal({
            contentId: item.contentId,
            reason: item.reason,
            details: item.details,
          });

          // Success: remove from queue
          const updatedItems = items.filter((x) => x.id !== item.id);
          this.save(updatedItems);
          return { ...item, status: 'sent', attempts: item.attempts + 1 };
        } catch (error) {
          // Failure: update item status and retry count
          const updated: Appeal = {
            ...item,
            status: 'failed',
            attempts: item.attempts + 1,
          };
          const updatedItems = items.map((x) =>
            x.id === item.id ? updated : x
          );
          this.save(updatedItems);
          return updated;
        }
      } finally {
        // Always release the lock
        release();
      }
    });
  }
  async processAll(): Promise<void> {
    const items = this.load();
    const errors: Error[] = [];

    for (const a of items) {
      if (a.status !== 'queued') continue;
      if (a.notBefore && now() < a.notBefore) continue;

      try {
        await this.processOne(a);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        console.error(
          `[AppealsQueue] Failed to process appeal ${a.id} (${a.status}):`,
          err
        );
        errors.push(err);
      }
    }

    if (errors.length > 0) {
      throw new AggregateError(
        errors,
        `Failed to process ${errors.length} appeals`
      );
    }
  }
}

export const appealsQueue = new AppealsQueue();
