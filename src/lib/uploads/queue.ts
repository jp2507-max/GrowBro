import { Q } from '@nozbe/watermelondb';

import { computeBackoffMs } from '@/lib/sync/backoff';
import { canSyncLargeFiles } from '@/lib/sync/network-manager';
import type { PhotoVariant } from '@/lib/uploads/harvest-photo-upload';
import { uploadImageWithProgress } from '@/lib/uploads/image-upload';
import { database } from '@/lib/watermelon';
import type { HarvestModel } from '@/lib/watermelon-models/harvest';
import type { ImageUploadQueueModel } from '@/lib/watermelon-models/image-upload-queue';
import type { TaskModel } from '@/lib/watermelon-models/task';
import type { TaskMetadata } from '@/types';

type QueueItemRaw = {
  id: string;
  localUri: string;
  remotePath?: string | null;
  taskId?: string | null;
  plantId?: string | null;
  harvestId?: string | null;
  variant?: PhotoVariant | null;
  hash?: string | null;
  extension?: string | null;
  filename?: string | null;
  mimeType?: string | null;
  status: 'pending' | 'uploading' | 'completed' | 'failed';
  retryCount?: number | null;
  lastError?: string | null;
  nextAttemptAt?: number | null; // epoch ms
  createdAt: number;
  updatedAt: number;
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

  const coll =
    database.collections.get<ImageUploadQueueModel>('image_upload_queue');
  await database.write(async () =>
    coll.create((rec) => {
      rec.localUri = params.localUri;
      rec.remotePath = undefined;
      rec.taskId = params.taskId ?? undefined;
      rec.plantId = params.plantId;
      rec.harvestId = undefined;
      rec.variant = undefined;
      rec.hash = undefined;
      rec.extension = undefined;
      rec.filename = finalFilename;
      rec.mimeType = params.mimeType ?? 'image/jpeg';
      rec.status = 'pending';
      rec.lastError = undefined;
      rec.createdAt = new Date();
      rec.updatedAt = new Date();
    })
  );
  return finalFilename;
}

/**
 * Enqueue harvest photo variant for upload
 *
 * @param params - Queue parameters
 * @returns Queue item ID
 */
export async function enqueueHarvestPhotoVariant(params: {
  localUri: string;
  userId: string;
  harvestId: string;
  variant: PhotoVariant;
  hash: string;
  extension: string;
  mimeType: string;
}): Promise<string> {
  const coll =
    database.collections.get<ImageUploadQueueModel>('image_upload_queue');
  let queueId = '';

  await database.write(async () => {
    const rec = await coll.create((r) => {
      r.localUri = params.localUri;
      r.remotePath = undefined;
      r.taskId = undefined;
      r.plantId = undefined;
      r.harvestId = params.harvestId;
      r.variant = params.variant;
      r.hash = params.hash;
      r.extension = params.extension;
      r.filename = `${params.hash}_${params.variant}.${params.extension}`;
      r.mimeType = params.mimeType;
      r.status = 'pending';
      r.lastError = undefined;
      r.createdAt = new Date();
      r.updatedAt = new Date();
    });
    queueId = rec.id;
  });

  return queueId;
}

/**
 * Update harvest record with remote photo path
 *
 * @param harvestId - Harvest ID
 * @param variant - Photo variant
 * @param remotePath - Remote storage path
 */
async function updateHarvestWithRemotePath(
  harvestId: string,
  variant: PhotoVariant,
  remotePath: string
): Promise<void> {
  try {
    const coll = database.collections.get<HarvestModel>('harvests');
    const harvest = await coll.find(harvestId);

    await database.write(async () =>
      harvest.update((rec) => {
        // photos is stored as JSON array
        const photos = rec.photos ?? [];

        // Find and update the matching variant
        const updated = photos.map((photo) =>
          photo.variant === variant ? { ...photo, remotePath } : photo
        );

        rec.photos = updated;
        rec.updatedAt = new Date();
      })
    );
  } catch (error) {
    console.warn(
      `Failed to update harvest ${harvestId} with remote path:`,
      error
    );
    // Don't throw - the photo is already uploaded, just the metadata update failed
  }
}

// Fetch a batch of pending upload queue items that are due for processing
// This function retrieves items with status 'pending' and either no next_attempt_at
// or next_attempt_at <= current time, limited to the specified batch size
//
// TODO: Optimize by filtering at database level instead of fetching all rows
// Suggested improvement: Use WatermelonDB Q.where() queries to filter status='pending'
// and apply time-based conditions directly in the query before fetching
async function fetchDueBatch(limit = 5): Promise<QueueItemRaw[]> {
  const coll =
    database.collections.get<ImageUploadQueueModel>('image_upload_queue');
  const rows = await coll
    .query(
      Q.where('status', 'pending'),
      Q.sortBy('next_attempt_at', 'asc'),
      Q.take(limit)
    )
    .fetch();
  const now = Date.now();
  const due: QueueItemRaw[] = rows
    .filter((row) => !row.nextAttemptAt || row.nextAttemptAt <= now)
    .map((row) => ({
      id: row.id,
      localUri: row.localUri,
      remotePath: row.remotePath ?? null,
      taskId: row.taskId ?? null,
      plantId: row.plantId ?? null,
      harvestId: row.harvestId ?? null,
      variant: row.variant as PhotoVariant | null,
      hash: row.hash ?? null,
      extension: row.extension ?? null,
      filename: row.filename ?? null,
      mimeType: row.mimeType ?? null,
      status: row.status,
      retryCount: row.retryCount ?? null,
      lastError: row.lastError ?? null,
      nextAttemptAt: row.nextAttemptAt ?? null,
      createdAt: row.createdAt.getTime(),
      updatedAt: row.updatedAt.getTime(),
    }));
  return due;
}

async function markUploading(id: string): Promise<void> {
  const coll =
    database.collections.get<ImageUploadQueueModel>('image_upload_queue');
  const row = await coll.find(id);
  await database.write(async () =>
    row.update((rec) => {
      rec.status = 'uploading';
      rec.updatedAt = new Date();
    })
  );
}

async function markCompleted(id: string, remotePath: string): Promise<void> {
  const coll =
    database.collections.get<ImageUploadQueueModel>('image_upload_queue');
  const row = await coll.find(id);
  await database.write(async () =>
    row.update((rec) => {
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
  const coll =
    database.collections.get<ImageUploadQueueModel>('image_upload_queue');
  const row = await coll.find(id);
  const nextDelay = computeBackoffMs(attempt, 1000, 15 * 60 * 1000);
  const nextAt = Date.now() + nextDelay;
  await database.write(async () =>
    row.update((rec) => {
      rec.status = 'pending';
      rec.retryCount = attempt;
      rec.lastError = err instanceof Error ? err.message : String(err);
      rec.nextAttemptAt = nextAt;
      rec.updatedAt = new Date();
    })
  );
}

async function markFailed(id: string, reason: string): Promise<void> {
  const coll =
    database.collections.get<ImageUploadQueueModel>('image_upload_queue');
  const row = await coll.find(id);
  await database.write(async () =>
    row.update((rec) => {
      rec.status = 'failed';
      rec.lastError = reason;
      rec.updatedAt = new Date();
    })
  );
}

/**
 * Process harvest photo upload
 */
async function processHarvestPhotoUpload(item: QueueItemRaw): Promise<boolean> {
  const { uploadHarvestPhoto } = await import('./harvest-photo-upload');

  if (!item.harvestId || !item.variant || !item.hash || !item.extension) {
    await markFailed(item.id, 'Missing harvest photo metadata');
    return false;
  }

  // Get user ID from auth (required for harvest photos)
  const { supabase } = await import('@/lib/supabase');
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    await markFailed(item.id, 'User not authenticated');
    return false;
  }

  await markUploading(item.id);

  const result = await uploadHarvestPhoto({
    userId: user.id,
    harvestId: item.harvestId,
    localUri: item.localUri,
    variant: item.variant as PhotoVariant,
    hash: item.hash,
    extension: item.extension,
    mimeType: item.mimeType ?? 'image/jpeg',
  });

  // Update harvest record with remote path
  await updateHarvestWithRemotePath(
    item.harvestId,
    item.variant as PhotoVariant,
    result.path
  );

  await markCompleted(item.id, result.path);
  return true;
}

/**
 * Process plant image upload
 */
async function processPlantImageUpload(item: QueueItemRaw): Promise<boolean> {
  // Check for missing or falsy plant_id before attempting upload
  if (!item.plantId) {
    await markFailed(item.id, 'Missing or invalid plant_id');
    return false;
  }

  await markUploading(item.id);
  const { bucket, path } = await uploadImageWithProgress({
    plantId: item.plantId,
    filename:
      item.filename ??
      generateDeterministicFilename({
        localUri: item.localUri,
        plantId: item.plantId,
        taskId: item.taskId ?? undefined,
        mimeType: item.mimeType ?? undefined,
      }),
    localUri: item.localUri,
    mimeType: item.mimeType ?? 'image/jpeg',
    onProgress: () => {},
  });

  // Backfill to task metadata if task present
  if (item.taskId) {
    await backfillTaskRemotePath(item.taskId, `${bucket}/${path}`);
  }

  await markCompleted(item.id, path);
  return true;
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
      // Check if this is a harvest photo or plant image
      const isHarvestPhoto = Boolean(item.harvestId);

      const success = isHarvestPhoto
        ? await processHarvestPhotoUpload(item)
        : await processPlantImageUpload(item);

      if (success) processed++;
    } catch (err) {
      const attempt = (item.retryCount ?? 0) + 1;
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
    const coll = database.collections.get<TaskModel>('tasks');
    const row = await coll.find(taskId);
    await database.write(async () =>
      row.update((rec) => {
        const meta = (rec.metadata ?? {}) as TaskMetadata;
        rec.metadata = { ...meta, imagePath: remotePath };
        rec.updatedAt = new Date();
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
