import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system/legacy';

import { stripExifAndGeolocation } from '@/lib/media/exif';
import { ConsentService } from '@/lib/privacy/consent-service';
import { getDeletionAdapter } from '@/lib/privacy/deletion-adapter';
import { ConsentRequiredError } from '@/lib/privacy/errors';
import { addRetentionRecord } from '@/lib/privacy/retention-worker';
import { supabase } from '@/lib/supabase';

export type AiImageMode = 'inference' | 'training';

export type UploadAiImageParams = {
  userId: string;
  plantId: string;
  localUri: string;
  mimeType?: string;
  taskId?: string;
};

export type UploadAiImageResult = {
  bucket: string;
  path: string;
};

function simpleHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16).slice(0, 8);
}

function chooseExtension(mimeType?: string, fallbackUri?: string): string {
  if (mimeType) {
    const map: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif',
      'image/heic': 'heic',
      'image/heif': 'heif',
    };
    return map[mimeType] ?? 'jpg';
  }
  if (fallbackUri && fallbackUri.includes('.')) {
    const last = fallbackUri.split('?')[0]!.split('.').pop();
    if (last && last.length <= 5) return last.toLowerCase();
  }
  return 'jpg';
}

async function prepareUploadNaming(p: UploadAiImageParams) {
  const stripped = await stripExifAndGeolocation(p.localUri);
  const didStrip = stripped.didStrip;
  const ext = didStrip ? 'jpg' : chooseExtension(p.mimeType, stripped.uri);
  const mime = didStrip ? 'image/jpeg' : (p.mimeType ?? 'image/jpeg');
  const hash = simpleHash(`${stripped.uri}|${p.plantId}|${p.taskId ?? ''}`);
  const token = p.taskId ?? 'notask';
  const filename = `${p.plantId}_${token}_${hash}.${ext}`;
  return { strippedUri: stripped.uri, filename, mime };
}

type DoUploadArgs = {
  bucket: string;
  path: string;
  localUri: string;
  mimeType?: string;
};

async function doUpload({
  bucket,
  path,
  localUri,
  mimeType,
}: DoUploadArgs): Promise<UploadAiImageResult> {
  // Use expo-file-system + base64-arraybuffer for React Native compatibility
  // (Response.arrayBuffer() is not available in bare RN)
  const base64 = await FileSystem.readAsStringAsync(localUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const arrayBuffer = decode(base64);

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, arrayBuffer, {
      contentType: mimeType ?? 'image/jpeg',
      upsert: false,
    });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  return { bucket, path: data.path } as UploadAiImageResult;
}

type ObjectPathParts = {
  prefix: string;
  userId: string;
  plantId: string;
  filename: string;
};

function buildObjectPath({
  prefix,
  userId,
  plantId,
  filename,
}: ObjectPathParts): string {
  const sanitize = (s: string) => s.replace(/^\/+|\/+$/g, '');
  return [prefix, userId, plantId, filename].map(sanitize).join('/');
}

export async function uploadInferenceImage(
  params: UploadAiImageParams
): Promise<UploadAiImageResult> {
  // If user opted out of cloud processing, do not upload to cloud.
  if (!ConsentService.hasConsent('cloudProcessing')) {
    throw new ConsentRequiredError(
      'cloudProcessing consent is required',
      'cloudProcessing'
    );
  }
  const { strippedUri, filename, mime } = await prepareUploadNaming(params);
  const bucket = 'plant-images';
  const path = buildObjectPath({
    prefix: 'inference',
    userId: params.userId,
    plantId: params.plantId,
    filename,
  });
  const result = await doUpload({
    bucket,
    path,
    localUri: strippedUri,
    mimeType: mime,
  });
  await addRetentionRecord({
    id: result.path,
    dataType: 'inference_images',
    createdAt: Date.now(),
  });
  return result;
}

export async function uploadTrainingImage(
  params: UploadAiImageParams
): Promise<UploadAiImageResult> {
  // Training requires both cloud processing (to upload) and explicit aiTraining.
  if (!ConsentService.hasConsent('cloudProcessing')) {
    throw new ConsentRequiredError(
      'cloudProcessing consent is required',
      'cloudProcessing'
    );
  }
  if (!ConsentService.hasConsent('aiTraining')) {
    throw new ConsentRequiredError(
      'aiTraining consent is required',
      'aiTraining'
    );
  }
  const { strippedUri, filename, mime } = await prepareUploadNaming(params);
  const bucket = 'plant-images';
  const consentVersion = ConsentService.getConsentVersion();
  const prefix = `training/consent_v-${consentVersion}`;
  const path = buildObjectPath({
    prefix,
    userId: params.userId,
    plantId: params.plantId,
    filename,
  });
  const result = await doUpload({
    bucket,
    path,
    localUri: strippedUri,
    mimeType: mime,
  });
  await addRetentionRecord({
    id: result.path,
    dataType: 'training_images',
    createdAt: Date.now(),
  });
  return result;
}

let hooksInstalled = false;

export function installAiConsentHooks(): void {
  if (hooksInstalled) return;
  hooksInstalled = true;
  let prev = null as null | { aiTraining: boolean };
  void ConsentService.getConsents().then(
    (c) => (prev = { aiTraining: c.aiTraining })
  );
  ConsentService.onChange((c) => {
    const was = prev?.aiTraining ?? false;
    if (was && !c.aiTraining) {
      // On withdrawal, schedule best-effort purge of training images
      void getDeletionAdapter()
        .purgeTrainingImages()
        .catch(() => {});
    }
    prev = { aiTraining: c.aiTraining };
  });
}

export async function purgeUserTrainingImages(
  countHint?: number
): Promise<number> {
  return getDeletionAdapter().purgeTrainingImages(countHint);
}

export async function uploadAiImage(
  mode: 'diagnosis' | 'training',
  params: UploadAiImageParams
): Promise<UploadAiImageResult> {
  if (mode === 'training') return uploadTrainingImage(params);
  return uploadInferenceImage(params);
}

export type DeletionReceipt = { deleted: number; requestedAt: string };

export async function requestTrainingImagesDeletion(
  countHint?: number
): Promise<DeletionReceipt> {
  const deleted = await purgeUserTrainingImages(countHint);
  return { deleted, requestedAt: new Date().toISOString() };
}
