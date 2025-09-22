import { nanoid } from 'nanoid/non-secure';

import { apiReportContent } from '@/api/moderation';
import { getItem, removeItem, setItem } from '@/lib/storage';

export type QueueStatus = 'queued' | 'sent' | 'failed' | 'escalated';

export type ContentReport = {
  id: string;
  contentId: string | number;
  reason: string;
  createdAt: number;
  status: QueueStatus;
  attempts: number;
  // optional processing gate: do not attempt sending before this time (ms)
  notBefore?: number;
};

export type AuditActionType =
  | 'report_enqueued'
  | 'report_sent'
  | 'report_failed'
  | 'block_user'
  | 'mute_user'
  | 'delete_content'
  | 'escalate_report';

export type AuditEntry = {
  id: string;
  action: AuditActionType;
  at: number;
  metadata?: Record<string, unknown>;
};

const QUEUE_KEY = 'moderation.queue.v1';
const AUDIT_KEY = 'moderation.audit.v1';

function now(): number {
  return Date.now();
}

export class ModerationQueue {
  private loadQueue(): ContentReport[] {
    return getItem<ContentReport[]>(QUEUE_KEY) ?? [];
  }

  private saveQueue(items: ContentReport[]): void {
    setItem(QUEUE_KEY, items);
  }

  private loadAudit(): AuditEntry[] {
    return getItem<AuditEntry[]>(AUDIT_KEY) ?? [];
  }

  private saveAudit(items: AuditEntry[]): void {
    setItem(AUDIT_KEY, items);
  }

  reset(): void {
    removeItem(QUEUE_KEY);
    removeItem(AUDIT_KEY);
  }

  getQueue(): ContentReport[] {
    return this.loadQueue();
  }

  getAuditTrail(): AuditEntry[] {
    return this.loadAudit();
  }

  auditAction(
    action: AuditActionType,
    metadata?: Record<string, unknown>
  ): void {
    const items = this.loadAudit();
    items.unshift({ id: nanoid(8), action, at: now(), metadata });
    this.saveAudit(items.slice(0, 500)); // cap to last 500 entries
  }

  enqueueReport(contentId: string | number, reason: string): ContentReport {
    const items = this.loadQueue();
    const report: ContentReport = {
      id: nanoid(10),
      contentId,
      reason,
      createdAt: now(),
      status: 'queued',
      attempts: 0,
    };
    items.push(report);
    this.saveQueue(items);
    this.auditAction('report_enqueued', { contentId, reason, id: report.id });
    return report;
  }

  setNotBefore(reportId: string, notBefore: number): void {
    const items = this.loadQueue().map((r) =>
      r.id === reportId ? { ...r, notBefore } : r
    );
    this.saveQueue(items);
  }

  async processReport(report: ContentReport): Promise<ContentReport> {
    // honor not-before gating for rate limiting or backoff
    if (report.notBefore && now() < report.notBefore) {
      return report; // skip for now; will be retried later
    }
    try {
      await apiReportContent({
        contentId: report.contentId,
        reason: report.reason,
      });
      this.auditAction('report_sent', {
        contentId: report.contentId,
        id: report.id,
      });
      // remove from queue
      const items = this.loadQueue().filter((r) => r.id !== report.id);
      this.saveQueue(items);
      return { ...report, status: 'sent', attempts: report.attempts + 1 };
    } catch (e) {
      const updated: ContentReport = {
        ...report,
        status: 'failed',
        attempts: report.attempts + 1,
      };
      const items = this.loadQueue().map((r) =>
        r.id === report.id ? updated : r
      );
      this.saveQueue(items);
      this.auditAction('report_failed', {
        contentId: report.contentId,
        id: report.id,
        error: (e as Error)?.message,
      });
      return updated;
    }
  }

  async processAll(): Promise<void> {
    const items = this.loadQueue();
    for (const r of items) {
      if (r.status !== 'queued') continue;
      if (r.notBefore && now() < r.notBefore) continue; // skip until allowed
      // process sequentially to keep it simple and predictable
      // SLA target (<=5s to submit) depends on server availability; this method just forwards ASAP
      // In CI or offline mode, they will remain queued or be marked failed and retried later.
      await this.processReport(r);
    }
  }

  escalateToHuman(reportId: string, reason?: string): void {
    const items = this.loadQueue();
    const idx = items.findIndex((r) => r.id === reportId);
    if (idx >= 0) {
      items[idx] = { ...items[idx], status: 'escalated' };
      this.saveQueue(items);
    }
    this.auditAction('escalate_report', { reportId, reason });
  }
}

export const moderationQueue = new ModerationQueue();
