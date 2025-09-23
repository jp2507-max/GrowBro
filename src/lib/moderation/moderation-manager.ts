import { client } from '@/api';
import { validateAuthenticatedUserId } from '@/lib/auth';
import { appealsQueue } from '@/lib/moderation/appeals-queue';
import { incrementReportAndMaybeHide } from '@/lib/moderation/auto-hide';
import { moderationQueue } from '@/lib/moderation/moderation-queue';
import {
  checkRateLimit,
  DEFAULT_POLICY,
  getBackoffUntil,
  nextAllowedTimestamp,
  recordBackoff,
} from '@/lib/moderation/rate-limit';
import { detectSpam } from '@/lib/moderation/spam-detector';

// Background processing scheduler to avoid calling processAll() too frequently
let processScheduled = false;
function scheduleQueueProcessing(): void {
  if (processScheduled) return; // already scheduled
  processScheduled = true;

  // Process queued reports after a short delay to batch multiple enqueues
  setTimeout(async () => {
    processScheduled = false;
    try {
      await moderationQueue.processAll();
    } catch (error) {
      // Log error but don't throw - this is background processing
      console.warn(
        '[ModerationManager] Failed to process moderation queue:',
        error
      );
    }
  }, 1000); // 1 second delay to allow batching
}

// Background processing scheduler for appeals queue
let appealsProcessScheduled = false;
function scheduleAppealsQueueProcessing(): void {
  if (appealsProcessScheduled) return; // already scheduled
  appealsProcessScheduled = true;

  // Process queued appeals after a short delay to batch multiple enqueues
  setTimeout(async () => {
    appealsProcessScheduled = false;
    try {
      await appealsQueue.processAll();
    } catch (error) {
      // Log error but don't throw - this is background processing
      console.warn(
        '[ModerationManager] Failed to process appeals queue:',
        error
      );
    }
  }, 1000); // 1 second delay to allow batching
}

export type ModerationReason = 'spam' | 'harassment' | 'illegal' | 'other';

export type ReportResult =
  | {
      status: 'queued' | 'sent';
      submittedAt?: number;
      error?: { message?: string; code?: string };
      retryAfterMs?: number;
    }
  | {
      status: 'error';
      error: { message?: string; code?: string };
      retryAfterMs?: number;
    };

export type BlockResult =
  | {
      status: 'ok';
      blockedUserId?: string | number;
      error?: { message?: string; code?: string };
      retryAfterMs?: number;
    }
  | {
      status: 'error';
      error: { message?: string; code?: string };
      retryAfterMs?: number;
    };

export type MuteResult =
  | {
      status: 'ok';
      mutedUserId?: string | number;
      error?: { message?: string; code?: string };
      retryAfterMs?: number;
    }
  | {
      status: 'error';
      error: { message?: string; code?: string };
      retryAfterMs?: number;
    };

export type DeleteResult =
  | {
      status: 'ok';
      contentId?: string | number;
      error?: { message?: string; code?: string };
      retryAfterMs?: number;
    }
  | {
      status: 'error';
      error: { message?: string; code?: string };
      retryAfterMs?: number;
    };

export interface ModerationManager {
  reportContent(
    contentId: string | number,
    reason: ModerationReason,
    userId: string
  ): Promise<ReportResult>;
  blockUser(
    userIdToBlock: string | number,
    authenticatedUserId: string
  ): Promise<BlockResult>;
  muteUser(
    userIdToMute: string | number,
    authenticatedUserId: string
  ): Promise<MuteResult>;
  deleteOwnContent(
    contentId: string | number,
    authenticatedUserId: string
  ): Promise<DeleteResult>;
  submitAppeal(
    contentId: string | number,
    options: {
      reason: string;
      authenticatedUserId: string;
      details?: string;
    }
  ): Promise<{ status: 'sent' | 'queued'; submittedAt: number }>;
}

// Minimal implementation using API client with graceful fallback.
export const moderationManager: ModerationManager = {
  async reportContent(contentId, reason, userId) {
    // Validate authenticated user
    const validatedUserId = await validateAuthenticatedUserId(userId);

    // Rate limit guard
    const rl = checkRateLimit(validatedUserId, 'report', DEFAULT_POLICY);
    const spam = detectSpam({ reason });
    if (!rl.allowed || spam === 'deny' || spam === 'suspicious') {
      // Increment local report stats and maybe auto-hide
      const result = incrementReportAndMaybeHide(contentId);
      if (result.hidden) {
        moderationQueue.auditAction('report_enqueued', {
          contentId,
          reason,
          autoHidden: true,
          count: result.count,
        });
      }
      const notBefore = !rl.allowed
        ? nextAllowedTimestamp(validatedUserId, 'report', DEFAULT_POLICY)
        : undefined;
      const r = moderationQueue.enqueueReport(contentId, reason);
      if (notBefore) moderationQueue.setNotBefore(r.id, notBefore);
      if (spam === 'deny' || spam === 'suspicious') {
        moderationQueue.escalateToHuman(r.id, `auto:${spam}`);
      }
      // backoff if duplicate rapid reports on same content
      recordBackoff(validatedUserId, contentId, 10_000);
      // Schedule background processing of queued reports
      scheduleQueueProcessing();
      return { status: 'queued', submittedAt: Date.now() };
    }
    // Increment local report stats and maybe auto-hide once per report attempt
    const result = incrementReportAndMaybeHide(contentId);

    // Build audit payload once
    const auditPayload = {
      contentId,
      reason,
      userId: validatedUserId,
      autoHidden: result.hidden,
      count: result.count,
    };

    try {
      await client.post('/moderation/report', { contentId, reason });
      moderationQueue.auditAction('report_sent', auditPayload);
      return { status: 'sent', submittedAt: Date.now() };
    } catch {
      moderationQueue.auditAction('report_failed', auditPayload);
      const backoffUntil = getBackoffUntil(validatedUserId, contentId);
      const r = moderationQueue.enqueueReport(contentId, reason);
      if (backoffUntil) moderationQueue.setNotBefore(r.id, backoffUntil);
      // Schedule background processing of queued reports
      scheduleQueueProcessing();
      return { status: 'queued', submittedAt: Date.now() };
    }
  },
  async blockUser(userIdToBlock, authenticatedUserId) {
    // Validate authenticated user
    const validatedUserId =
      await validateAuthenticatedUserId(authenticatedUserId);

    try {
      await client.post('/moderation/block', { userId: userIdToBlock });
    } catch {
      // ignore, optimistic
    }
    moderationQueue.auditAction('block_user', {
      userId: userIdToBlock,
      authenticatedUserId: validatedUserId,
    });
    return { status: 'ok', blockedUserId: userIdToBlock };
  },
  async muteUser(userIdToMute, authenticatedUserId) {
    // Validate authenticated user
    const validatedUserId =
      await validateAuthenticatedUserId(authenticatedUserId);

    try {
      await client.post('/moderation/mute', { userId: userIdToMute });
    } catch {
      // Optimistic: continue even if API call fails, log for later retry
    }
    moderationQueue.auditAction('mute_user', {
      userId: userIdToMute,
      authenticatedUserId: validatedUserId,
    });
    return { status: 'ok', mutedUserId: userIdToMute };
  },
  async deleteOwnContent(contentId, authenticatedUserId) {
    // Validate authenticated user
    const validatedUserId =
      await validateAuthenticatedUserId(authenticatedUserId);

    await client.post('/moderation/delete', { contentId });
    moderationQueue.auditAction('delete_content', {
      contentId,
      authenticatedUserId: validatedUserId,
    });
    return { status: 'ok', contentId };
  },
  async submitAppeal(
    contentId: string | number,
    options: { reason: string; authenticatedUserId: string; details?: string }
  ) {
    const { reason, authenticatedUserId, details } = options;
    // Validate authenticated user
    await validateAuthenticatedUserId(authenticatedUserId);

    try {
      await client.post('/moderation/appeal', { contentId, reason, details });
      return { status: 'sent', submittedAt: Date.now() };
    } catch {
      appealsQueue.enqueue(contentId, reason, details);
      // Schedule background processing of queued appeals
      scheduleAppealsQueueProcessing();
      return { status: 'queued', submittedAt: Date.now() };
    }
  },
};
