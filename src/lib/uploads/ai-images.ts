import { stripExifAndGeolocation } from '@/lib/media/exif';
import { ConsentService } from '@/lib/privacy/consent-service';
import { getDeletionAdapter } from '@/lib/privacy/deletion-adapter';
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

function buildFilename(params: UploadAiImageParams): string {
  const h = simpleHash(
    `${params.localUri}|${params.plantId}|${params.taskId ?? ''}`
  );
  const ext = chooseExtension(params.mimeType, params.localUri);
  const token = params.taskId ?? 'notask';
  return `${params.plantId}_${token}_${h}.${ext}`;
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
  const stripped = await stripExifAndGeolocation(localUri);
  const response = await fetch(stripped.uri);
  const blob = await response.blob();
  const arrayBuffer = await blob.arrayBuffer();
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
    throw new ConsentRequiredError('cloudProcessing consent is required');
  }
  const filename = buildFilename(params);
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
    localUri: params.localUri,
    mimeType: params.mimeType,
  });
  addRetentionRecord({
    id: result.path,
    dataType: 'inference_images',
    createdAt: Date.now(),
  });
  return result;
}

export class ConsentRequiredError extends Error {
  code: 'CONSENT_REQUIRED';
  constructor(message = 'Consent required') {
    super(message);
    this.name = 'ConsentRequiredError';
    this.code = 'CONSENT_REQUIRED';
  }
}

export async function uploadTrainingImage(
  params: UploadAiImageParams
): Promise<UploadAiImageResult> {
  // Training requires both cloud processing (to upload) and explicit aiTraining.
  if (!ConsentService.hasConsent('cloudProcessing')) {
    throw new ConsentRequiredError('cloudProcessing consent is required');
  }
  if (!ConsentService.hasConsent('aiTraining')) {
    throw new ConsentRequiredError('aiTraining consent is required');
  }
  const filename = buildFilename(params);
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
    localUri: params.localUri,
    mimeType: params.mimeType,
  });
  addRetentionRecord({
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
