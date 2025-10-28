import type { AssessmentResult, CapturedPhoto } from '@/types/assessment';

jest.mock('uuid', () => ({
  v4: jest.fn(() => '550e8400-e29b-41d4-a716-446655440000'), // Valid UUID v4
}));

jest.mock('expo-file-system', () => ({
  getInfoAsync: jest.fn(),
  readAsStringAsync: jest.fn(),
}));

jest.mock('expo-crypto', () => ({
  digestStringAsync: jest.fn(),
  CryptoDigestAlgorithm: {
    SHA256: 'SHA256',
  },
}));

jest.mock('@/lib/supabase', () => {
  const storageUploadMock = jest.fn();
  const storageCreateSignedUrlMock = jest.fn();
  const functionsInvokeMock = jest.fn();

  return {
    supabase: {
      storage: {
        from: jest.fn(() => ({
          upload: storageUploadMock,
          createSignedUrl: storageCreateSignedUrlMock,
        })),
      },
      functions: {
        invoke: functionsInvokeMock,
      },
    },
    // Export mocks for test use
    _mocks: {
      storageUploadMock,
      storageCreateSignedUrlMock,
      functionsInvokeMock,
    },
  };
});

const { _mocks } = require('@/lib/supabase');
const { storageUploadMock, storageCreateSignedUrlMock, functionsInvokeMock } =
  _mocks;

const getInfoAsyncMock = require('expo-file-system')
  .getInfoAsync as jest.MockedFunction<any>;
const readAsStringAsyncMock = require('expo-file-system')
  .readAsStringAsync as jest.MockedFunction<any>;
const digestStringAsyncMock = require('expo-crypto')
  .digestStringAsync as jest.MockedFunction<any>;

const CloudInferenceClient =
  require('../cloud-inference-client').CloudInferenceClient;

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

  getInfoAsyncMock.mockResolvedValue({
    exists: true,
    size: 1024 * 1024, // 1MB, within limit
  });
  readAsStringAsyncMock.mockResolvedValue('mock-base64-content');
  digestStringAsyncMock.mockResolvedValue('mock-sha256');

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
    expect(storageUploadMock).toHaveBeenCalledTimes(mockPhotos.length);
    expect(storageCreateSignedUrlMock).toHaveBeenCalledTimes(mockPhotos.length);

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
    expect(storageUploadMock).toHaveBeenCalledTimes(mockPhotos.length);
    expect(storageCreateSignedUrlMock).toHaveBeenCalledTimes(mockPhotos.length);
  });
});
