import type {
  AssessmentPlantContext,
  AssessmentResult,
} from '@/types/assessment';

import * as AssessmentRedaction from './assessment-redaction';
import type { CommunityPostPrefill } from './community-post-prefill';
import {
  generateCommunityPostPrefill,
  validatePostPrefill,
} from './community-post-prefill';

// Mock the redaction module
jest.mock('./assessment-redaction');

const mockRedactAssessmentForCommunity =
  AssessmentRedaction.redactAssessmentForCommunity as jest.MockedFunction<
    typeof AssessmentRedaction.redactAssessmentForCommunity
  >;

// Helper to create mock assessment
const createMockAssessment = (
  calibratedConfidence: number,
  isOod: boolean = false,
  className: string = 'Nitrogen deficiency'
): AssessmentResult => ({
  topClass: {
    id: 'nitrogen-deficiency',
    name: className,
    category: 'nutrient',
    description: 'Test description',
    visualCues: [],
    isOod,
    actionTemplate: {
      immediateSteps: [],
      shortTermActions: [],
      diagnosticChecks: [],
      warnings: [],
      disclaimers: [],
    },
    createdAt: Date.now(),
  },
  rawConfidence: calibratedConfidence,
  calibratedConfidence,
  perImage: [
    {
      id: 'img-1',
      uri: 'file:///test/image1.jpg',
      classId: 'nitrogen-deficiency',
      conf: calibratedConfidence,
      quality: { score: 85, acceptable: true, issues: [] },
    },
  ],
  aggregationMethod: 'majority-vote',
  processingTimeMs: 100,
  mode: 'device',
  modelVersion: 'v1.0.0',
});

const createMockPlantContext = (
  metadata?: Record<string, unknown>
): AssessmentPlantContext => ({
  id: 'plant-123',
  metadata,
});

describe('generateCommunityPostPrefill', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock redaction to return predictable results
    mockRedactAssessmentForCommunity.mockResolvedValue({
      redactedImageUri: 'file:///redacted/random-uuid.jpg',
      anonymousFilename: 'random-uuid.jpg',
      sanitizedContext: { id: 'plant-123' },
    });

    // Mock fetch for file size
    global.fetch = jest.fn().mockResolvedValue({
      blob: () => Promise.resolve({ size: 1024000 }),
    }) as jest.Mock;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('generates post with title for uncertain assessment', async () => {
    const assessment = createMockAssessment(0.65);
    const plantContext = createMockPlantContext();

    const result = await generateCommunityPostPrefill({
      assessment,
      assessmentId: 'assessment-123',
      plantContext,
    });

    expect(result.title).toBe('Need help identifying plant issue');
  });

  test('generates post with class name for confident assessment', async () => {
    const assessment = createMockAssessment(0.85);
    const plantContext = createMockPlantContext();

    const result = await generateCommunityPostPrefill({
      assessment,
      assessmentId: 'assessment-123',
      plantContext,
    });

    expect(result.title).toBe('Looking for advice on nitrogen deficiency');
  });

  test('includes AI assessment context in body', async () => {
    const assessment = createMockAssessment(0.72);
    const plantContext = createMockPlantContext();

    const result = await generateCommunityPostPrefill({
      assessment,
      assessmentId: 'assessment-123',
      plantContext,
    });

    expect(result.body).toContain('I used the AI assessment tool');
    expect(result.body).toContain('Nitrogen deficiency');
    expect(result.body).toContain('72% confidence');
    expect(result.body).toContain('Looking for a second opinion');
  });

  test('includes sanitized plant details when available', async () => {
    const assessment = createMockAssessment(0.65);
    const plantContext = createMockPlantContext({
      stage: 'vegetative',
      setup_type: 'indoor',
      strain: 'Test Strain',
    });

    const result = await generateCommunityPostPrefill({
      assessment,
      assessmentId: 'assessment-123',
      plantContext,
    });

    expect(result.body).toContain('Stage: vegetative');
    expect(result.body).toContain('Setup: indoor');
    expect(result.body).toContain('Strain: Test Strain');
  });

  test('excludes plant details when not available', async () => {
    const assessment = createMockAssessment(0.65);
    const plantContext = createMockPlantContext();

    const result = await generateCommunityPostPrefill({
      assessment,
      assessmentId: 'assessment-123',
      plantContext,
    });

    expect(result.body).not.toContain('Plant details:');
  });

  test('generates appropriate tags for nutrient category', async () => {
    const assessment = createMockAssessment(0.65);
    const plantContext = createMockPlantContext();

    const result = await generateCommunityPostPrefill({
      assessment,
      assessmentId: 'assessment-123',
      plantContext,
    });

    expect(result.tags).toContain('help-needed');
    expect(result.tags).toContain('ai-assessment');
    expect(result.tags).toContain('nutrient-issue');
    expect(result.tags).toContain('nitrogen-deficiency');
  });

  test('excludes specific class tag for OOD assessment', async () => {
    const assessment = createMockAssessment(0.65, true, 'Unknown');
    const plantContext = createMockPlantContext();

    const result = await generateCommunityPostPrefill({
      assessment,
      assessmentId: 'assessment-123',
      plantContext,
    });

    expect(result.tags).toContain('help-needed');
    expect(result.tags).toContain('ai-assessment');
    expect(result.tags).not.toContain('unknown');
  });

  test('redacts all images with random filenames', async () => {
    const assessment: AssessmentResult = {
      ...createMockAssessment(0.65),
      perImage: [
        {
          id: 'img-1',
          uri: 'file:///test/image1.jpg',
          classId: 'test',
          conf: 0.65,
          quality: { score: 85, acceptable: true, issues: [] },
        },
        {
          id: 'img-2',
          uri: 'file:///test/image2.jpg',
          classId: 'test',
          conf: 0.65,
          quality: { score: 85, acceptable: true, issues: [] },
        },
      ],
    };
    const plantContext = createMockPlantContext();

    const result = await generateCommunityPostPrefill({
      assessment,
      assessmentId: 'assessment-123',
      plantContext,
    });

    expect(result.images).toHaveLength(2);
    expect(mockRedactAssessmentForCommunity).toHaveBeenCalledTimes(2);
    expect(result.images[0].filename).toBe('random-uuid.jpg');
  });

  test('stores assessment ID for tracking', async () => {
    const assessment = createMockAssessment(0.65);
    const plantContext = createMockPlantContext();

    const result = await generateCommunityPostPrefill({
      assessment,
      assessmentId: 'assessment-123',
      plantContext,
    });

    expect(result.sourceAssessmentId).toBe('assessment-123');
  });
});

describe('validatePostPrefill', () => {
  const createValidPrefill = (): CommunityPostPrefill => ({
    title: 'Valid title with enough characters',
    body: 'Valid body with enough characters to pass validation requirements',
    images: [{ uri: 'file:///test.jpg', filename: 'test.jpg', size: 1000 }],
    tags: ['test'],
    sourceAssessmentId: 'test-123',
  });

  test('validates correct prefill data', () => {
    const prefill = createValidPrefill();
    const result = validatePostPrefill(prefill);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('rejects title shorter than 10 characters', () => {
    const prefill = { ...createValidPrefill(), title: 'Short' };
    const result = validatePostPrefill(prefill);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Title must be at least 10 characters');
  });

  test('rejects body shorter than 50 characters', () => {
    const prefill = { ...createValidPrefill(), body: 'Too short' };
    const result = validatePostPrefill(prefill);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Body must be at least 50 characters');
  });

  test('rejects prefill with no images', () => {
    const prefill = { ...createValidPrefill(), images: [] };
    const result = validatePostPrefill(prefill);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('At least one image is required');
  });

  test('rejects prefill with more than 3 images', () => {
    const prefill = {
      ...createValidPrefill(),
      images: [
        { uri: 'file:///1.jpg', filename: '1.jpg', size: 1000 },
        { uri: 'file:///2.jpg', filename: '2.jpg', size: 1000 },
        { uri: 'file:///3.jpg', filename: '3.jpg', size: 1000 },
        { uri: 'file:///4.jpg', filename: '4.jpg', size: 1000 },
      ],
    };
    const result = validatePostPrefill(prefill);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Maximum 3 images allowed');
  });

  test('returns multiple errors when multiple validations fail', () => {
    const prefill = {
      ...createValidPrefill(),
      title: 'Short',
      body: 'Short',
      images: [],
    };
    const result = validatePostPrefill(prefill);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(1);
  });
});
