import { Buffer } from 'buffer';
import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

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

import { MAX_IMAGE_SIZE_BYTES } from './image-storage';

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
    const { photos, plantContext, assessmentId, modelVersion, idempotencyKey } =
      options;
    const startTime = Date.now();

    try {
      // Use provided idempotency key or generate new one
      const requestIdempotencyKey = idempotencyKey || Crypto.randomUUID();

      // Upload images to storage and get signed URLs
      const uploadedImages = await this.uploadImages(photos, assessmentId);

      // Build request payload
      const request: CloudInferenceRequest = {
        idempotencyKey: requestIdempotencyKey,
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
      const response = await this.callEdgeFunction(
        request,
        requestIdempotencyKey
      );

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
    // Check file size before reading to prevent loading huge images into memory
    const info = await FileSystem.getInfoAsync(photo.uri);
    if (!info.exists || !('size' in info) || info.size > MAX_IMAGE_SIZE_BYTES) {
      throw new Error(
        `Image too large: max ${MAX_IMAGE_SIZE_BYTES} bytes, got ${
          info.exists && 'size' in info ? info.size : 'unknown'
        } bytes`
      );
    }

    // Read file as base64 using expo-file-system for cross-platform compatibility
    const base64 = await FileSystem.readAsStringAsync(photo.uri, {
      encoding: 'base64',
    });

    // Convert base64 to Uint8Array
    const body = new Uint8Array(Buffer.from(base64, 'base64'));

    // Compute SHA256 from base64 string directly (avoids re-reading the file)
    const sha256 = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      base64
    );

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

    // NOTE: retries can hit 409 when `upsert: false`. Either enable
    // `upsert` for idempotency or treat the 409 as success so queued
    // uploads can continue. We keep the latter behaviour here.
    const { data: uploadDataRaw, error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, body, {
        contentType,
        upsert: false,
      });

    let uploadedPath = uploadDataRaw?.path ?? null;

    if (uploadError) {
      // Check if file already exists (409 Conflict) - treat as success for retries
      if (
        typeof (uploadError as { statusCode?: string }).statusCode ===
          'string' &&
        (uploadError as { statusCode?: string }).statusCode === '409'
      ) {
        // File already exists, proceed with existing file
        uploadedPath = storagePath;
      } else {
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
    }

    if (!uploadedPath) {
      throw this.createError({
        code: 'UPLOAD_FAILED',
        message: 'Upload succeeded without returning storage path',
        category: 'network',
        retryable: true,
        details: { photoId: photo.id, assessmentId },
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
      storageUrl: uploadedPath,
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

      const { data, error } = await fetchPromise;

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
