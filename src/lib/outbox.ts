import { supabase } from './supabase';

export type OutboxActionType = 'schedule' | 'cancel';

export type OutboxEntry = {
  id: string;
  created_at: string;
  processed_at: string | null;
  attempted_count: number;
  next_attempt_at: string | null;
  expires_at: string | null;
  action_type: OutboxActionType;
  payload: Record<string, any>;
  status: 'pending' | 'in_progress' | 'processed' | 'failed' | 'expired';
  business_key?: string | null;
};

// Contract: enqueueOutboxEntry will be called inside the same DB transaction that updates tasks
// so the insert is atomic relative to task changes. Provide business_key when you want to
// deduplicate logically identical actions (e.g., task_id + notification_id + action_type).
export async function enqueueOutboxEntry(params: {
  action_type: OutboxActionType;
  payload: Record<string, any>;
  business_key?: string | null;
  // optional TTL in seconds
  ttlSeconds?: number;
  // optional next attempt delay in seconds (defaults to immediate)
  initialDelaySeconds?: number;
}) {
  const {
    action_type,
    payload,
    business_key = null,
    ttlSeconds,
    initialDelaySeconds,
  } = params;
  const now = new Date();
  const expires_at = ttlSeconds
    ? new Date(now.getTime() + ttlSeconds * 1000).toISOString()
    : null;
  const next_attempt_at = initialDelaySeconds
    ? new Date(now.getTime() + initialDelaySeconds * 1000).toISOString()
    : null;

  // Insert into outbox. If business_key provided, rely on unique index to avoid duplicates.
  const { data, error } = await supabase
    .from('outbox_notification_actions')
    .insert([
      {
        action_type,
        payload,
        business_key,
        expires_at,
        next_attempt_at,
      },
    ]);

  if (error) {
    // If unique violation on business_key happens, it's fine - entry already exists.
    // Supabase/PG returns error details; we bubble up for the caller to decide.
    throw error;
  }

  return data?.[0] as OutboxEntry | undefined;
}

// Worker: process pending entries. This implementation is idempotent: the worker first
// marks an entry in_progress (optimistic locking via status + id), then performs the
// schedule/cancel action using platform-specific scheduler helpers (injected). On success
// it marks processed_at and status=processed; on failure it increases attempted_count and
// computes backoff by setting next_attempt_at accordingly. Expired entries are marked expired.

export type Scheduler = {
  scheduleNotification: (payload: Record<string, any>) => Promise<void>;
  cancelNotification: (payload: Record<string, any>) => Promise<void>;
};

export async function processOutboxOnce(opts: {
  scheduler: Scheduler;
  maxBatch?: number;
  now?: Date;
}) {
  const { scheduler, maxBatch = 10, now = new Date() } = opts;

  const entries = await fetchPendingEntries(maxBatch, now);
  if (!entries || entries.length === 0) return { processed: 0 };

  let processed = 0;
  for (const entry of entries) {
    const wasProcessed = await processEntry(entry, scheduler, now);
    if (wasProcessed) processed++;
  }

  return { processed };
}

async function fetchPendingEntries(maxBatch: number, now: Date) {
  const { data: entries, error: fetchError } = await supabase
    .from('outbox_notification_actions')
    .select('*')
    .eq('status', 'pending')
    .or(`next_attempt_at.is.null,next_attempt_at.lte.${now.toISOString()}`)
    .or(`expires_at.is.null,expires_at.gte.${now.toISOString()}`)
    .limit(maxBatch)
    .order('created_at', { ascending: true });

  if (fetchError) throw fetchError;
  return entries as OutboxEntry[] | null;
}

async function processEntry(
  entry: OutboxEntry,
  scheduler: Scheduler,
  now: Date
): Promise<boolean> {
  // Try to claim the entry by updating status from 'pending' to 'in_progress'
  const claimed = await claimEntry(entry.id);
  if (!claimed) return false;

  try {
    if (entry.expires_at && new Date(entry.expires_at) < now) {
      await markExpired(entry.id);
      return false;
    }

    await executeAction(entry, scheduler);
    await markProcessed(entry.id);
    return true;
  } catch {
    await handleFailure(entry, now);
    return false;
  }
}

async function claimEntry(entryId: string): Promise<boolean> {
  const { data: claimed, error: claimError } = await supabase
    .from('outbox_notification_actions')
    .update({ status: 'in_progress' })
    .eq('id', entryId)
    .eq('status', 'pending')
    .select('id');

  if (claimError) return false;
  return claimed && claimed.length > 0;
}

async function executeAction(entry: OutboxEntry, scheduler: Scheduler) {
  if (entry.action_type === 'schedule') {
    await scheduler.scheduleNotification(entry.payload);
  } else if (entry.action_type === 'cancel') {
    await scheduler.cancelNotification(entry.payload);
  } else {
    throw new Error(`Unknown action_type: ${entry.action_type}`);
  }
}

async function markExpired(entryId: string) {
  await supabase
    .from('outbox_notification_actions')
    .update({ status: 'expired', processed_at: new Date().toISOString() })
    .eq('id', entryId);
}

async function markProcessed(entryId: string) {
  await supabase
    .from('outbox_notification_actions')
    .update({ status: 'processed', processed_at: new Date().toISOString() })
    .eq('id', entryId);
}

async function handleFailure(entry: OutboxEntry, now: Date) {
  const attempted = (entry.attempted_count || 0) + 1;
  const backoffSeconds = Math.min(
    60 * Math.pow(2, attempted - 1),
    60 * 60 * 24
  );
  const nextAttempt = new Date(
    now.getTime() + backoffSeconds * 1000
  ).toISOString();

  await supabase
    .from('outbox_notification_actions')
    .update({
      attempted_count: attempted,
      next_attempt_at: nextAttempt,
      status: 'pending',
    })
    .eq('id', entry.id);
}

export async function cleanupOutbox(opts: { olderThanSeconds?: number } = {}) {
  const { olderThanSeconds = 60 * 60 * 24 * 7 } = opts; // default 7 days
  const cutoff = new Date(Date.now() - olderThanSeconds * 1000).toISOString();

  // delete processed or expired entries older than cutoff
  const { error } = await supabase
    .from('outbox_notification_actions')
    .delete()
    .or(
      `(and(status.eq.processed,processed_at.lte.${cutoff}),(and(status.eq.expired,processed_at.lte.${cutoff})))`
    );

  if (error) throw error;
}
