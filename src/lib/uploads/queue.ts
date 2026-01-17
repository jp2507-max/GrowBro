import { type Model, Q } from '@nozbe/watermelondb';

import { computeBackoffMs } from '@/lib/sync/backoff';
import { canSyncLargeFiles } from '@/lib/sync/network-manager';
import type { PhotoVariant } from '@/lib/uploads/harvest-photo-upload';
import { uploadImageWithProgress } from '@/lib/uploads/image-upload';
import { database } from '@/lib/watermelon';
import type { HarvestModel } from '@/lib/watermelon-models/harvest';
import type { ImageUploadQueueModel } from '@/lib/watermelon-models/image-upload-queue';
import type { TaskModel } from '@/lib/watermelon-models/task';
import type { TaskMetadata } from '@/types';

/** Maximum retry attempts before marking as permanently failed */
const MAX_UPLOAD_RETRIES = 10;

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

/** Timeout in ms after which 'uploading' status is considered stale and reset to 'pending' */
const STALE_UPLOADING_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Reset stale 'uploading' items back to 'pending'.
 * This recovers from app crashes or JS process deaths during upload.
 */
async function resetStaleUploadingItems(): Promise<number> {
  const coll =
    database.collections.get<ImageUploadQueueModel>('image_upload_queue');
  const now = Date.now();
  const staleThreshold = now - STALE_UPLOADING_TIMEOUT_MS;

  const staleRows = await coll.query(Q.where('status', 'uploading')).fetch();

  const toReset = staleRows.filter(
    (row) => row.updatedAt.getTime() < staleThreshold
  );

  if (toReset.length === 0) return 0;

  await database.write(async () => {
    for (const row of toReset) {
      await row.update((rec) => {
        rec.status = 'pending';
        rec.lastError = 'Reset from stale uploading state';
        rec.updatedAt = new Date();
      });
    }
  });

  console.log(`[Queue] Reset ${toReset.length} stale uploading items`);
  return toReset.length;
}

// Fetch a batch of pending upload queue items that are due for processing
// Filters at DB level to avoid starvation issues
async function fetchDueBatch(limit = 5): Promise<QueueItemRaw[]> {
  const coll =
    database.collections.get<ImageUploadQueueModel>('image_upload_queue');
  const now = Date.now();

  // Query items that are pending AND (no next_attempt_at OR next_attempt_at <= now)
  const rows = await coll
    .query(
      Q.where('status', 'pending'),
      Q.or(
        Q.where('next_attempt_at', null),
        Q.where('next_attempt_at', Q.lte(now))
      ),
      Q.sortBy('next_attempt_at', 'asc'),
      Q.take(limit)
    )
    .fetch();

  const due: QueueItemRaw[] = rows.map((row) => ({
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

/**
 * Check if an error indicates the file already exists in storage.
 * This is treated as success for content-addressed uploads.
 */
function isAlreadyExistsError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return (
      msg.includes('already exists') ||
      msg.includes('duplicate') ||
      msg.includes('the resource already exists')
    );
  }
  return false;
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
  // Check if max retries exceeded
  if (attempt >= MAX_UPLOAD_RETRIES) {
    const reason = `Max retries (${MAX_UPLOAD_RETRIES}) exceeded: ${
      err instanceof Error ? err.message : String(err)
    }`;
    console.warn(`[Queue] ${reason}`);
    await markFailed(id, reason);
    return;
  }

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
    // Treat as retryable - user may log in later
    const attempt = (item.retryCount ?? 0) + 1;
    await markFailure(item.id, attempt, new Error('User not authenticated'));
    return false;
  }

  await markUploading(item.id);

  let result;
  try {
    result = await uploadHarvestPhoto({
      userId: user.id,
      harvestId: item.harvestId,
      localUri: item.localUri,
      variant: item.variant as PhotoVariant,
      hash: item.hash,
      extension: item.extension,
      mimeType: item.mimeType ?? 'image/jpeg',
    });
  } catch (uploadError) {
    // If file already exists, treat as success (content-addressed = same content)
    if (isAlreadyExistsError(uploadError)) {
      console.log(
        `[Queue] Harvest photo already exists, treating as success: ${item.hash}`
      );
      // Construct expected path for metadata update
      const expectedPath = `${item.harvestId}/${item.hash}_${item.variant}.${item.extension}`;
      await updateHarvestWithRemotePath(
        item.harvestId,
        item.variant as PhotoVariant,
        expectedPath
      );
      await markCompleted(item.id, expectedPath);
      return true;
    }
    throw uploadError;
  }

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

  // Get user ID from auth (required for RLS-safe upload path)
  const { supabase } = await import('@/lib/supabase');
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Treat as retryable - user may log in later
    const attempt = (item.retryCount ?? 0) + 1;
    await markFailure(item.id, attempt, new Error('User not authenticated'));
    return false;
  }

  await markUploading(item.id);

  // Filename is required for content-addressed uploads
  if (!item.filename) {
    await markFailed(
      item.id,
      'Missing filename - use enqueuePlantProfilePhoto'
    );
    return false;
  }

  let bucket: string;
  let path: string;
  try {
    const uploadResult = await uploadImageWithProgress({
      userId: user.id,
      plantId: item.plantId,
      filename: item.filename,
      localUri: item.localUri,
      mimeType: item.mimeType ?? 'image/jpeg',
      onProgress: () => {},
    });
    bucket = uploadResult.bucket;
    path = uploadResult.path;
  } catch (uploadError) {
    // If file already exists, treat as success (content-addressed = same content)
    if (isAlreadyExistsError(uploadError)) {
      console.log(
        `[Queue] Plant photo already exists, treating as success: ${item.hash}`
      );
      // Construct expected path for metadata update
      bucket = 'plant-images';
      path = `${user.id}/${item.plantId}/${item.filename}`;
    } else {
      throw uploadError;
    }
  }

  // Update plant metadata with remote path (pass hash to guard against stale overwrites)
  await updatePlantWithRemotePath(
    item.plantId,
    `${bucket}/${path}`,
    item.hash ?? undefined
  );

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

  // First, recover any stale 'uploading' items from previous crashes
  await resetStaleUploadingItems();

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

/**
 * Update plant metadata with remote image path after successful upload.
 * Guards against stale overwrites by verifying the current imageUrl hash matches.
 *
 * @param plantId - Plant ID
 * @param remotePath - Remote storage path (e.g., 'plant-images/userId/plantId/hash.jpg')
 * @param expectedHash - Hash of the uploaded file (to verify we're not overwriting newer photo)
 */
async function updatePlantWithRemotePath(
  plantId: string,
  remotePath: string,
  expectedHash?: string
): Promise<void> {
  try {
    // Use inline type for plant record since we only need a few fields
    type PlantRecord = Model & {
      imageUrl?: string | null;
      metadata?: Record<string, unknown> | null;
      updatedAt: Date;
      remoteImagePath?: string | null;
    };
    const coll = database.collections.get<PlantRecord>('plants');
    const row = await coll.find(plantId);

    // Guard against stale overwrites: verify the current imageUrl contains the expected hash
    if (expectedHash && row.imageUrl) {
      const currentFilename = row.imageUrl.split('/').pop() ?? '';
      const currentHash = currentFilename.split('.')[0];
      if (currentHash && currentHash !== expectedHash) {
        console.log(
          `[Queue] Skipping stale upload for plant ${plantId}: ` +
            `expected hash ${expectedHash}, current is ${currentHash}`
        );
        return; // Don't overwrite - user has already set a newer photo
      }
    }

    await database.write(async () =>
      row.update((rec) => {
        const meta = (rec.metadata ?? {}) as Record<string, unknown>;
        rec.metadata = { ...meta, remoteImagePath: remotePath };
        // Also set the dedicated remote_image_path column
        rec.remoteImagePath = remotePath;
        rec.updatedAt = new Date();
      })
    );

    // Trigger plant sync to push the remote path to Supabase
    try {
      const { syncPlantsToCloud } = await import('@/lib/plants/plants-sync');
      void syncPlantsToCloud().catch((err) => {
        console.warn('[Queue] Plant sync after upload failed:', err);
      });
    } catch (syncImportError) {
      console.warn('[Queue] Failed to import plants-sync:', syncImportError);
    }
  } catch (error) {
    console.warn(
      `[Queue] Failed to update plant ${plantId} with remote path:`,
      error
    );
    // Don't throw - the photo is already uploaded, just the metadata update failed
  }
}

/**
 * Enqueue plant profile photo for background upload.
 *
 * @param params - Queue parameters
 * @returns Queue item ID
 */
export async function enqueuePlantProfilePhoto(params: {
  localUri: string;
  plantId: string;
  hash: string;
  extension: string;
}): Promise<string> {
  const { localUri, plantId, hash, extension } = params;
  const filename = `${hash}.${extension}`;
  const mimeType = extension === 'png' ? 'image/png' : 'image/jpeg';

  const coll =
    database.collections.get<ImageUploadQueueModel>('image_upload_queue');

  // Dedupe check: don't enqueue if identical pending/uploading entry exists
  const existing = await coll
    .query(
      Q.where('plant_id', plantId),
      Q.where('hash', hash),
      Q.where('status', Q.oneOf(['pending', 'uploading']))
    )
    .fetch();

  if (existing.length > 0) {
    console.log(
      `[Queue] Skipping duplicate enqueue: plantId=${plantId}, hash=${hash}`
    );
    return existing[0].id;
  }

  let queueId = '';

  await database.write(async () => {
    const rec = await coll.create((r) => {
      r.localUri = localUri;
      r.remotePath = undefined;
      r.taskId = undefined;
      r.plantId = plantId;
      r.harvestId = undefined;
      r.variant = undefined;
      r.hash = hash;
      r.extension = extension;
      r.filename = filename;
      r.mimeType = mimeType;
      r.status = 'pending';
      r.lastError = undefined;
      r.createdAt = new Date();
      r.updatedAt = new Date();
    });
    queueId = rec.id;
  });

  console.log(
    `[Queue] Enqueued plant profile photo: plantId=${plantId}, hash=${hash}`
  );

  // Opportunistic: try to process immediately if network conditions allow
  // This is non-blocking - if it fails or conditions don't allow, the queue will be
  // processed later by background sync or connectivity restore handlers
  void processImageQueueOnce(1).catch((err) => {
    console.log('[Queue] Opportunistic upload skipped:', err?.message ?? err);
  });

  return queueId;
}

/**
 * Clean up completed queue items older than specified duration.
 * Should be called periodically to prevent database bloat.
 *
 * @param olderThanMs - Delete completed items older than this (default: 24 hours)
 * @returns Number of items deleted
 */
export async function cleanupCompletedQueueItems(
  olderThanMs = 24 * 60 * 60 * 1000
): Promise<number> {
  const coll =
    database.collections.get<ImageUploadQueueModel>('image_upload_queue');
  const threshold = Date.now() - olderThanMs;

  const completed = await coll
    .query(
      Q.where('status', 'completed'),
      Q.where('updated_at', Q.lt(threshold))
    )
    .fetch();

  if (completed.length === 0) return 0;

  await database.write(async () => {
    for (const row of completed) {
      await row.destroyPermanently();
    }
  });

  console.log(`[Queue] Cleaned up ${completed.length} completed queue items`);
  return completed.length;
}

/**
 * Cancel pending queue entries for a specific plant.
 * Call this when a plant is deleted to prevent orphaned uploads.
 *
 * @param plantId - Plant ID
 * @returns Number of entries cancelled
 */
export async function cancelQueueEntriesForPlant(
  plantId: string
): Promise<number> {
  const coll =
    database.collections.get<ImageUploadQueueModel>('image_upload_queue');

  const pending = await coll
    .query(
      Q.where('plant_id', plantId),
      Q.where('status', Q.oneOf(['pending', 'uploading']))
    )
    .fetch();

  if (pending.length === 0) return 0;

  await database.write(async () => {
    for (const row of pending) {
      await row.update((rec) => {
        rec.status = 'failed';
        rec.lastError = 'Plant deleted';
        rec.updatedAt = new Date();
      });
    }
  });

  console.log(
    `[Queue] Cancelled ${pending.length} queue entries for deleted plant ${plantId}`
  );
  return pending.length;
}
