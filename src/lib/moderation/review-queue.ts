import { nanoid } from 'nanoid/non-secure';

import { getItem, removeItem, setItem } from '@/lib/storage';

export type ReviewQueueItem = {
  id: string;
  contentId: string | number;
  reportCount: number;
  enqueuedAt: number;
  status: 'pending' | 'reviewed';
};

const REVIEW_QUEUE_KEY = 'moderation.reviewQueue.v1';

function now(): number {
  return Date.now();
}

function loadQueue(): ReviewQueueItem[] {
  return getItem<ReviewQueueItem[]>(REVIEW_QUEUE_KEY) ?? [];
}

function saveQueue(items: ReviewQueueItem[]): void {
  setItem(REVIEW_QUEUE_KEY, items);
}

export function enqueueForReview(
  contentId: string | number,
  reportCount: number
): ReviewQueueItem {
  const items = loadQueue();
  const existing = items.find(
    (i) => i.contentId === contentId && i.status === 'pending'
  );
  if (existing) {
    // Update reportCount if higher
    const updated = items.map((i) =>
      i.id === existing.id && reportCount > i.reportCount
        ? { ...i, reportCount }
        : i
    );
    saveQueue(updated);
    return updated.find((i) => i.id === existing.id)!;
  }
  const item: ReviewQueueItem = {
    id: nanoid(10),
    contentId,
    reportCount,
    enqueuedAt: now(),
    status: 'pending' as const,
  };
  items.unshift(item);
  saveQueue(items.slice(0, 500)); // cap queue length
  return item;
}

export function markReviewed(id: string): void {
  const items = loadQueue().map((i) =>
    i.id === id ? { ...i, status: 'reviewed' as const } : i
  );
  saveQueue(items);
}

export function getReviewQueue(): ReviewQueueItem[] {
  return loadQueue();
}

export function resetReviewQueue(): void {
  removeItem(REVIEW_QUEUE_KEY);
}
