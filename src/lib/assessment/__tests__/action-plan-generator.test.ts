/**
 * Action Plan Generator Tests
 *
 * Tests action plan generation with safety guardrails and contextual adjustments.
 */

import type {
  AssessmentPlantContext,
  AssessmentResult,
} from '@/types/assessment';

import {
  ActionPlanGenerator,
  generateActionPlan,
} from '../action-plan-generator';
import { getActionPlanTemplate } from '../action-plan-templates';
import { getAssessmentClass } from '../assessment-classes';

describe('ActionPlanGenerator', () => {
  let generator: ActionPlanGenerator;

  beforeEach(() => {
    generator = new ActionPlanGenerator();
  });

  describe('generatePlan', () => {
    it('should generate plan for healthy assessment', () => {
      const assessment: AssessmentResult = {
        topClass: getAssessmentClass('healthy'),
        rawConfidence: 0.95,
        calibratedConfidence: 0.92,
        perImage: [],
        aggregationMethod: 'majority-vote',
        processingTimeMs: 500,
        mode: 'device',
        modelVersion: 'v1.0.0',
      };

      const context: AssessmentPlantContext = {
        id: 'plant-1',
      };

      const plan = generator.generatePlan(assessment, context);

      expect(plan).toBeDefined();
      expect(plan.immediateSteps.length).toBeGreaterThan(0);
      expect(plan.disclaimers.length).toBeGreaterThan(0);
      expect(plan.immediateSteps[0].title).toContain('Continue');
    });

    it('should generate plan for nitrogen deficiency', () => {
      const assessment: AssessmentResult = {
        topClass: getAssessmentClass('nitrogen_deficiency'),
        rawConfidence: 0.88,
        calibratedConfidence: 0.85,
        perImage: [],
        aggregationMethod: 'majority-vote',
        processingTimeMs: 600,
        mode: 'device',
        modelVersion: 'v1.0.0',
      };

      const context: AssessmentPlantContext = {
        id: 'plant-1',
      };

      const plan = generator.generatePlan(assessment, context);

      expect(plan).toBeDefined();
      expect(plan.diagnosticChecks.length).toBeGreaterThan(0);
      expect(plan.warnings.length).toBeGreaterThan(0);
      expect(
        plan.diagnosticChecks.some((check) => check.id === 'ph_check')
      ).toBe(true);
    });

    it('should add low confidence warning for confidence < 0.70', () => {
      const assessment: AssessmentResult = {
        topClass: getAssessmentClass('potassium_deficiency'),
        rawConfidence: 0.68,
        calibratedConfidence: 0.65,
        perImage: [],
        aggregationMethod: 'highest-confidence',
        processingTimeMs: 550,
        mode: 'cloud',
        modelVersion: 'v1.0.0',
      };

      const context: AssessmentPlantContext = {
        id: 'plant-1',
      };

      const plan = generator.generatePlan(assessment, context);

      expect(plan.warnings.length).toBeGreaterThan(0);
      expect(plan.warnings[0]).toContain('confidence is below 70%');
    });

    it('should apply contextual adjustments for young plants', () => {
      const assessment: AssessmentResult = {
        topClass: getAssessmentClass('nitrogen_deficiency'),
        rawConfidence: 0.82,
        calibratedConfidence: 0.8,
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

      const plan = generator.generatePlan(assessment, context);

      expect(
        plan.warnings.some((w) => w.includes('Young plants are sensitive'))
      ).toBe(true);
    });

    it('should apply contextual adjustments for hydro setup', () => {
      const assessment: AssessmentResult = {
        topClass: getAssessmentClass('overwatering'),
        rawConfidence: 0.85,
        calibratedConfidence: 0.83,
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

      const plan = generator.generatePlan(assessment, context);

      expect(
        plan.immediateSteps.some((step) =>
          step.title.includes('hydroponic system')
        )
      ).toBe(true);
    });

    it('should apply contextual adjustments for outdoor pests', () => {
      const assessment: AssessmentResult = {
        topClass: getAssessmentClass('spider_mites'),
        rawConfidence: 0.9,
        calibratedConfidence: 0.88,
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

      const plan = generator.generatePlan(assessment, context);

      expect(
        plan.shortTermActions.some((action) =>
          action.description.includes('Outdoor')
        )
      ).toBe(true);
    });
  });

  describe('validatePlan', () => {
    it('should validate plan with disclaimers', () => {
      const template = getActionPlanTemplate('healthy');
      const isValid = generator.validatePlan(template);

      expect(isValid).toBe(true);
    });

    it('should reject plan without disclaimers', () => {
      const invalidPlan = {
        immediateSteps: [],
        shortTermActions: [],
        diagnosticChecks: [],
        warnings: [],
        disclaimers: [],
      };

      const isValid = generator.validatePlan(invalidPlan);

      expect(isValid).toBe(false);
    });

    it('should require diagnostic checks for corrective actions', () => {
      const planWithCorrectiveAction = {
        immediateSteps: [
          {
            title: 'Adjust pH levels',
            description: 'Adjust pH to optimal range',
            timeframe: '0-24 hours',
            priority: 'high' as const,
          },
        ],
        shortTermActions: [],
        diagnosticChecks: [],
        warnings: [],
        disclaimers: ['Disclaimer'],
      };

      const isValid = generator.validatePlan(planWithCorrectiveAction);

      expect(isValid).toBe(false);
    });

    it('should pass validation for corrective actions with diagnostic checks', () => {
      const template = getActionPlanTemplate('nitrogen_deficiency');
      const isValid = generator.validatePlan(template);

      expect(isValid).toBe(true);
    });
  });

  describe('generateActionPlan (convenience function)', () => {
    it('should generate plan using convenience function', () => {
      const assessment: AssessmentResult = {
        topClass: getAssessmentClass('healthy'),
        rawConfidence: 0.95,
        calibratedConfidence: 0.92,
        perImage: [],
        aggregationMethod: 'majority-vote',
        processingTimeMs: 500,
        mode: 'device',
        modelVersion: 'v1.0.0',
      };

      const context: AssessmentPlantContext = {
        id: 'plant-1',
      };

      const plan = generateActionPlan(assessment, context);

      expect(plan).toBeDefined();
      expect(plan.disclaimers.length).toBeGreaterThan(0);
    });
  });

  describe('all assessment classes', () => {
    const classIds = [
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

    it.each(classIds)(
      'should generate valid plan for %s',
      (classId: string) => {
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

        const plan = generator.generatePlan(assessment, context);

        expect(plan).toBeDefined();
        expect(plan.disclaimers.length).toBeGreaterThan(0);
        expect(generator.validatePlan(plan)).toBe(true);
      }
    );
  });
});
