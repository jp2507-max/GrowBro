import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { v4 as uuidv4 } from 'uuid';

import { supabase } from '@/lib/supabase';
import type { AssessmentResult, CapturedPhoto } from '@/types/assessment';
import type {
  CloudInferenceClientInfo,
  CloudInferenceError,
  CloudInferencePredictOptions,
  CloudInferenceRequest,
  CloudInferenceResponse,
  UploadedImage,
} from '@/types/cloud-inference';

import { computeIntegritySha256 } from './image-storage';

/**
 * Cloud Inference Client
 * Handles cloud-based ML inference via Supabase Edge Functions
 */

const CLOUD_INFERENCE_TIMEOUT_MS = 8000; // 8s hard timeout
const EDGE_FUNCTION_NAME = 'ai-inference';
const STORAGE_BUCKET = 'assessment-images';

export class CloudInferenceClient {
  /**
   * Run cloud inference on captured photos
   */
  async predict(
    options: CloudInferencePredictOptions
  ): Promise<AssessmentResult> {
    const { photos, plantContext, assessmentId, modelVersion } = options;
    const startTime = Date.now();

    try {
      // Generate idempotency key
      const idempotencyKey = uuidv4();

      // Upload images to storage and get signed URLs
      const uploadedImages = await this.uploadImages(photos, assessmentId);

      // Build request payload
      const request: CloudInferenceRequest = {
        idempotencyKey,
        assessmentId,
        modelVersion,
        images: uploadedImages.map((img) => ({
          id: img.id,
          url: img.signedUrl,
          sha256: img.sha256,
          contentType: img.contentType,
        })),
        plantContext,
        client: this.getClientInfo(),
      };

      // Call Edge Function
      const response = await this.callEdgeFunction(request, idempotencyKey);

      if (!response.success || !response.result) {
        throw this.createError({
          code: response.error?.code || 'INFERENCE_FAILED',
          message: response.error?.message || 'Cloud inference failed',
          category: 'server',
          retryable: true,
        });
      }

      const processingTimeMs = Date.now() - startTime;
      console.log(
        `[CloudInferenceClient] Inference completed in ${processingTimeMs}ms`
      );

      return response.result;
    } catch (error) {
      const processingTimeMs = Date.now() - startTime;
      console.error(
        `[CloudInferenceClient] Inference failed after ${processingTimeMs}ms:`,
        error
      );
      throw error;
    }
  }

  /**
   * Upload images to Supabase Storage and generate signed URLs
   */
  private async uploadImages(
    photos: CapturedPhoto[],
    assessmentId: string
  ): Promise<UploadedImage[]> {
    return Promise.all(
      photos.map((photo) => this.prepareImageForUpload(photo, assessmentId))
    );
  }

  private async prepareImageForUpload(
    photo: CapturedPhoto,
    assessmentId: string
  ): Promise<UploadedImage> {
    try {
      const preparedPhoto = await this.readPhotoContent(photo, assessmentId);
      const uploadRefs = await this.uploadPhotoToStorage(
        photo,
        preparedPhoto,
        assessmentId
      );

      return {
        id: photo.id,
        localUri: photo.uri,
        storageUrl: uploadRefs.storageUrl,
        signedUrl: uploadRefs.signedUrl,
        sha256: preparedPhoto.sha256,
        contentType: preparedPhoto.contentType,
      };
    } catch (error) {
      console.error(
        `[CloudInferenceClient] Upload failed for ${photo.id}:`,
        error
      );
      throw error;
    }
  }

  private async readPhotoContent(
    photo: CapturedPhoto,
    assessmentId: string
  ): Promise<{
    body: Uint8Array;
    contentType: 'image/jpeg' | 'image/png';
    storagePath: string;
    sha256: string;
  }> {
    const response = await fetch(photo.uri);
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const body = new Uint8Array(arrayBuffer);
    const sha256 = await computeIntegritySha256(photo.uri);

    const fileExtension = photo.uri.endsWith('.png') ? 'png' : 'jpg';
    const contentType: 'image/jpeg' | 'image/png' =
      fileExtension === 'png' ? 'image/png' : 'image/jpeg';
    const storagePath = `${assessmentId}/${photo.id}.${fileExtension}`;

    return { body, contentType, storagePath, sha256 };
  }

  private async uploadPhotoToStorage(
    photo: CapturedPhoto,
    prepared: {
      body: Uint8Array;
      contentType: 'image/jpeg' | 'image/png';
      storagePath: string;
    },
    assessmentId: string
  ): Promise<{ storageUrl: string; signedUrl: string }> {
    const { body, contentType, storagePath } = prepared;

    // NOTE: Offline retries will fail if we unconditionally use `upsert: false`.
    // If an earlier attempt uploaded the same file successfully but the
    // inference request later times out (for example the edge function
    // times out), a queued retry that attempts to upload the same
    // `assessmentId/photo.id` path will receive a 409 Conflict from
    // Supabase and the retry will be marked as failed permanently.
    //
    // Two safe remediation options:
    // 1) Use `upsert: true` here to make the upload idempotent so retries
    //    can re-upload the same path without failing (recommended for
    //    offline retry scenarios). This will overwrite any existing file
    //    at the same path.
    // 2) Keep `upsert: false` but treat a 409 response from Supabase as a
    //    successful no-op (the file already exists), allowing the retry to
    //    continue. This preserves the guarantee that existing files are not
    //    overwritten but adds special-case handling for the 409 status.
    //
    // Current code keeps `upsert: false` to preserve previous behaviour,
    // but either approach is acceptable depending on product/storage
    // expectations. If you want offline retries to progress reliably,
    // switch to `upsert: true` or handle 409 as success.
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, body, {
        contentType,
        upsert: false,
      });

    if (uploadError) {
      throw this.createError({
        code: 'UPLOAD_FAILED',
        message: `Failed to upload image: ${uploadError.message}`,
        category: 'network',
        retryable: true,
        details: {
          photoId: photo.id,
          error: uploadError,
          assessmentId,
        },
      });
    }

    const { data: signedData, error: signedError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(storagePath, 3600);

    if (signedError || !signedData?.signedUrl) {
      throw this.createError({
        code: 'SIGNED_URL_FAILED',
        message: 'Failed to generate signed URL',
        category: 'server',
        retryable: true,
        details: { photoId: photo.id, error: signedError, assessmentId },
      });
    }

    return {
      storageUrl: uploadData.path,
      signedUrl: signedData.signedUrl,
    };
  }

  /**
   * Call Supabase Edge Function for inference
   */
  private async callEdgeFunction(
    request: CloudInferenceRequest,
    idempotencyKey: string
  ): Promise<CloudInferenceResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, CLOUD_INFERENCE_TIMEOUT_MS);

    try {
      const fetchPromise = supabase.functions.invoke<CloudInferenceResponse>(
        EDGE_FUNCTION_NAME,
        {
          body: request,
          headers: {
            'X-Idempotency-Key': idempotencyKey,
          },
        }
      );

      const abortPromise = new Promise<never>((_, reject) => {
        controller.signal.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'));
        });
      });

      const { data, error } = await Promise.race([fetchPromise, abortPromise]);

      if (error) {
        // Check if timeout
        if (error.message?.includes('aborted')) {
          throw this.createError({
            code: 'TIMEOUT',
            message: 'Cloud inference timeout exceeded',
            category: 'timeout',
            retryable: false,
          });
        }

        // Check if auth error
        if (error.message?.includes('auth') || error.message?.includes('401')) {
          throw this.createError({
            code: 'AUTH_FAILED',
            message: 'Authentication failed',
            category: 'auth',
            retryable: false,
          });
        }

        throw this.createError({
          code: 'EDGE_FUNCTION_ERROR',
          message: error.message || 'Edge function invocation failed',
          category: 'server',
          retryable: true,
          details: { error },
        });
      }

      if (!data) {
        throw this.createError({
          code: 'NO_RESPONSE',
          message: 'No response from Edge Function',
          category: 'server',
          retryable: true,
        });
      }

      return data;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Get client information for telemetry
   */
  private getClientInfo(): CloudInferenceClientInfo {
    return {
      appVersion: Constants.expoConfig?.version || 'unknown',
      platform: Platform.OS as 'android' | 'ios',
      deviceModel: Constants.deviceName || undefined,
    };
  }

  /**
   * Create typed cloud inference error
   */
  private createError(options: {
    code: string;
    message: string;
    category: CloudInferenceError['category'];
    retryable: boolean;
    httpStatus?: number;
    details?: Record<string, unknown>;
  }): CloudInferenceError {
    return {
      code: options.code,
      message: options.message,
      category: options.category,
      retryable: options.retryable,
      httpStatus: options.httpStatus,
      details: options.details,
    };
  }
}

// Singleton instance
let cloudInferenceClientInstance: CloudInferenceClient | null = null;

/**
 * Get singleton cloud inference client instance
 */
export function getCloudInferenceClient(): CloudInferenceClient {
  if (!cloudInferenceClientInstance) {
    cloudInferenceClientInstance = new CloudInferenceClient();
  }
  return cloudInferenceClientInstance;
}

/**
 * Reset cloud inference client (useful for testing)
 */
export function resetCloudInferenceClient(): void {
  cloudInferenceClientInstance = null;
}
