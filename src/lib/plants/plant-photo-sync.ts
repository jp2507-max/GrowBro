/**
 * Plant photo sync hook
 *
 * Automatically downloads and caches plant photos from Supabase Storage
 * when a plant has a remote image path but the local file is missing.
 * This enables cross-device photo sync.
 */

import * as React from 'react';

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

type PlantPhotoSyncResult = {
  /** Whether a download is in progress */
  isDownloading: boolean;
  /** Error message if download failed */
  error: string | null;
  /** Resolved local URI (either existing or newly downloaded) */
  resolvedLocalUri: string | undefined;
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

  // Generate signed URL
  const { data: signedData, error: signedError } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, SIGNED_URL_EXPIRY_SECONDS);

  if (signedError || !signedData?.signedUrl) {
    throw new Error(
      `Failed to get signed URL: ${signedError?.message ?? 'Unknown error'}`
    );
  }

  // Download and cache locally
  const newLocalUri = await downloadAndCachePlantPhoto(
    signedData.signedUrl,
    plantId
  );

  // Update plant record with new local URI
  await updatePlantLocalImageUrl(plantId, newLocalUri);

  return newLocalUri;
}

/**
 * Update plant's imageUrl with newly downloaded local file URI.
 */
async function updatePlantLocalImageUrl(
  plantId: string,
  localUri: string
): Promise<void> {
  try {
    const coll = database.collections.get<PlantModel>('plants');
    const plant = await coll.find(plantId);

    await database.write(async () =>
      plant.update((rec) => {
        rec.imageUrl = localUri;
        // Don't update updatedAt to avoid triggering unnecessary syncs
      })
    );
  } catch (error) {
    console.warn(
      `[PlantPhotoSync] Failed to update plant ${plantId} with local URI:`,
      error
    );
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
  const [isDownloading, setIsDownloading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [resolvedLocalUri, setResolvedLocalUri] = React.useState<
    string | undefined
  >(plant?.imageUrl);

  const plantId = plant?.id;
  const imageUrl = plant?.imageUrl;
  const remoteImagePath =
    (plant?.metadata as { remoteImagePath?: string } | undefined)
      ?.remoteImagePath ?? undefined;

  React.useEffect(() => {
    if (!plantId || !remoteImagePath) {
      // No remote path, use existing imageUrl
      setResolvedLocalUri(imageUrl);
      return;
    }

    // Capture for async closure
    const capturedPlantId = plantId;
    const capturedRemoteImagePath = remoteImagePath;

    let cancelled = false;

    async function checkAndDownload() {
      // First check if current imageUrl exists locally
      const hasLocal = await plantPhotoExists(imageUrl ?? '');
      if (hasLocal) {
        if (!cancelled) {
          setResolvedLocalUri(imageUrl);
        }
        return;
      }

      // Need to download from remote
      if (!cancelled) {
        setIsDownloading(true);
        setError(null);
      }

      try {
        const newUri = await syncPlantPhotoIfNeeded(
          capturedPlantId,
          imageUrl,
          capturedRemoteImagePath
        );

        if (!cancelled) {
          setResolvedLocalUri(newUri ?? imageUrl);
        }
      } catch (err) {
        console.error('[usePlantPhotoSync] Download failed:', err);
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Download failed');
          // Still show remote URL placeholder or nothing
          setResolvedLocalUri(undefined);
        }
      } finally {
        if (!cancelled) {
          setIsDownloading(false);
        }
      }
    }

    checkAndDownload();

    return () => {
      cancelled = true;
    };
  }, [plantId, imageUrl, remoteImagePath]);

  return { isDownloading, error, resolvedLocalUri };
}

/**
 * Batch sync all plants with remote images that are missing locally.
 * Use this on app startup or sync completion.
 *
 * @param plants - Array of plants to check
 * @returns Number of photos downloaded
 */
export async function syncMissingPlantPhotos(
  plants: Plant[]
): Promise<{ downloaded: number; failed: number }> {
  let downloaded = 0;
  let failed = 0;

  for (const plant of plants) {
    const remoteImagePath =
      (plant.metadata as { remoteImagePath?: string } | undefined)
        ?.remoteImagePath ?? undefined;

    if (!remoteImagePath) {
      continue;
    }

    try {
      const result = await syncPlantPhotoIfNeeded(
        plant.id,
        plant.imageUrl,
        remoteImagePath
      );

      if (result) {
        downloaded++;
      }
    } catch (error) {
      console.warn(
        `[PlantPhotoSync] Failed to sync photo for plant ${plant.id}:`,
        error
      );
      failed++;
    }
  }

  return { downloaded, failed };
}
