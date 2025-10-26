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
    const uploadPromises = photos.map(async (photo) => {
      try {
        // Read image file
        const response = await fetch(photo.uri);
        const blob = await response.blob();
        const arrayBuffer = await blob.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        // Compute integrity hash from URI
        const sha256 = await computeIntegritySha256(photo.uri);

        // Generate storage path
        const fileExtension = photo.uri.endsWith('.png') ? 'png' : 'jpg';
        const contentType: 'image/jpeg' | 'image/png' =
          fileExtension === 'png' ? 'image/png' : 'image/jpeg';
        const storagePath = `${assessmentId}/${photo.id}.${fileExtension}`;

        // Upload to storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(storagePath, uint8Array, {
            contentType,
            upsert: false,
          });

        if (uploadError) {
          throw this.createError({
            code: 'UPLOAD_FAILED',
            message: `Failed to upload image: ${uploadError.message}`,
            category: 'network',
            retryable: true,
            details: { photoId: photo.id, error: uploadError },
          });
        }

        // Generate signed URL (valid for 1 hour)
        const { data: signedData, error: signedError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .createSignedUrl(storagePath, 3600);

        if (signedError || !signedData?.signedUrl) {
          throw this.createError({
            code: 'SIGNED_URL_FAILED',
            message: 'Failed to generate signed URL',
            category: 'server',
            retryable: true,
            details: { photoId: photo.id, error: signedError },
          });
        }

        return {
          id: photo.id,
          localUri: photo.uri,
          storageUrl: uploadData.path,
          signedUrl: signedData.signedUrl,
          sha256,
          contentType,
        };
      } catch (error) {
        console.error(
          `[CloudInferenceClient] Upload failed for ${photo.id}:`,
          error
        );
        throw error;
      }
    });

    return Promise.all(uploadPromises);
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
