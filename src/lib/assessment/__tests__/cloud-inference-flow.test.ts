import type { AssessmentResult, CapturedPhoto } from '@/types/assessment';

import { resetCloudInferenceClient } from '../cloud-inference-client';
import { computeIntegritySha256 } from '../image-storage';
import { runInference } from '../inference-coordinator';
import { getInferenceEngine } from '../inference-engine';

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

jest.mock('../inference-engine', () => ({
  getInferenceEngine: jest.fn(),
}));

const computeIntegritySha256Mock =
  computeIntegritySha256 as jest.MockedFunction<typeof computeIntegritySha256>;
const getInferenceEngineMock = getInferenceEngine as jest.MockedFunction<
  typeof getInferenceEngine
>;

const originalFetch = global.fetch;

const photos: CapturedPhoto[] = [
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

const cloudResult: AssessmentResult = {
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
  rawConfidence: 0.84,
  calibratedConfidence: 0.82,
  perImage: [
    {
      id: 'photo-1',
      uri: 'https://signed.example.com/path.jpg',
      classId: 'healthy',
      conf: 0.84,
      quality: {
        score: 0.9,
        acceptable: true,
        issues: [],
      },
    },
  ],
  aggregationMethod: 'majority-vote',
  processingTimeMs: 640,
  mode: 'cloud',
  modelVersion: 'v1.0.0',
};

beforeEach(() => {
  jest.clearAllMocks();
  resetCloudInferenceClient();

  computeIntegritySha256Mock.mockResolvedValue('mock-sha256');
  getInferenceEngineMock.mockImplementation(() => {
    throw new Error('Device inference should not be invoked in cloud mode');
  });

  const fetchMock = jest.fn().mockResolvedValue({
    blob: async () => ({
      arrayBuffer: async () => new ArrayBuffer(8),
    }),
  });
  global.fetch = fetchMock as unknown as typeof fetch;

  storageFromMock.mockImplementation(() => ({
    upload: storageUploadMock,
    createSignedUrl: storageCreateSignedUrlMock,
  }));

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
      result: cloudResult,
    },
    error: null,
  } as any);
});

afterEach(() => {
  global.fetch = originalFetch;
});

describe('cloud inference integration', () => {
  test('runInference executes cloud path successfully', async () => {
    const result = await runInference(photos, {
      mode: 'cloud',
      plantContext: { id: 'plant-123' },
      assessmentId: 'assessment-123',
      modelVersion: 'v1.0.0',
    });

    expect(result).toEqual(cloudResult);

    expect(storageFromMock).toHaveBeenCalledWith('assessment-images');
    expect(storageUploadMock).toHaveBeenCalledTimes(photos.length);
    expect(storageCreateSignedUrlMock).toHaveBeenCalledTimes(photos.length);
    expect(computeIntegritySha256Mock).toHaveBeenCalledTimes(photos.length);
    expect(functionsInvokeMock).toHaveBeenCalledTimes(1);

    const [{ body }] = functionsInvokeMock.mock.calls as [
      { body: { assessmentId: string } },
    ];
    expect(body.assessmentId).toBe('assessment-123');
  });
});
