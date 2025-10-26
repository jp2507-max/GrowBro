/**
 * Playbook Integration Tests
 *
 * Tests playbook adjustment suggestions based on assessment findings.
 */

/* eslint-disable */
// @ts-nocheck
import type {
  AssessmentActionPlan,
  AssessmentPlantContext,
  AssessmentResult,
} from '@/types/assessment';
import type { Playbook } from '@/types/playbook';

import { describe, expect, it, jest } from '@jest/globals';

import { getAssessmentClass } from '../assessment-classes';
import {
  PlaybookIntegrationService,
  playbookIntegrationService,
  suggestPlaybookAdjustments,
} from '../playbook-integration';

describe('PlaybookIntegrationService', () => {
  let service: PlaybookIntegrationService;
  let mockAssessment: AssessmentResult;
  let mockContext: AssessmentPlantContext;
  let mockPlan: AssessmentActionPlan;
  let mockPlaybook: Playbook;

  beforeEach(() => {
    service = new PlaybookIntegrationService();

    // Create mock assessment with nutrient deficiency
    mockAssessment = {
      topClass: getAssessmentClass('nitrogen_deficiency'),
      rawConfidence: 0.85,
      calibratedConfidence: 0.82,
      perImage: [
        {
          id: 'img-1',
          uri: 'file://test.jpg',
          classId: 'nitrogen_deficiency',
          conf: 0.85,
          quality: {
            score: 0.9,
            acceptable: true,
            issues: [],
          },
        },
      ],
      aggregationMethod: 'highest-confidence',
      processingTimeMs: 500,
      mode: 'device',
      modelVersion: 'v1.0.0',
    };

    mockContext = {
      id: 'plant-1',
      metadata: {
        stage: 'veg',
        strain: 'test-strain',
      },
    };

    mockPlan = {
      immediateSteps: [
        {
          title: 'Check pH levels',
          description: 'Monitor pH to ensure proper nutrient uptake',
          timeframe: 'immediate',
          priority: 'high',
        },
      ],
      shortTermActions: [],
      diagnosticChecks: [],
      warnings: [],
      disclaimers: [],
    };

    mockPlaybook = {
      id: 'playbook-1',
      name: 'Test Playbook',
      setup: 'auto_indoor',
      locale: 'en',
      phaseOrder: ['seedling', 'veg', 'flower', 'harvest'],
      steps: [],
      metadata: {},
      isTemplate: false,
      isCommunity: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  });

  describe('suggestAdjustments', () => {
    describe('with assessmentId provided', () => {
      it('should propagate assessmentId in metadata for low confidence assessments', () => {
        const lowConfidenceAssessment = {
          ...mockAssessment,
          calibratedConfidence: 0.6, // Below 0.7 threshold
        };

        const result = service.suggestAdjustments({
          assessment: lowConfidenceAssessment,
          plan: mockPlan,
          context: mockContext,
          assessmentId: 'test-assessment-123',
        });

        expect(result.metadata.assessmentId).toBe('test-assessment-123');
        expect(result.metadata.classId).toBe('nitrogen_deficiency');
        expect(result.metadata.confidence).toBe(0.6);
        expect(result.metadata.suggestedCount).toBe(0);
        expect(result.adjustments).toEqual([]);
      });

      it('should propagate assessmentId in metadata for high confidence assessments', () => {
        const result = service.suggestAdjustments({
          assessment: mockAssessment,
          plan: mockPlan,
          context: mockContext,
          assessmentId: 'test-assessment-456',
        });

        expect(result.metadata.assessmentId).toBe('test-assessment-456');
        expect(result.metadata.classId).toBe('nitrogen_deficiency');
        expect(result.metadata.confidence).toBe(0.82);
        expect(result.metadata.suggestedCount).toBeGreaterThan(0);
        expect(result.adjustments.length).toBeGreaterThan(0);
      });
    });

    describe('without assessmentId provided', () => {
      it('should use empty string for assessmentId in metadata for low confidence assessments', () => {
        const lowConfidenceAssessment = {
          ...mockAssessment,
          calibratedConfidence: 0.6, // Below 0.7 threshold
        };

        const result = service.suggestAdjustments({
          assessment: lowConfidenceAssessment,
          plan: mockPlan,
          context: mockContext,
          // assessmentId not provided
        });

        expect(result.metadata.assessmentId).toBe('');
        expect(result.metadata.classId).toBe('nitrogen_deficiency');
        expect(result.metadata.confidence).toBe(0.6);
        expect(result.metadata.suggestedCount).toBe(0);
        expect(result.adjustments).toEqual([]);
      });

      it('should use empty string for assessmentId in metadata for high confidence assessments', () => {
        const result = service.suggestAdjustments({
          assessment: mockAssessment,
          plan: mockPlan,
          context: mockContext,
          // assessmentId not provided
        });

        expect(result.metadata.assessmentId).toBe('');
        expect(result.metadata.classId).toBe('nitrogen_deficiency');
        expect(result.metadata.confidence).toBe(0.82);
        expect(result.metadata.suggestedCount).toBeGreaterThan(0);
        expect(result.adjustments.length).toBeGreaterThan(0);
      });
    });

    describe('different assessment types', () => {
      it('should generate adjustments for nutrient deficiencies', () => {
        const result = service.suggestAdjustments({
          assessment: mockAssessment,
          plan: mockPlan,
          context: mockContext,
          assessmentId: 'test-123',
        });

        expect(result.adjustments.length).toBeGreaterThan(0);
        expect(result.adjustments.some(adj => adj.impact === 'schedule')).toBe(true);
        expect(result.adjustments.some(adj => adj.impact === 'instructions')).toBe(true);
      });

      it('should generate adjustments for watering issues', () => {
        const wateringAssessment = {
          ...mockAssessment,
          topClass: getAssessmentClass('overwatering'),
        };

        const result = service.suggestAdjustments({
          assessment: wateringAssessment,
          plan: mockPlan,
          context: mockContext,
          assessmentId: 'test-456',
        });

        expect(result.adjustments.length).toBeGreaterThan(0);
        expect(result.adjustments.some(adj => adj.impact === 'schedule')).toBe(true);
        expect(result.adjustments.some(adj => adj.suggestedDaysDelta === 1)).toBe(true);
      });

      it('should generate adjustments for pest issues', () => {
        const pestAssessment = {
          ...mockAssessment,
          topClass: getAssessmentClass('spider_mites'),
        };

        const result = service.suggestAdjustments({
          assessment: pestAssessment,
          plan: mockPlan,
          context: mockContext,
          assessmentId: 'test-789',
        });

        expect(result.adjustments.length).toBeGreaterThan(0);
        expect(result.adjustments.some(adj => adj.impact === 'schedule')).toBe(true);
        expect(result.adjustments.some(adj => adj.suggestedDaysDelta === 7)).toBe(true);
      });

      it('should not generate adjustments for healthy plants', () => {
        const healthyAssessment = {
          ...mockAssessment,
          topClass: getAssessmentClass('healthy'),
        };

        const result = service.suggestAdjustments({
          assessment: healthyAssessment,
          plan: mockPlan,
          context: mockContext,
          assessmentId: 'test-healthy',
        });

        expect(result.adjustments).toEqual([]);
        expect(result.metadata.suggestedCount).toBe(0);
      });

      it('should not generate adjustments for OOD/unknown classes', () => {
        const unknownAssessment = {
          ...mockAssessment,
          topClass: getAssessmentClass('unknown'),
        };

        const result = service.suggestAdjustments({
          assessment: unknownAssessment,
          plan: mockPlan,
          context: mockContext,
          assessmentId: 'test-unknown',
        });

        expect(result.adjustments).toEqual([]);
        expect(result.metadata.suggestedCount).toBe(0);
      });
    });

    describe('stage-specific adjustments', () => {
      it('should include stage-specific adjustments when stage metadata is available', () => {
        const result = service.suggestAdjustments({
          assessment: mockAssessment,
          plan: mockPlan,
          context: mockContext,
          assessmentId: 'test-stage',
        });

        expect(result.adjustments.length).toBeGreaterThan(0);
        // Should include stage-specific adjustments for veg stage
        expect(result.adjustments.some(adj =>
          adj.description.includes('reduced strength')
        )).toBe(true);
      });

      it('should not include stage-specific adjustments when stage metadata is missing', () => {
        const contextWithoutStage = {
          ...mockContext,
          metadata: {
            strain: 'test-strain',
            // stage not provided
          },
        };

        const result = service.suggestAdjustments({
          assessment: mockAssessment,
          plan: mockPlan,
          context: contextWithoutStage,
          assessmentId: 'test-no-stage',
        });

        // Should still generate basic adjustments
        expect(result.adjustments.length).toBeGreaterThan(0);
        // Should not include stage-specific adjustments
        expect(result.adjustments.some(adj =>
          adj.description.includes('reduced strength')
        )).toBe(false);
      });
    });
  });

  describe('shouldSuggestAdjustments', () => {
    it('should return false for healthy assessments', () => {
      const healthyAssessment = {
        ...mockAssessment,
        topClass: getAssessmentClass('healthy'),
      };

      const shouldSuggest = service.shouldSuggestAdjustments(healthyAssessment);
      expect(shouldSuggest).toBe(false);
    });

    it('should return false for low confidence assessments', () => {
      const lowConfidenceAssessment = {
        ...mockAssessment,
        calibratedConfidence: 0.6,
      };

      const shouldSuggest = service.shouldSuggestAdjustments(lowConfidenceAssessment);
      expect(shouldSuggest).toBe(false);
    });

    it('should return false for OOD assessments', () => {
      const oodAssessment = {
        ...mockAssessment,
        topClass: getAssessmentClass('unknown'),
      };

      const shouldSuggest = service.shouldSuggestAdjustments(oodAssessment);
      expect(shouldSuggest).toBe(false);
    });

    it('should return true for high confidence non-healthy assessments', () => {
      const shouldSuggest = service.shouldSuggestAdjustments(mockAssessment);
      expect(shouldSuggest).toBe(true);
    });
  });
});

describe('suggestPlaybookAdjustments (convenience function)', () => {
  it('should work with assessmentId provided', () => {
    const result = suggestPlaybookAdjustments({
      assessment: mockAssessment,
      plan: mockPlan,
      context: mockContext,
      assessmentId: 'convenience-test-123',
    });

    expect(result.metadata.assessmentId).toBe('convenience-test-123');
    expect(result.adjustments.length).toBeGreaterThan(0);
  });

  it('should work without assessmentId provided', () => {
    const result = suggestPlaybookAdjustments({
      assessment: mockAssessment,
      plan: mockPlan,
      context: mockContext,
      // assessmentId not provided
    });

    expect(result.metadata.assessmentId).toBe('');
    expect(result.adjustments.length).toBeGreaterThan(0);
  });

  it('should return same result as service method', () => {
    const options = {
      assessment: mockAssessment,
      plan: mockPlan,
      context: mockContext,
      assessmentId: 'comparison-test',
    };

    const serviceResult = playbookIntegrationService.suggestAdjustments(options);
    const convenienceResult = suggestPlaybookAdjustments(options);

    expect(convenienceResult).toEqual(serviceResult);
  });
});
