import type {
  AssessmentResult,
  CapturedPhoto,
  InferenceError,
} from '@/types/assessment';

import { getCloudInferenceClient } from '../cloud-inference-client';
import { runInference } from '../inference-coordinator';
import { getInferenceEngine } from '../inference-engine';

jest.mock('../inference-engine');
jest.mock('../cloud-inference-client');

type Mocked<T> = jest.Mocked<T>;

describe('inference-coordinator', () => {
  const mockPhotos: CapturedPhoto[] = [
    {
      id: 'photo-1',
      uri: 'file:///photo-1.jpg',
      timestamp: Date.now(),
      metadata: { width: 400, height: 300 },
      qualityScore: {
        score: 0.9,
        acceptable: true,
        issues: [],
      },
    },
  ];

  const deviceResult: AssessmentResult = {
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
        uri: 'file:///photo-1.jpg',
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
    processingTimeMs: 800,
    mode: 'device',
    modelVersion: 'v1.0.0',
  };

  const cloudResult: AssessmentResult = {
    ...deviceResult,
    mode: 'cloud',
    processingTimeMs: 1500,
  };

  const getInferenceEngineMock = getInferenceEngine as jest.MockedFunction<
    typeof getInferenceEngine
  >;
  const getCloudClientMock = getCloudInferenceClient as jest.MockedFunction<
    typeof getCloudInferenceClient
  >;

  function createInferenceEngineMock(
    overrides?: Partial<Mocked<ReturnType<typeof getInferenceEngine>>>
  ) {
    return {
      initialize: jest.fn().mockResolvedValue(undefined),
      isInitialized: true,
      getModelInfo: jest.fn().mockReturnValue({ version: 'v1.0.0' }),
      predict: jest.fn().mockResolvedValue(deviceResult),
      ...overrides,
    } as unknown as Mocked<ReturnType<typeof getInferenceEngine>>;
  }

  function createCloudClientMock() {
    return {
      predict: jest.fn().mockResolvedValue(cloudResult),
    } as unknown as Mocked<ReturnType<typeof getCloudInferenceClient>>;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    getInferenceEngineMock.mockReturnValue(createInferenceEngineMock());
    getCloudClientMock.mockReturnValue(createCloudClientMock());
  });

  test('runs device inference successfully in auto mode', async () => {
    const result = await runInference(mockPhotos, {
      mode: 'auto',
      plantContext: { id: 'plant-123' },
      assessmentId: 'assessment-123',
    });

    expect(result).toEqual(deviceResult);
    expect(getInferenceEngineMock().predict).toHaveBeenCalledTimes(1);
    expect(getCloudClientMock().predict).not.toHaveBeenCalled();
  });

  test('falls back to cloud when device inference signals fallback', async () => {
    const fallbackError: InferenceError = {
      code: 'DEADLINE_EXCEEDED',
      message: 'Deadline exceeded',
      category: 'timeout',
      retryable: false,
      fallbackToCloud: true,
    };

    const engine = createInferenceEngineMock({
      predict: jest.fn().mockRejectedValue(fallbackError),
    });

    getInferenceEngineMock.mockReturnValue(engine);

    const cloudClient = createCloudClientMock();
    getCloudClientMock.mockReturnValue(cloudClient);

    const result = await runInference(mockPhotos, {
      mode: 'auto',
      plantContext: { id: 'plant-123' },
      assessmentId: 'assessment-123',
    });

    expect(result).toEqual(cloudResult);
    expect(engine.predict).toHaveBeenCalledTimes(1);
    expect(cloudClient.predict).toHaveBeenCalledTimes(1);
  });

  test('throws validation error when plant context missing for cloud inference', async () => {
    const cloudClient = createCloudClientMock();
    getCloudClientMock.mockReturnValue(cloudClient);

    await expect(
      runInference(mockPhotos, {
        mode: 'cloud',
        assessmentId: 'assessment-123',
      })
    ).rejects.toMatchObject({
      code: 'MISSING_PARAMETERS',
      category: 'validation',
    });

    expect(cloudClient.predict).not.toHaveBeenCalled();
  });

  test('invokes cloud client directly in cloud mode with required parameters', async () => {
    const cloudClient = createCloudClientMock();
    getCloudClientMock.mockReturnValue(cloudClient);

    const result = await runInference(mockPhotos, {
      mode: 'cloud',
      plantContext: { id: 'plant-123' },
      assessmentId: 'assessment-123',
      modelVersion: 'v1.0.0',
    });

    expect(result).toEqual(cloudResult);
    expect(cloudClient.predict).toHaveBeenCalledWith({
      photos: mockPhotos,
      plantContext: { id: 'plant-123' },
      assessmentId: 'assessment-123',
      modelVersion: 'v1.0.0',
    });
  });
});
