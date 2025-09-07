import { DateTime } from 'luxon';

import { supabase } from '@/lib/supabase';
import { computeBackoffMs } from '@/lib/sync/backoff';
import { canSyncLargeFiles } from '@/lib/sync/network-manager';
import { uploadImageWithProgress } from '@/lib/uploads/image-upload';
import { database } from '@/lib/watermelon';

type QueueItemRaw = {
  id: string;
  local_uri: string;
  remote_path?: string | null;
  task_id?: string | null;
  plant_id?: string | null;
  filename?: string | null;
  mime_type?: string | null;
  status: 'pending' | 'uploading' | 'completed' | 'failed';
  retry_count?: number | null;
  last_error?: string | null;
  next_attempt_at?: number | null; // epoch ms
  created_at: number;
  updated_at: number;
};

export async function enqueueImage(params: {
  localUri: string;
  plantId: string;
  taskId?: string;
  filename: string;
  mimeType?: string;
}): Promise<string> {
  const coll = database.collections.get('image_upload_queue' as any);
  const created = await database.write(async () =>
    (coll as any).create((rec: any) => {
      rec.localUri = params.localUri;
      rec.remotePath = null;
      rec.taskId = params.taskId ?? null;
      rec.plantId = params.plantId;
      rec.filename = params.filename;
      rec.mimeType = params.mimeType ?? 'image/jpeg';
      rec.status = 'pending';
      rec.retryCount = 0;
      rec.lastError = null;
      rec.nextAttemptAt = null;
      rec.createdAt = new Date();
      rec.updatedAt = new Date();
    })
  );
  return created.id as string;
}
async function fetchDueBatch(limit = 5): Promise<QueueItemRaw[]> {
  const coll = database.collections.get('image_upload_queue' as any);
  const rows = await (coll as any).query().fetch();
  const now = Date.now();
  const due: QueueItemRaw[] = (rows as any[])
    .map((r) => r._raw as QueueItemRaw)
    .filter(
      (r) =>
        r.status === 'pending' &&
        (!r.next_attempt_at || r.next_attempt_at <= now)
    )
    .slice(0, limit);
  return due;
}

async function markUploading(id: string): Promise<void> {
  const coll = database.collections.get('image_upload_queue' as any);
  const row = await (coll as any).find(id);
  await database.write(async () =>
    row.update((rec: any) => {
      rec.status = 'uploading';
      rec.updatedAt = new Date();
    })
  );
}

async function markCompleted(id: string, remotePath: string): Promise<void> {
  const coll = database.collections.get('image_upload_queue' as any);
  const row = await (coll as any).find(id);
  await database.write(async () =>
    row.update((rec: any) => {
      rec.status = 'completed';
      rec.remotePath = remotePath;
      rec.updatedAt = new Date();
    })
  );
}

async function markFailure(
  id: string,
  attempt: number,
  err: unknown
): Promise<void> {
  const coll = database.collections.get('image_upload_queue' as any);
  const row = await (coll as any).find(id);
  const nextDelay = computeBackoffMs(attempt, 1000, 15 * 60 * 1000);
  const nextAt = Date.now() + nextDelay;
  await database.write(async () =>
    row.update((rec: any) => {
      rec.status = 'pending';
      rec.retryCount = attempt;
      rec.lastError = err instanceof Error ? err.message : String(err);
      rec.nextAttemptAt = nextAt;
      rec.updatedAt = new Date();
    })
  );
}

export async function processImageQueueOnce(
  maxBatch = 3
): Promise<{ processed: number }> {
  const allowed = await canSyncLargeFiles();
  if (!allowed) return { processed: 0 };

  const due = await fetchDueBatch(maxBatch);
  let processed = 0;
  for (const item of due) {
    try {
      await markUploading(item.id);
      const { bucket, path } = await uploadImageWithProgress({
        plantId: item.plant_id ?? '',
        filename: item.filename ?? `img-${DateTime.now().toMillis()}.jpg`,
        localUri: item.local_uri,
        mimeType: item.mime_type ?? 'image/jpeg',
        onProgress: () => {},
      });
      // Backfill to task metadata if task present
      if (item.task_id) {
        await backfillTaskRemotePath(item.task_id, `${bucket}/${path}`);
      }
      await markCompleted(item.id, path);
      processed++;
    } catch (err) {
      const attempt = (item.retry_count ?? 0) + 1;
      await markFailure(item.id, attempt, err);
    }
  }
  return { processed };
}

export async function backfillTaskRemotePath(
  taskId: string,
  remotePath: string
): Promise<void> {
  try {
    const coll = database.collections.get('tasks' as any);
    const row = await (coll as any).find(taskId);
    await database.write(async () =>
      row.update((rec: any) => {
        const meta = (rec.metadata ?? {}) as Record<string, unknown>;
        rec.metadata = { ...meta, imagePath: remotePath } as any;
        rec.updatedAt = new Date();
      })
    );
  } catch {
    // swallow if local task missing
  }
  // Optionally also persist to server immediately (non-blocking)
  try {
    await supabase
      .from('tasks')
      .update({ metadata: { imagePath: remotePath } as any })
      .eq('id', taskId);
  } catch {}
}
