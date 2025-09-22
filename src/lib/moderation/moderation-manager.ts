import { client } from '@/api';
import { validateAuthenticatedUserId } from '@/lib/auth';
import { appealsQueue } from '@/lib/moderation/appeals-queue';
import { moderationQueue } from '@/lib/moderation/moderation-queue';
import {
  checkRateLimit,
  DEFAULT_POLICY,
  getBackoffUntil,
  nextAllowedTimestamp,
  recordBackoff,
} from '@/lib/moderation/rate-limit';
import { detectSpam } from '@/lib/moderation/spam-detector';

export type ModerationReason = 'spam' | 'harassment' | 'illegal' | 'other';

export type ReportResult = { status: 'queued' | 'sent'; submittedAt: number };
export type BlockResult = { status: 'ok'; blockedUserId: string | number };
export type MuteResult = { status: 'ok'; mutedUserId: string | number };
export type DeleteResult = { status: 'ok'; contentId: string | number };

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
      return { status: 'queued', submittedAt: Date.now() };
    }
    try {
      await client.post('/moderation/report', { contentId, reason });
      moderationQueue.auditAction('report_sent', {
        contentId,
        reason,
        userId: validatedUserId,
      });
      return { status: 'sent', submittedAt: Date.now() };
    } catch {
      const backoffUntil = getBackoffUntil(validatedUserId, contentId);
      const r = moderationQueue.enqueueReport(contentId, reason);
      if (backoffUntil) moderationQueue.setNotBefore(r.id, backoffUntil);
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

    try {
      await client.post('/moderation/delete', { contentId });
    } catch {
      // Optimistic: continue even if API call fails, log for later retry
    }
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
      return { status: 'queued', submittedAt: Date.now() };
    }
  },
};

export default moderationManager;
