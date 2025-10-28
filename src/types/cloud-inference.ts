import type {
  AssessmentPlantContext,
  AssessmentResult,
  CapturedPhoto,
} from './assessment';

/**
 * Cloud Inference Request/Response Types
 * Contract between mobile app and Supabase Edge Function
 */

export type CloudInferenceImage = {
  id: string; // matches CapturedPhoto.id
  url: string; // signed storage URL
  sha256: string; // integrity hash
  contentType: 'image/jpeg' | 'image/png';
};

export type CloudInferenceClientInfo = {
  appVersion: string;
  platform: 'android' | 'ios';
  deviceModel?: string;
};

export type CloudInferenceRequest = {
  idempotencyKey: string; // uuid-v4
  assessmentId: string;
  modelVersion?: string; // optional hint; server may override
  images: CloudInferenceImage[];
  plantContext: AssessmentPlantContext;
  client: CloudInferenceClientInfo;
};

export type CloudInferenceResponse = {
  success: boolean;
  mode: 'cloud';
  modelVersion: string;
  processingTimeMs: number;
  result?: AssessmentResult;
  error?: {
    code: string;
    message: string;
  };
};

export type CloudInferenceError = {
  code: string;
  message: string;
  category: 'network' | 'auth' | 'timeout' | 'server' | 'validation';
  retryable: boolean;
  httpStatus?: number;
  details?: Record<string, unknown>;
};

export type UploadedImage = {
  id: string;
  localUri: string;
  storageUrl: string;
  signedUrl: string;
  sha256: string;
  contentType: 'image/jpeg' | 'image/png';
};

export type CloudInferencePredictOptions = {
  photos: CapturedPhoto[];
  plantContext: AssessmentPlantContext;
  assessmentId: string;
  modelVersion?: string;
  idempotencyKey?: string;
};
