import type { AssessmentResult, CapturedPhoto } from '@/types/assessment';

import { CloudInferenceClient } from '../cloud-inference-client';
import { computeIntegritySha256 } from '../image-storage';

const storageFromMock = jest.fn();
const storageUploadMock = jest.fn();
const storageCreateSignedUrlMock = jest.fn();
const functionsInvokeMock = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    storage: {
      from: storageFromMock,
    },
    functions: {
      invoke: functionsInvokeMock,
    },
  },
}));

jest.mock('../image-storage', () => ({
  computeIntegritySha256: jest.fn(),
}));

storageFromMock.mockImplementation(() => ({
  upload: storageUploadMock,
  createSignedUrl: storageCreateSignedUrlMock,
}));

const computeIntegritySha256Mock =
  computeIntegritySha256 as jest.MockedFunction<typeof computeIntegritySha256>;

const mockPhotos: CapturedPhoto[] = [
  {
    id: 'photo-1',
    uri: 'file:///photo-1.jpg',
    timestamp: Date.now(),
    metadata: {
      width: 400,
      height: 300,
    },
    qualityScore: {
      score: 0.9,
      acceptable: true,
      issues: [],
    },
  },
];

const baseAssessmentResult: AssessmentResult = {
  topClass: {
    id: 'healthy',
    name: 'Healthy',
    category: 'healthy',
    description: 'Healthy plant',
    visualCues: [],
    isOod: false,
    actionTemplate: {
      immediateSteps: [],
      shortTermActions: [],
      diagnosticChecks: [],
      warnings: [],
      disclaimers: [],
    },
    createdAt: Date.now(),
  },
  rawConfidence: 0.82,
  calibratedConfidence: 0.8,
  perImage: [
    {
      id: 'photo-1',
      uri: 'https://example.com',
      classId: 'healthy',
      conf: 0.82,
      quality: {
        score: 0.9,
        acceptable: true,
        issues: [],
      },
    },
  ],
  aggregationMethod: 'majority-vote',
  processingTimeMs: 1200,
  mode: 'cloud',
  modelVersion: 'v1.0.0',
};

const originalFetch = global.fetch;

beforeEach(() => {
  jest.clearAllMocks();
  computeIntegritySha256Mock.mockResolvedValue('mock-sha256');

  const fetchMock = jest.fn().mockResolvedValue({
    blob: async () => ({
      arrayBuffer: async () => new ArrayBuffer(8),
    }),
  });
  global.fetch = fetchMock as unknown as typeof fetch;

  storageUploadMock.mockResolvedValue({
    data: { path: 'uploads/path.jpg' },
    error: null,
  } as any);
  storageCreateSignedUrlMock.mockResolvedValue({
    data: { signedUrl: 'https://signed.example.com/path.jpg' },
    error: null,
  } as any);
  functionsInvokeMock.mockResolvedValue({
    data: {
      success: true,
      mode: 'cloud',
      modelVersion: 'v1.0.0',
      processingTimeMs: 500,
      result: baseAssessmentResult,
    },
    error: null,
  } as any);
});

afterAll(() => {
  global.fetch = originalFetch;
});

describe('CloudInferenceClient', () => {
  function createClient() {
    return new CloudInferenceClient();
  }

  test('uploads images and returns inference result', async () => {
    const client = createClient();

    const result = await client.predict({
      photos: mockPhotos,
      plantContext: { id: 'plant-1' },
      assessmentId: 'assessment-1',
      modelVersion: 'v1.0.0',
    });

    expect(result).toEqual(baseAssessmentResult);
    expect(storageFromMock).toHaveBeenCalledWith('assessment-images');
    expect(storageUploadMock).toHaveBeenCalledTimes(mockPhotos.length);
    expect(storageCreateSignedUrlMock).toHaveBeenCalledTimes(mockPhotos.length);
    expect(computeIntegritySha256Mock).toHaveBeenCalledTimes(mockPhotos.length);

    expect(functionsInvokeMock).toHaveBeenCalledTimes(1);
    const mockCall = functionsInvokeMock.mock.calls[0] as [string, any];
    const [functionName, invokeArgs] = mockCall;
    expect(functionName).toBe('ai-inference');
    expect(invokeArgs.body.assessmentId).toBe('assessment-1');
    expect(invokeArgs.headers['X-Idempotency-Key']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });

  test('throws when edge function responds with error payload', async () => {
    functionsInvokeMock.mockResolvedValueOnce({
      data: {
        success: false,
        mode: 'cloud',
        modelVersion: 'v1.0.0',
        processingTimeMs: 250,
        error: {
          code: 'MODEL_FAILURE',
          message: 'Model execution failed',
        },
      },
      error: null,
    });

    const client = createClient();

    await expect(
      client.predict({
        photos: mockPhotos,
        plantContext: { id: 'plant-1' },
        assessmentId: 'assessment-1',
      })
    ).rejects.toMatchObject({
      code: 'MODEL_FAILURE',
      message: 'Model execution failed',
      retryable: true,
    });
  });

  test('uses provided idempotency key instead of generating new one', async () => {
    const client = createClient();
    const providedIdempotencyKey = 'custom-idempotency-key-123';

    await client.predict({
      photos: mockPhotos,
      plantContext: { id: 'plant-1' },
      assessmentId: 'assessment-1',
      modelVersion: 'v1.0.0',
      idempotencyKey: providedIdempotencyKey,
    });

    expect(functionsInvokeMock).toHaveBeenCalledTimes(1);
    const mockCall = functionsInvokeMock.mock.calls[0] as [string, any];
    const [functionName, invokeArgs] = mockCall;
    expect(functionName).toBe('ai-inference');
    expect(invokeArgs.headers['X-Idempotency-Key']).toBe(
      providedIdempotencyKey
    );
  });

  test('handles 409 conflict by treating as successful upload', async () => {
    storageUploadMock.mockResolvedValueOnce({
      data: null,
      error: { message: 'File already exists', statusCode: '409' },
    } as any);

    const client = createClient();

    const result = await client.predict({
      photos: mockPhotos,
      plantContext: { id: 'plant-1' },
      assessmentId: 'assessment-1',
      modelVersion: 'v1.0.0',
    });

    expect(result).toEqual(baseAssessmentResult);
    expect(storageFromMock).toHaveBeenCalledWith('assessment-images');
    expect(storageUploadMock).toHaveBeenCalledTimes(mockPhotos.length);
    expect(storageCreateSignedUrlMock).toHaveBeenCalledTimes(mockPhotos.length);
  });
});
