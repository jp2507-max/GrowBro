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

function generateDeterministicFilename(params: {
  localUri: string;
  plantId: string;
  taskId?: string;
  mimeType?: string;
}): string {
  // Create a simple hash of the localUri for stability
  let hash = 0;
  for (let i = 0; i < params.localUri.length; i++) {
    const char = params.localUri.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32-bit integer
  }
  const uriHash = Math.abs(hash).toString(16).slice(0, 8);

  // Use taskId or a fixed token
  const taskToken = params.taskId ?? 'notask';

  // Determine extension from mimeType or localUri
  let extension = 'jpg'; // default
  if (params.mimeType) {
    const mimeToExt: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'image/heic': 'heic',
      'image/heif': 'heif',
    };
    extension = mimeToExt[params.mimeType] ?? 'jpg';
  } else if (params.localUri.includes('.')) {
    // Extract extension from localUri as fallback
    const uriParts = params.localUri.split('.');
    if (uriParts.length > 1) {
      extension = uriParts[uriParts.length - 1].toLowerCase();
      // Remove query parameters if present
      extension = extension.split('?')[0];
    }
  }

  // Construct deterministic filename
  return `${params.plantId}_${taskToken}_${uriHash}.${extension}`;
}

export async function enqueueImage(params: {
  localUri: string;
  plantId: string;
  taskId?: string;
  filename?: string;
  mimeType?: string;
}): Promise<string> {
  // Generate deterministic filename if not provided
  const finalFilename =
    params.filename ??
    generateDeterministicFilename({
      localUri: params.localUri,
      plantId: params.plantId,
      taskId: params.taskId,
      mimeType: params.mimeType,
    });

  const coll = database.collections.get('image_upload_queue' as any);
  await database.write(async () =>
    (coll as any).create((rec: any) => {
      rec.localUri = params.localUri;
      rec.remotePath = null;
      rec.taskId = params.taskId ?? null;
      rec.plantId = params.plantId;
      rec.filename = finalFilename;
      rec.mimeType = params.mimeType ?? 'image/jpeg';
      rec.status = 'pending';
      rec.lastError = null;
      rec.createdAt = Date.now();
      rec.updatedAt = Date.now();
    })
  );
  return finalFilename;
}
// Fetch a batch of pending upload queue items that are due for processing
// This function retrieves items with status 'pending' and either no next_attempt_at
// or next_attempt_at <= current time, limited to the specified batch size
//
// TODO: Optimize by filtering at database level instead of fetching all rows
// Suggested improvement: Use WatermelonDB Q.where() queries to filter status='pending'
// and apply time-based conditions directly in the query before fetching
async function fetchDueBatch(limit = 5): Promise<QueueItemRaw[]> {
  const coll = database.collections.get('image_upload_queue' as any);
  // NOTE: Currently fetches all rows and filters in JS - inefficient for large queues
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
      rec.updatedAt = Date.now();
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
      rec.updatedAt = Date.now();
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
      rec.updatedAt = Date.now();
    })
  );
}

async function markFailed(id: string, reason: string): Promise<void> {
  const coll = database.collections.get('image_upload_queue' as any);
  const row = await (coll as any).find(id);
  await database.write(async () =>
    row.update((rec: any) => {
      rec.status = 'failed';
      rec.lastError = reason;
      rec.updatedAt = Date.now();
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
      // Check for missing or falsy plant_id before attempting upload
      if (!item.plant_id) {
        await markFailed(item.id, 'Missing or invalid plant_id');
        continue;
      }

      await markUploading(item.id);
      const { bucket, path } = await uploadImageWithProgress({
        plantId: item.plant_id,
        filename:
          item.filename ??
          generateDeterministicFilename({
            localUri: item.local_uri,
            plantId: item.plant_id,
            taskId: item.task_id ?? undefined,
            mimeType: item.mime_type ?? undefined,
          }),
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
        rec.updatedAt = Date.now();
      })
    );
  } catch {
    // swallow if local task missing
  }
  // Note: Removed direct remote write to avoid clobbering existing metadata.
  // The local metadata update above will be persisted via the existing sync/flush mechanism.
  // If direct remote update is absolutely required in the future, implement a server-side
  // JSONB merge operation (e.g., SQL UPDATE with jsonb_set or an RPC function) instead
  // of replacing the entire metadata object.
}
