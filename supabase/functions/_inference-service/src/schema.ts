import { z } from 'zod';

export const cloudInferenceImageSchema = z.object({
  id: z.string().min(1),
  url: z.string().url(),
  sha256: z.string().min(64).max(128),
  contentType: z.enum(['image/jpeg', 'image/png']),
});

export const plantContextSchema = z.object({
  id: z.string().min(1),
  metadata: z.record(z.unknown()).optional(),
});

export const clientInfoSchema = z.object({
  appVersion: z.string().min(1),
  platform: z.enum(['android', 'ios']),
  deviceModel: z.string().min(1).optional(),
});

export const cloudInferenceRequestSchema = z.object({
  idempotencyKey: z.string().min(1),
  assessmentId: z.string().min(1),
  modelVersion: z.string().min(1).optional(),
  images: z.array(cloudInferenceImageSchema).min(1),
  plantContext: plantContextSchema,
  client: clientInfoSchema,
});

export type CloudInferenceRequest = z.infer<typeof cloudInferenceRequestSchema>;

const assessmentClassSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  category: z.string().min(1),
  description: z.string().min(1),
  visualCues: z.array(z.string()),
  isOod: z.boolean(),
  actionTemplate: z.object({
    immediateSteps: z.array(z.any()),
    shortTermActions: z.array(z.any()),
    diagnosticChecks: z.array(z.any()),
    warnings: z.array(z.string()),
    disclaimers: z.array(z.string()),
  }),
  createdAt: z.number().int(),
});

const qualityIssueSchema = z.object({
  type: z.string(),
  severity: z.enum(['low', 'medium', 'high']),
  suggestion: z.string().optional(),
});

const qualityResultSchema = z.object({
  score: z.number().min(0).max(1),
  acceptable: z.boolean(),
  issues: z.array(qualityIssueSchema),
});

const perImageResultSchema = z.object({
  id: z.string(),
  uri: z.string(),
  classId: z.string(),
  conf: z.number().min(0).max(1),
  quality: qualityResultSchema,
});

const assessmentResultSchema = z.object({
  topClass: assessmentClassSchema,
  rawConfidence: z.number().min(0).max(1),
  calibratedConfidence: z.number().min(0).max(1),
  perImage: z.array(perImageResultSchema),
  aggregationMethod: z.enum(['majority-vote', 'highest-confidence']),
  processingTimeMs: z.number().nonnegative(),
  mode: z.literal('cloud'),
  modelVersion: z.string(),
  executionProvider: z.string().optional(),
});

export const cloudInferenceResponseSchema = z.object({
  success: z.literal(true),
  mode: z.literal('cloud'),
  modelVersion: z.string(),
  processingTimeMs: z.number().nonnegative(),
  result: assessmentResultSchema,
});

export const cloudInferenceErrorResponseSchema = z.object({
  success: z.literal(false),
  mode: z.literal('cloud'),
  modelVersion: z.string(),
  processingTimeMs: z.number().nonnegative(),
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});

export type CloudInferenceResponse = z.infer<
  typeof cloudInferenceResponseSchema
>;

export type CloudInferenceErrorResponse = z.infer<
  typeof cloudInferenceErrorResponseSchema
>;

export type CloudInferenceResponseEnvelope =
  | CloudInferenceResponse
  | CloudInferenceErrorResponse;
