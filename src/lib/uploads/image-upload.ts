import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';

import { supabase } from '@/lib/supabase';
import { canSyncLargeFiles } from '@/lib/sync/network-manager';

type ManipulateParams = {
  localUri: string;
  maxEdge?: number; // pixels
  quality?: number; // 0..1
};

export type ManipulatedImage = {
  uri: string;
  mimeType: string;
  width?: number;
  height?: number;
};

export type UploadProgress = {
  totalBytesSent: number;
  totalBytesExpectedToSend: number;
};

export type UploadResult = {
  path: string;
  bucket: string;
};

const BUCKET_NAME = 'plant-images';

export function makeObjectPath(params: {
  userId: string;
  plantId: string;
  filename: string;
}): string {
  const sanitize = (s: string) => s.replace(/^[\/]+|[\/]+$/g, '');
  const user = sanitize(params.userId);
  const plant = sanitize(params.plantId);
  const file = sanitize(params.filename);
  return `${user}/${plant}/${file}`;
}

export async function manipulateImage({
  localUri,
  maxEdge = 2048,
  quality = 0.8,
}: ManipulateParams): Promise<ManipulatedImage> {
  // Get original image dimensions by manipulating with empty actions
  const originalInfo = await ImageManipulator.manipulateAsync(localUri, [], {
    compress: 1.0, // No compression for info retrieval
    format: ImageManipulator.SaveFormat.JPEG,
  });

  // Calculate scale factor to ensure longest edge <= maxEdge, prevent upscaling
  const maxOriginalDimension = Math.max(
    originalInfo.width,
    originalInfo.height
  );
  const scaleFactor = Math.min(1, maxEdge / maxOriginalDimension);

  // Only resize if scaling down is needed
  const actions: ImageManipulator.Action[] = [];
  if (scaleFactor < 1) {
    // Use width-based resize to let library maintain aspect ratio
    actions.push({
      resize: { width: Math.round(originalInfo.width * scaleFactor) },
    });
  }

  const result = await ImageManipulator.manipulateAsync(localUri, actions, {
    compress: quality,
    format: ImageManipulator.SaveFormat.JPEG,
  });

  return {
    uri: result.uri,
    mimeType: 'image/jpeg',
    width: result.width,
    height: result.height,
  };
}

async function getCurrentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user?.id) throw new Error('auth required');
  return data.user.id;
}

async function toBlob(localUri: string): Promise<Blob> {
  // RN/Expo supports fetch(file://...) with url polyfill in this repo
  const res = await fetch(localUri);
  const blob = await res.blob();
  return blob;
}

export async function uploadImageSimple(params: {
  plantId: string;
  filename: string;
  localUri: string;
  mimeType?: string; // default image/jpeg
  upsert?: boolean;
}): Promise<UploadResult> {
  const userId = await getCurrentUserId();
  const path = makeObjectPath({
    userId,
    plantId: params.plantId,
    filename: params.filename,
  });
  const blob = await toBlob(params.localUri);
  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(path, blob, {
      upsert: Boolean(params.upsert),
      contentType: params.mimeType ?? 'image/jpeg',
    });
  if (error) throw error;
  return { bucket: BUCKET_NAME, path };
}

export async function uploadImageWithProgress(params: {
  plantId: string;
  filename: string;
  localUri: string;
  mimeType?: string; // default image/jpeg
  upsert?: boolean;
  onProgress?: (p: UploadProgress) => void;
}): Promise<UploadResult> {
  const allowed = await canSyncLargeFiles();
  if (!allowed) throw new Error('network_constraints');

  const userId = await getCurrentUserId();
  const path = makeObjectPath({
    userId,
    plantId: params.plantId,
    filename: params.filename,
  });

  // Use Supabase signed upload URL; then stream local file with Expo FileSystem for progress
  const { data: signed, error: sigErr } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUploadUrl(path);
  if (sigErr || !signed) throw sigErr ?? new Error('signed_url_failed');

  // Note: uploadToSignedUrl lacks progress; we stream directly to signed.signedUrl
  // Headers must include Content-Type. Add x-upsert header when upsert is requested.
  const headers: Record<string, string> = {
    'Content-Type': params.mimeType ?? 'image/jpeg',
  };
  if (params.upsert) {
    headers['x-upsert'] = 'true';
  }
  const uploadTask = FileSystem.createUploadTask(
    signed.signedUrl,
    params.localUri,
    {
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      headers,
    },
    (progress) => {
      params.onProgress?.({
        totalBytesSent: progress.totalBytesSent,
        totalBytesExpectedToSend: progress.totalBytesExpectedToSend,
      });
    }
  );

  const result = await uploadTask.uploadAsync();
  const okStatus = result?.status ?? 0;
  if (okStatus !== 200 && okStatus !== 204) {
    throw new Error(`upload_failed:${okStatus}`);
  }
  return { bucket: BUCKET_NAME, path };
}

export async function createSignedViewUrl(params: {
  path: string;
  expiresInSeconds?: number;
}): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(params.path, params.expiresInSeconds ?? 900);
  if (error || !data?.signedUrl) throw error ?? new Error('signed_view_failed');
  return data.signedUrl;
}
