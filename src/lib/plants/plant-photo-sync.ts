/**
 * Plant photo sync hook
 *
 * Automatically downloads and caches plant photos from Supabase Storage
 * when a plant has a remote image path but the local file is missing.
 * This enables cross-device photo sync.
 */

import { useQuery } from '@tanstack/react-query';

import type { Plant } from '@/api/plants/types';
import {
  downloadAndCachePlantPhoto,
  plantPhotoExists,
} from '@/lib/media/plant-photo-storage';
import { supabase } from '@/lib/supabase';
import { database } from '@/lib/watermelon';
import type { PlantModel } from '@/lib/watermelon-models/plant';

/** Signed URL expiry time in seconds (1 hour) */
const SIGNED_URL_EXPIRY_SECONDS = 3600;

/** Network operation timeout in milliseconds (30 seconds) */
const NETWORK_TIMEOUT_MS = 30000;

/** Default concurrency for batch photo sync */
const DEFAULT_SYNC_CONCURRENCY = 3;

/** Typed metadata shape for plant photo sync fields */
type PlantMetadata = {
  remoteImagePath?: string;
};

/**
 * Wrap a promise with a timeout.
 * @param promise - Promise to wrap
 * @param ms - Timeout in milliseconds
 * @returns Promise that rejects if timeout exceeded
 */
async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`Operation timed out after ${ms}ms`)), ms)
  );
  return Promise.race([promise, timeout]);
}

/**
 * Extract remoteImagePath from plant, preferring the dedicated column.
 * @param plant - Plant object or null
 * @returns Remote image path or undefined
 */
function getRemoteImagePath(plant: Plant | null): string | undefined {
  if (!plant) {
    return undefined;
  }
  // Prefer the dedicated remote_image_path column if present (even if null/empty)
  if (Object.prototype.hasOwnProperty.call(plant, 'remoteImagePath')) {
    return plant.remoteImagePath || undefined;
  }
  // Fall back to metadata for backward compatibility
  const metadata = plant.metadata as PlantMetadata | undefined;
  return metadata?.remoteImagePath;
}

type PlantPhotoSyncResult = {
  /** Whether a download is in progress */
  isDownloading: boolean;
  /** Error message if download failed */
  error: string | null;
  /** Resolved local URI (either existing or newly downloaded) */
  resolvedLocalUri: string | undefined;
  /** Thumbnail URL for faster initial rendering */
  thumbnailUrl: string | undefined;
};

/**
 * Extract bucket and path from a remote image path.
 * Format: "bucket/path/to/file.jpg" or just "path/to/file.jpg" (assumes plant-images bucket)
 */
function parseRemotePath(remotePath: string): { bucket: string; path: string } {
  // Check if path starts with a known bucket name
  if (remotePath.startsWith('plant-images/')) {
    return {
      bucket: 'plant-images',
      path: remotePath.slice('plant-images/'.length),
    };
  }

  // Default to plant-images bucket
  return {
    bucket: 'plant-images',
    path: remotePath,
  };
}

/**
 * Sync a single plant's photo from remote storage if needed.
 *
 * @param plantId - Plant ID
 * @param localImageUrl - Current local image URL (may be missing file)
 * @param remoteImagePath - Remote storage path from plant metadata
 * @returns New local URI if downloaded, undefined if not needed
 */
export async function syncPlantPhotoIfNeeded(
  plantId: string,
  localImageUrl: string | undefined | null,
  remoteImagePath: string | undefined | null
): Promise<string | undefined> {
  // If no remote path, nothing to sync
  if (!remoteImagePath) {
    return undefined;
  }

  // Check if local file exists
  const hasLocalFile = await plantPhotoExists(localImageUrl ?? '');
  if (hasLocalFile) {
    return undefined; // Already have local file
  }

  // Download from remote
  const { bucket, path } = parseRemotePath(remoteImagePath);

  // Generate signed URL (with timeout)
  const { data: signedData, error: signedError } = await withTimeout(
    supabase.storage
      .from(bucket)
      .createSignedUrl(path, SIGNED_URL_EXPIRY_SECONDS),
    NETWORK_TIMEOUT_MS
  );

  if (signedError || !signedData?.signedUrl) {
    throw new Error(
      `Failed to get signed URL: ${signedError?.message ?? 'Unknown error'}`
    );
  }

  // Download and cache locally (with timeout)
  const newLocalUri = await withTimeout(
    downloadAndCachePlantPhoto(signedData.signedUrl, plantId),
    NETWORK_TIMEOUT_MS
  );

  // Update plant record with new local URI
  const updateSuccess = await updatePlantLocalImageUrl(plantId, newLocalUri);
  if (!updateSuccess) {
    throw new Error(`Failed to update plant ${plantId} with local image URI`);
  }

  return newLocalUri;
}

/**
 * Update plant's imageUrl with newly downloaded local file URI.
 * @returns true if update was successful, false on failure
 */
async function updatePlantLocalImageUrl(
  plantId: string,
  localUri: string
): Promise<boolean> {
  try {
    const coll = database.collections.get<PlantModel>('plants');
    const plant = await coll.find(plantId);

    await database.write(async () =>
      plant.update((rec) => {
        rec.imageUrl = localUri;
        // Don't update updatedAt to avoid triggering unnecessary syncs
      })
    );
    return true;
  } catch (error) {
    console.warn(
      `[PlantPhotoSync] Failed to update plant ${plantId} with local URI:`,
      error
    );
    return false;
  }
}

/**
 * Hook to sync a plant's photo from remote storage if needed.
 *
 * Use this in plant display components to trigger on-demand download.
 *
 * @param plant - Plant object with imageUrl and metadata
 * @returns Sync state and resolved local URI
 */
export function usePlantPhotoSync(plant: Plant | null): PlantPhotoSyncResult {
  const plantId = plant?.id;
  const imageUrl = plant?.imageUrl;
  const thumbnailUrl = plant?.thumbnailUrl;
  const remoteImagePath = getRemoteImagePath(plant);

  const {
    data: resolvedUri,
    isLoading,
    error,
    isError,
  } = useQuery({
    queryKey: ['plantPhotoSync', plantId, imageUrl, remoteImagePath],
    queryFn: async () => {
      if (!plantId || !remoteImagePath) {
        return imageUrl;
      }

      // First check if current imageUrl exists locally
      const hasLocal = await plantPhotoExists(imageUrl ?? '');
      if (hasLocal) {
        return imageUrl;
      }

      // Need to download from remote
      const newUri = await syncPlantPhotoIfNeeded(
        plantId,
        imageUrl,
        remoteImagePath
      );

      return newUri ?? imageUrl;
    },
    enabled: !!plantId && !!remoteImagePath,
    staleTime: Infinity, // Local file once synced is good forever (or until logic changes)
    gcTime: 1000 * 60 * 10, // Keep in cache for 10 minutes
    retry: 1, // Don't retry too aggressively on network errors
  });

  // Determine final URI based on state
  let finalUri: string | undefined;

  if (!plantId || !remoteImagePath) {
    // No sync needed
    finalUri = imageUrl;
  } else if (isLoading) {
    // While requesting, show what we have (could be broken link, but prevents flash)
    finalUri = imageUrl;
  } else if (isError) {
    // If failed, return undefined to show placeholder
    finalUri = undefined;
  } else {
    // Success or exists
    finalUri = resolvedUri;
  }

  return {
    isDownloading: isLoading,
    error: error
      ? error instanceof Error
        ? error.message
        : 'Sync failed'
      : null,
    resolvedLocalUri: finalUri,
    thumbnailUrl,
  };
}

/**
 * Batch sync all plants with remote images that are missing locally.
 * Use this on app startup or sync completion.
 *
 * Processes plants in parallel batches for better performance.
 *
 * @param plants - Array of plants to check
 * @param concurrency - Number of concurrent downloads (default: 3)
 * @returns Number of photos downloaded and failed
 */
export async function syncMissingPlantPhotos(
  plants: Plant[],
  concurrency = DEFAULT_SYNC_CONCURRENCY
): Promise<{ downloaded: number; failed: number }> {
  let downloaded = 0;
  let failed = 0;

  // Filter to plants with remote paths
  const plantsWithRemote = plants.filter(
    (p) => getRemoteImagePath(p) !== undefined
  );

  // Process in batches with concurrency limit
  for (let i = 0; i < plantsWithRemote.length; i += concurrency) {
    const batch = plantsWithRemote.slice(i, i + concurrency);

    const results = await Promise.allSettled(
      batch.map((plant) =>
        syncPlantPhotoIfNeeded(
          plant.id,
          plant.imageUrl,
          getRemoteImagePath(plant)
        )
      )
    );

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        downloaded++;
      } else if (result.status === 'rejected') {
        failed++;
        console.warn('[PlantPhotoSync] Batch sync error:', result.reason);
      }
    }
  }

  return { downloaded, failed };
}
