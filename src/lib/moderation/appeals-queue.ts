import { nanoid } from 'nanoid/non-secure';

import { apiSubmitAppeal } from '@/api/moderation/appeals';
import { getAuthenticatedUserId } from '@/lib/auth/user-utils';
import { getItem, removeItem, setItem } from '@/lib/storage';
import type { AppealType } from '@/types/moderation';

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

/**
 * Infers appeal type from the reason string
 * Maps common reason keywords to appropriate appeal types
 */
function inferAppealType(reason: string): AppealType {
  const lowerReason = reason.toLowerCase();

  // Check for geo-restriction reasons first (highest priority)
  if (
    lowerReason.includes('geo') ||
    lowerReason.includes('location') ||
    lowerReason.includes('region') ||
    lowerReason.includes('country')
  ) {
    return 'geo_restriction';
  }

  // Check for content-removal indicators (higher priority than account keywords)
  if (
    lowerReason.includes('posted') ||
    lowerReason.includes('shared') ||
    lowerReason.includes('private') ||
    lowerReason.includes('information') ||
    lowerReason.includes('details') ||
    lowerReason.includes('data')
  ) {
    return 'content_removal';
  }

  // Check for account-related reasons (suspension, ban, etc.) - lowest priority
  if (
    lowerReason.includes('account') ||
    lowerReason.includes('ban') ||
    lowerReason.includes('suspend') ||
    lowerReason.includes('user')
  ) {
    return 'account_action';
  }

  // Default to content removal for all other cases
  return 'content_removal';
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

    try {
      return await withRetry(() => this.attemptSubmit(item));
    } catch (_error) {
      // All retry attempts exhausted - persist failure status
      console.error(
        `[AppealsQueue] Failed to submit appeal ${item.id} after all retries:`,
        _error
      );
      return this.persistFailure(item);
    }
  }

  private async attemptSubmit(item: Appeal): Promise<Appeal> {
    // 1) Acquire to snapshot state, then release before network call
    let release = await queueMutex.acquire();
    try {
      const items = this.load();
      const currentItem = items.find((x) => x.id === item.id);
      if (!currentItem || currentItem.status !== 'queued') {
        return currentItem || item;
      }
    } finally {
      release();
    }

    // 2) Network call outside lock
    const appealType = inferAppealType(item.reason);
    const userId = await getAuthenticatedUserId();
    const result = await apiSubmitAppeal({
      original_decision_id: String(item.contentId),
      appeal_type: appealType,
      counter_arguments: item.details || item.reason,
      user_id: userId,
    });
    if (!result.success) {
      console.error(
        `[AppealsQueue] Failed to submit appeal ${item.id}:`,
        result.error
      );
      throw new Error(result.error || 'Appeal submission failed');
    }

    // 3) Reacquire to mutate persisted queue
    release = await queueMutex.acquire();
    try {
      const itemsAfter = this.load();
      if (!itemsAfter.find((x) => x.id === item.id)) {
        // Already removed by another worker
        return { ...item, status: 'sent', attempts: item.attempts + 1 };
      }
      const updatedItems = itemsAfter.filter((x) => x.id !== item.id);
      this.save(updatedItems);
      return { ...item, status: 'sent', attempts: item.attempts + 1 };
    } finally {
      release();
    }
  }

  private async persistFailure(item: Appeal): Promise<Appeal> {
    // Acquire lock for the critical section
    const release = await queueMutex.acquire();

    try {
      // Load current state
      const items = this.load();

      // Check if item still exists
      const currentItem = items.find((x) => x.id === item.id);
      if (!currentItem) {
        return item;
      }

      // Update item status and retry count
      const updated: Appeal = {
        ...item,
        status: 'failed',
        attempts: item.attempts + 1,
      };
      const updatedItems = items.map((x) => (x.id === item.id ? updated : x));
      this.save(updatedItems);
      return updated;
    } finally {
      // Always release the lock
      release();
    }
  }
  async processAll(): Promise<void> {
    const items = this.load();
    const errors: Error[] = [];

    for (const a of items) {
      if (a.status !== 'queued') continue;
      if (a.notBefore && now() < a.notBefore) continue;

      try {
        await this.processOne(a);
      } catch (_error) {
        const err =
          _error instanceof Error ? _error : new Error(String(_error));
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
