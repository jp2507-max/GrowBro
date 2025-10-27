/**
 * End-to-End Assessment Flow Integration Tests
 *
 * Tests the complete assessment flow: capture → quality → inference → results → actions
 * Requirements: 2.1, 3.4, 7.1, 9.4
 */

import type {
  AssessmentPlantContext,
  AssessmentResult,
  CapturedPhoto,
} from '@/types/assessment';

import { ActionPlanGenerator } from '../../action-plan-generator';
import { getAssessmentClass } from '../../assessment-classes';
import { calibrateMultiplePredictions } from '../../confidence-calibration';

// Mock quality assessment
jest.mock('@/lib/quality/engine', () => ({
  assessData: jest.fn().mockResolvedValue({
    score: 85,
    issues: [],
    acceptable: true,
  }),
}));

describe('E2E Assessment Flow Integration', () => {
  let actionPlanGenerator: ActionPlanGenerator;

  beforeEach(() => {
    actionPlanGenerator = new ActionPlanGenerator();
    jest.clearAllMocks();
  });

  describe('complete assessment flow', () => {
    it('should process assessment from capture to action plan', async () => {
      // Step 1: Simulate captured photos
      const capturedPhotos: CapturedPhoto[] = [
        {
          id: 'photo-1',
          uri: 'file:///test/photo1.jpg',
          timestamp: Date.now(),
          qualityScore: {
            score: 85,
            issues: [],
            acceptable: true,
          },
          metadata: {
            width: 1920,
            height: 1080,
            gps: null,
          },
        },
        {
          id: 'photo-2',
          uri: 'file:///test/photo2.jpg',
          timestamp: Date.now(),
          qualityScore: {
            score: 88,
            issues: [],
            acceptable: true,
          },
          metadata: {
            width: 1920,
            height: 1080,
            gps: null,
          },
        },
      ];

      // Step 2: Simulate ML inference results
      const predictions = [
        { classId: 'nitrogen_deficiency', rawConfidence: 0.85 },
        { classId: 'nitrogen_deficiency', rawConfidence: 0.88 },
      ];

      // Step 3: Calibrate and aggregate results
      const calibrationResult = calibrateMultiplePredictions(predictions);

      expect(calibrationResult.classId).toBe('nitrogen_deficiency');
      expect(calibrationResult.isConfident).toBe(true);
      expect(calibrationResult.aggregationMethod).toBe('majority-vote');

      // Step 4: Build assessment result
      const assessmentResult: AssessmentResult = {
        topClass: getAssessmentClass(calibrationResult.classId ?? 'unknown'),
        rawConfidence: calibrationResult.rawConfidence,
        calibratedConfidence: calibrationResult.calibratedConfidence,
        perImage: capturedPhotos.map((photo, idx) => ({
          id: photo.id,
          uri: photo.uri,
          classId: predictions[idx].classId,
          conf: predictions[idx].rawConfidence,
          quality: photo.qualityScore,
        })),
        aggregationMethod: calibrationResult.aggregationMethod,
        processingTimeMs: 450,
        mode: 'device',
        modelVersion: 'v1.0.0',
      };

      // Step 5: Generate action plan
      const context: AssessmentPlantContext = {
        id: 'plant-1',
        metadata: {
          stage: 'vegetative',
          setup_type: 'indoor',
        },
      };

      const actionPlan = actionPlanGenerator.generatePlan(
        assessmentResult,
        context
      );

      // Verify complete flow
      expect(actionPlan).toBeDefined();
      expect(actionPlan.immediateSteps.length).toBeGreaterThan(0);
      expect(actionPlan.diagnosticChecks.length).toBeGreaterThan(0);
      expect(actionPlan.disclaimers.length).toBeGreaterThan(0);

      // Verify diagnostic checks are present for corrective actions
      const hasPhCheck = actionPlan.diagnosticChecks.some(
        (check) => check.id === 'ph_check'
      );
      expect(hasPhCheck).toBe(true);
    });

    it('should handle low confidence results with community CTA', async () => {
      const capturedPhotos: CapturedPhoto[] = [
        {
          id: 'photo-1',
          uri: 'file:///test/photo1.jpg',
          timestamp: Date.now(),
          qualityScore: {
            score: 75,
            issues: [],
            acceptable: true,
          },
          metadata: {
            width: 1920,
            height: 1080,
            gps: null,
          },
        },
      ];

      // Low confidence predictions
      const predictions = [
        { classId: 'potassium_deficiency', rawConfidence: 0.65 },
      ];

      const calibrationResult = calibrateMultiplePredictions(predictions);

      expect(calibrationResult.isConfident).toBe(false);

      const assessmentResult: AssessmentResult = {
        topClass: getAssessmentClass(calibrationResult.classId ?? 'unknown'),
        rawConfidence: calibrationResult.rawConfidence,
        calibratedConfidence: calibrationResult.calibratedConfidence,
        perImage: capturedPhotos.map((photo) => ({
          id: photo.id,
          uri: photo.uri,
          classId: predictions[0].classId,
          conf: predictions[0].rawConfidence,
          quality: photo.qualityScore,
        })),
        aggregationMethod: 'highest-confidence',
        processingTimeMs: 420,
        mode: 'device',
        modelVersion: 'v1.0.0',
      };

      const context: AssessmentPlantContext = {
        id: 'plant-1',
      };

      const actionPlan = actionPlanGenerator.generatePlan(
        assessmentResult,
        context
      );

      // Should include low confidence warning
      const hasLowConfidenceWarning = actionPlan.warnings.some((w) =>
        w.includes('confidence is below 70%')
      );
      expect(hasLowConfidenceWarning).toBe(true);
    });

    it('should handle multi-photo aggregation with majority vote', async () => {
      const predictions = [
        { classId: 'healthy', rawConfidence: 0.9 },
        { classId: 'healthy', rawConfidence: 0.88 },
        { classId: 'nitrogen_deficiency', rawConfidence: 0.75 },
      ];

      const result = calibrateMultiplePredictions(predictions);

      expect(result.classId).toBe('healthy');
      expect(result.aggregationMethod).toBe('majority-vote');
      expect(result.isConfident).toBe(true);
    });

    it('should handle multi-photo aggregation with highest confidence on tie', async () => {
      const predictions = [
        { classId: 'healthy', rawConfidence: 0.75 },
        { classId: 'nitrogen_deficiency', rawConfidence: 0.9 },
      ];

      const result = calibrateMultiplePredictions(predictions);

      expect(result.classId).toBe('nitrogen_deficiency');
      expect(result.aggregationMethod).toBe('highest-confidence');
    });

    it('should mark as unknown when all predictions below threshold', async () => {
      const predictions = [
        { classId: 'healthy', rawConfidence: 0.5 },
        { classId: 'nitrogen_deficiency', rawConfidence: 0.55 },
        { classId: 'potassium_deficiency', rawConfidence: 0.48 },
      ];

      const result = calibrateMultiplePredictions(predictions);

      expect(result.isConfident).toBe(false);
      expect(result.calibratedConfidence).toBeLessThan(0.7);
    });
  });

  describe('contextual action plan generation', () => {
    it('should adapt action plan for young plants', () => {
      const assessment: AssessmentResult = {
        topClass: getAssessmentClass('nitrogen_deficiency'),
        rawConfidence: 0.85,
        calibratedConfidence: 0.82,
        perImage: [],
        aggregationMethod: 'majority-vote',
        processingTimeMs: 500,
        mode: 'device',
        modelVersion: 'v1.0.0',
      };

      const context: AssessmentPlantContext = {
        id: 'plant-1',
        metadata: {
          stage: 'seedling',
        },
      };

      const plan = actionPlanGenerator.generatePlan(assessment, context);

      const hasSeedlingWarning = plan.warnings.some((w) =>
        w.includes('Young plants are sensitive')
      );
      expect(hasSeedlingWarning).toBe(true);
    });

    it('should adapt action plan for hydroponic setup', () => {
      const assessment: AssessmentResult = {
        topClass: getAssessmentClass('overwatering'),
        rawConfidence: 0.88,
        calibratedConfidence: 0.85,
        perImage: [],
        aggregationMethod: 'majority-vote',
        processingTimeMs: 480,
        mode: 'device',
        modelVersion: 'v1.0.0',
      };

      const context: AssessmentPlantContext = {
        id: 'plant-1',
        metadata: {
          setup_type: 'hydro',
        },
      };

      const plan = actionPlanGenerator.generatePlan(assessment, context);

      const hasHydroGuidance = plan.immediateSteps.some((step) =>
        step.title.includes('hydroponic system')
      );
      expect(hasHydroGuidance).toBe(true);
    });

    it('should adapt action plan for outdoor pests', () => {
      const assessment: AssessmentResult = {
        topClass: getAssessmentClass('spider_mites'),
        rawConfidence: 0.92,
        calibratedConfidence: 0.9,
        perImage: [],
        aggregationMethod: 'majority-vote',
        processingTimeMs: 520,
        mode: 'device',
        modelVersion: 'v1.0.0',
      };

      const context: AssessmentPlantContext = {
        id: 'plant-1',
        metadata: {
          setup_type: 'outdoor',
        },
      };

      const plan = actionPlanGenerator.generatePlan(assessment, context);

      const hasOutdoorGuidance = plan.shortTermActions.some((action) =>
        action.description.includes('Outdoor')
      );
      expect(hasOutdoorGuidance).toBe(true);
    });
  });

  describe('performance requirements', () => {
    it('should complete assessment flow within latency budget', async () => {
      const startTime = Date.now();

      // Simulate full flow
      const predictions = [
        { classId: 'healthy', rawConfidence: 0.9 },
        { classId: 'healthy', rawConfidence: 0.88 },
      ];

      const calibrationResult = calibrateMultiplePredictions(predictions);

      const assessmentResult: AssessmentResult = {
        topClass: getAssessmentClass(calibrationResult.classId ?? 'unknown'),
        rawConfidence: calibrationResult.rawConfidence,
        calibratedConfidence: calibrationResult.calibratedConfidence,
        perImage: [],
        aggregationMethod: calibrationResult.aggregationMethod,
        processingTimeMs: 450,
        mode: 'device',
        modelVersion: 'v1.0.0',
      };

      const context: AssessmentPlantContext = {
        id: 'plant-1',
      };

      const actionPlan = actionPlanGenerator.generatePlan(
        assessmentResult,
        context
      );

      const duration = Date.now() - startTime;

      expect(actionPlan).toBeDefined();
      expect(duration).toBeLessThan(100); // Post-inference processing should be fast
    });
  });

  describe('safety guardrails', () => {
    it('should include diagnostic checks for all corrective actions', () => {
      const nutrientDeficiencies = [
        'nitrogen_deficiency',
        'phosphorus_deficiency',
        'potassium_deficiency',
        'magnesium_deficiency',
        'calcium_deficiency',
      ];

      nutrientDeficiencies.forEach((classId) => {
        const assessment: AssessmentResult = {
          topClass: getAssessmentClass(classId),
          rawConfidence: 0.85,
          calibratedConfidence: 0.82,
          perImage: [],
          aggregationMethod: 'majority-vote',
          processingTimeMs: 500,
          mode: 'device',
          modelVersion: 'v1.0.0',
        };

        const context: AssessmentPlantContext = {
          id: 'plant-1',
        };

        const plan = actionPlanGenerator.generatePlan(assessment, context);

        expect(plan.diagnosticChecks.length).toBeGreaterThan(0);
        expect(actionPlanGenerator.validatePlan(plan)).toBe(true);
      });
    });

    it('should always include disclaimers', () => {
      const allClasses = [
        'healthy',
        'unknown',
        'nitrogen_deficiency',
        'phosphorus_deficiency',
        'potassium_deficiency',
        'magnesium_deficiency',
        'calcium_deficiency',
        'overwatering',
        'underwatering',
        'light_burn',
        'spider_mites',
        'powdery_mildew',
      ];

      allClasses.forEach((classId) => {
        const assessment: AssessmentResult = {
          topClass: getAssessmentClass(classId),
          rawConfidence: 0.85,
          calibratedConfidence: 0.82,
          perImage: [],
          aggregationMethod: 'majority-vote',
          processingTimeMs: 500,
          mode: 'device',
          modelVersion: 'v1.0.0',
        };

        const context: AssessmentPlantContext = {
          id: 'plant-1',
        };

        const plan = actionPlanGenerator.generatePlan(assessment, context);

        expect(plan.disclaimers.length).toBeGreaterThan(0);
      });
    });
  });
});
