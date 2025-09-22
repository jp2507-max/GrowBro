import { client } from '@/api';
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
    reason: ModerationReason
  ): Promise<ReportResult>;
  blockUser(userId: string | number): Promise<BlockResult>;
  muteUser(userId: string | number): Promise<MuteResult>;
  deleteOwnContent(contentId: string | number): Promise<DeleteResult>;
  submitAppeal(
    contentId: string | number,
    reason: string,
    details?: string
  ): Promise<{ status: 'sent' | 'queued'; submittedAt: number }>;
}

// Minimal implementation using API client with graceful fallback.
export const moderationManager: ModerationManager = {
  async reportContent(contentId, reason) {
    // Rate limit guard
    const userId = 'self'; // TODO: replace with actual auth user id when available
    const rl = checkRateLimit(userId, 'report', DEFAULT_POLICY);
    const spam = detectSpam({ reason });
    if (!rl.allowed || spam === 'deny' || spam === 'suspicious') {
      const notBefore = !rl.allowed
        ? nextAllowedTimestamp(userId, 'report', DEFAULT_POLICY)
        : undefined;
      const r = moderationQueue.enqueueReport(contentId, reason);
      if (notBefore) moderationQueue.setNotBefore(r.id, notBefore);
      if (spam === 'deny' || spam === 'suspicious') {
        moderationQueue.escalateToHuman(r.id, `auto:${spam}`);
      }
      // backoff if duplicate rapid reports on same content
      recordBackoff(userId, contentId, 10_000);
      return { status: 'queued', submittedAt: Date.now() };
    }
    try {
      await client.post('/moderation/report', { contentId, reason });
      moderationQueue.auditAction('report_sent', { contentId, reason });
      return { status: 'sent', submittedAt: Date.now() };
    } catch {
      const backoffUntil = getBackoffUntil(userId, contentId);
      const r = moderationQueue.enqueueReport(contentId, reason);
      if (backoffUntil) moderationQueue.setNotBefore(r.id, backoffUntil);
      return { status: 'queued', submittedAt: Date.now() };
    }
  },
  async blockUser(userId) {
    try {
      await client.post('/moderation/block', { userId });
    } catch {
      // ignore, optimistic
    }
    moderationQueue.auditAction('block_user', { userId });
    return { status: 'ok', blockedUserId: userId };
  },
  async muteUser(userId) {
    try {
      await client.post('/moderation/mute', { userId });
    } catch {
      // ignore, optimistic
    }
    moderationQueue.auditAction('mute_user', { userId });
    return { status: 'ok', mutedUserId: userId };
  },
  async deleteOwnContent(contentId) {
    try {
      await client.post('/moderation/delete', { contentId });
    } catch {
      // ignore, optimistic
    }
    moderationQueue.auditAction('delete_content', { contentId });
    return { status: 'ok', contentId };
  },
  async submitAppeal(contentId, reason, details) {
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
