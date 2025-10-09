/**
 * Harvest Accessibility Label Tests
 *
 * Tests for harvest-specific accessibility label generators
 */

import {
  createHarvestHistoryA11yLabel,
  createHarvestStageA11yLabel,
  createStageActionA11yHint,
  createStageActionA11yLabel,
  createStageProgressA11yLabel,
  createWeightInputA11yLabel,
} from '../labels';

describe('Harvest Accessibility Labels', () => {
  describe('createHarvestStageA11yLabel', () => {
    it('should create label for current stage', () => {
      const label = createHarvestStageA11yLabel({
        stage: 'Drying',
        isCompleted: false,
        isCurrent: true,
      });
      expect(label).toBe('Drying - current stage');
    });

    it('should create label for completed stage', () => {
      const label = createHarvestStageA11yLabel({
        stage: 'Harvest',
        isCompleted: true,
        isCurrent: false,
      });
      expect(label).toBe('Harvest - completed');
    });

    it('should create label for upcoming stage', () => {
      const label = createHarvestStageA11yLabel({
        stage: 'Curing',
        isCompleted: false,
        isCurrent: false,
      });
      expect(label).toBe('Curing - upcoming');
    });
  });

  describe('createWeightInputA11yLabel', () => {
    it('should create label without value', () => {
      const label = createWeightInputA11yLabel({
        fieldName: 'Wet Weight',
        unit: 'g',
      });
      expect(label).toBe('Wet Weight input');
    });

    it('should create label with value', () => {
      const label = createWeightInputA11yLabel({
        fieldName: 'Dry Weight',
        unit: 'oz',
        value: 2.5,
      });
      expect(label).toBe('Dry Weight input, current value: 2.5 oz');
    });

    it('should handle zero value', () => {
      const label = createWeightInputA11yLabel({
        fieldName: 'Trimmings Weight',
        unit: 'g',
        value: 0,
      });
      expect(label).toBe('Trimmings Weight input, current value: 0 g');
    });
  });

  describe('createStageActionA11yLabel', () => {
    it('should create label for advance action', () => {
      const label = createStageActionA11yLabel({
        action: 'advance',
        targetStage: 'Curing',
      });
      expect(label).toBe('Advance to Curing stage');
    });

    it('should create label for undo action without seconds', () => {
      const label = createStageActionA11yLabel({
        action: 'undo',
      });
      expect(label).toBe('Undo last stage change');
    });

    it('should create label for undo action with seconds', () => {
      const label = createStageActionA11yLabel({
        action: 'undo',
        undoSeconds: 12,
      });
      expect(label).toBe('Undo last stage change (12s remaining)');
    });

    it('should create label for revert action', () => {
      const label = createStageActionA11yLabel({
        action: 'revert',
      });
      expect(label).toBe('Revert to previous stage');
    });

    it('should create label for override action', () => {
      const label = createStageActionA11yLabel({
        action: 'override',
      });
      expect(label).toBe('Skip to later stage');
    });
  });

  describe('createStageActionA11yHint', () => {
    it('should create hint for advance action', () => {
      const hint = createStageActionA11yHint({
        action: 'advance',
        targetStage: 'Drying',
      });
      expect(hint).toBe('Double-tap to advance to Drying stage');
    });

    it('should create hint for undo action', () => {
      const hint = createStageActionA11yHint({
        action: 'undo',
      });
      expect(hint).toBe('Double-tap to undo last stage change');
    });

    it('should create hint for revert action', () => {
      const hint = createStageActionA11yHint({
        action: 'revert',
      });
      expect(hint).toBe('Double-tap to revert to previous stage');
    });

    it('should create hint for override action', () => {
      const hint = createStageActionA11yHint({
        action: 'override',
      });
      expect(hint).toBe('Double-tap to skip to a later stage');
    });
  });

  describe('createHarvestHistoryA11yLabel', () => {
    it('should create label with minimal info', () => {
      const label = createHarvestHistoryA11yLabel({
        stage: 'Harvest',
        updatedAt: '2 hours ago',
        hasConflict: false,
      });
      expect(label).toBe('Harvest in Harvest stage, updated 2 hours ago');
    });

    it('should create label with dry weight', () => {
      const label = createHarvestHistoryA11yLabel({
        stage: 'Curing',
        updatedAt: '1 day ago',
        dryWeight: 150,
        hasConflict: false,
      });
      expect(label).toBe(
        'Harvest in Curing stage, updated 1 day ago, dry weight 150 grams'
      );
    });

    it('should create label with conflict', () => {
      const label = createHarvestHistoryA11yLabel({
        stage: 'Drying',
        updatedAt: 'just now',
        hasConflict: true,
      });
      expect(label).toBe(
        'Harvest in Drying stage, updated just now, needs review'
      );
    });

    it('should create label with all info', () => {
      const label = createHarvestHistoryA11yLabel({
        stage: 'Inventory',
        updatedAt: '3 days ago',
        dryWeight: 200,
        hasConflict: true,
      });
      expect(label).toBe(
        'Harvest in Inventory stage, updated 3 days ago, dry weight 200 grams, needs review'
      );
    });
  });

  describe('createStageProgressA11yLabel', () => {
    it('should create label for initial stage', () => {
      const label = createStageProgressA11yLabel({
        currentStage: 'Harvest',
        totalStages: 4,
        completedStages: 0,
      });
      expect(label).toBe(
        'Harvest progress: Harvest stage, 0 of 4 stages completed'
      );
    });

    it('should create label for mid-progress', () => {
      const label = createStageProgressA11yLabel({
        currentStage: 'Drying',
        totalStages: 4,
        completedStages: 1,
      });
      expect(label).toBe(
        'Harvest progress: Drying stage, 1 of 4 stages completed'
      );
    });

    it('should create label for final stage', () => {
      const label = createStageProgressA11yLabel({
        currentStage: 'Inventory',
        totalStages: 4,
        completedStages: 3,
      });
      expect(label).toBe(
        'Harvest progress: Inventory stage, 3 of 4 stages completed'
      );
    });
  });
});
