/**
 * Tests for harvest data redaction utilities
 * Requirements: 18.4 (redact private data appropriately)
 */

import { type Harvest, HarvestStages } from '@/types/harvest';

import {
  createHarvestSharingSummary,
  redactHarvest,
  validateRedaction,
  validateSummaryRedaction,
} from '../harvest-redaction';

describe('Harvest Redaction', () => {
  const mockHarvest: Harvest = {
    id: 'harvest-123',
    plant_id: 'plant-456',
    user_id: 'user-789',
    stage: HarvestStages.DRYING,
    wet_weight_g: 500,
    dry_weight_g: 125,
    trimmings_weight_g: 50,
    notes: 'PII: John Doe, 123 Main St, email@example.com',
    stage_started_at: new Date('2025-01-01T00:00:00Z'),
    stage_completed_at: new Date('2025-01-08T00:00:00Z'),
    photos: [
      {
        variant: 'thumbnail',
        localUri: 'file:///storage/photo1.jpg',
        remotePath: undefined,
      },
      {
        variant: 'full',
        localUri: 'file:///storage/photo2.jpg',
        remotePath: undefined,
      },
    ],
    created_at: new Date('2025-01-01T00:00:00Z'),
    updated_at: new Date('2025-01-08T00:00:00Z'),
    deleted_at: null,
    conflict_seen: false,
  };

  describe('redactHarvest', () => {
    it('should remove all PII fields', () => {
      const redacted = redactHarvest(mockHarvest);

      // Sensitive fields should not be present
      expect('id' in redacted).toBe(false);
      expect('user_id' in redacted).toBe(false);
      expect('plant_id' in redacted).toBe(false);
      expect('notes' in redacted).toBe(false);
      expect('photos' in redacted).toBe(false);
    });

    it('should preserve analytical weight fields', () => {
      const redacted = redactHarvest(mockHarvest);

      expect(redacted.wet_weight_g).toBe(500);
      expect(redacted.dry_weight_g).toBe(125);
      expect(redacted.trimmings_weight_g).toBe(50);
    });

    it('should preserve stage and timing information', () => {
      const redacted = redactHarvest(mockHarvest);

      expect(redacted.stage).toBe(HarvestStages.DRYING);
      expect(redacted.stage_started_at).toEqual(
        new Date('2025-01-01T00:00:00Z')
      );
      expect(redacted.stage_completed_at).toEqual(
        new Date('2025-01-08T00:00:00Z')
      );
      expect(redacted.created_at).toEqual(new Date('2025-01-01T00:00:00Z'));
    });

    it('should include aggregated photo metrics without URIs', () => {
      const redacted = redactHarvest(mockHarvest);

      expect(redacted.has_photos).toBe(true);
      expect(redacted.photo_count).toBe(2);
    });

    it('should calculate duration in days', () => {
      const redacted = redactHarvest(mockHarvest);

      expect(redacted.duration_days).toBe(7);
    });

    it('should include redaction metadata', () => {
      const redacted = redactHarvest(mockHarvest);

      expect(redacted.redacted_at).toBeInstanceOf(Date);
      expect(redacted.redaction_version).toBe('1.0.0');
    });

    it('should handle harvest without photos', () => {
      const harvestNoPhotos = { ...mockHarvest, photos: [] };
      const redacted = redactHarvest(harvestNoPhotos);

      expect(redacted.has_photos).toBe(false);
      expect(redacted.photo_count).toBe(0);
    });

    it('should handle incomplete stages', () => {
      const incompleteHarvest = {
        ...mockHarvest,
        stage_completed_at: null,
      };
      const redacted = redactHarvest(incompleteHarvest);

      expect(redacted.stage_completed_at).toBeNull();
      expect(redacted.duration_days).toBeNull();
    });

    it('should handle null weights', () => {
      const nullWeights = {
        ...mockHarvest,
        wet_weight_g: null,
        dry_weight_g: null,
        trimmings_weight_g: null,
      };
      const redacted = redactHarvest(nullWeights);

      expect(redacted.wet_weight_g).toBeNull();
      expect(redacted.dry_weight_g).toBeNull();
      expect(redacted.trimmings_weight_g).toBeNull();
    });
  });

  describe('validateRedaction', () => {
    it('should pass validation for properly redacted harvest', () => {
      const redacted = redactHarvest(mockHarvest);
      const isValid = validateRedaction(redacted);

      expect(isValid).toBe(true);
    });

    it('should fail if sensitive fields are present', () => {
      const redacted = redactHarvest(mockHarvest);
      // Inject PII field
      const tainted = { ...redacted, user_id: 'user-789' } as any;

      const isValid = validateRedaction(tainted);

      expect(isValid).toBe(false);
    });

    it('should fail if redaction metadata is missing', () => {
      const redacted = redactHarvest(mockHarvest);
      // Remove metadata
      const incomplete = { ...redacted, redacted_at: undefined } as any;

      const isValid = validateRedaction(incomplete);

      expect(isValid).toBe(false);
    });
  });

  describe('createHarvestSharingSummary', () => {
    const mockHarvests: Harvest[] = [
      {
        ...mockHarvest,
        id: 'harvest-1',
        stage: HarvestStages.CURING,
        wet_weight_g: 400,
        dry_weight_g: 100,
        stage_completed_at: new Date('2025-01-07T00:00:00Z'),
        created_at: new Date('2025-01-01T00:00:00Z'),
      },
      {
        ...mockHarvest,
        id: 'harvest-2',
        stage: HarvestStages.DRYING,
        wet_weight_g: 500,
        dry_weight_g: 125,
        stage_completed_at: new Date('2025-01-10T00:00:00Z'),
        created_at: new Date('2025-01-03T00:00:00Z'),
      },
      {
        ...mockHarvest,
        id: 'harvest-3',
        stage: HarvestStages.INVENTORY,
        wet_weight_g: 600,
        dry_weight_g: 150,
        stage_completed_at: new Date('2025-01-14T00:00:00Z'),
        created_at: new Date('2025-01-05T00:00:00Z'),
      },
    ];

    it('should aggregate total harvests', () => {
      const summary = createHarvestSharingSummary(mockHarvests);

      expect(summary.total_harvests).toBe(3);
    });

    it('should calculate total weight (prefer dry)', () => {
      const summary = createHarvestSharingSummary(mockHarvests);

      expect(summary.total_weight_g).toBe(100 + 125 + 150);
    });

    it('should calculate average duration', () => {
      const summary = createHarvestSharingSummary(mockHarvests);

      // (6 days + 7 days + 9 days) / 3 = 7.33 days (floored durations)
      expect(summary.avg_duration_days).toBeCloseTo(7.33, 2);
    });

    it('should count stages', () => {
      const summary = createHarvestSharingSummary(mockHarvests);

      expect(summary.stages_completed.curing).toBe(1);
      expect(summary.stages_completed.drying).toBe(1);
      expect(summary.stages_completed.inventory).toBe(1);
      expect(summary.stages_completed.harvest).toBe(0);
    });

    it('should aggregate photo counts', () => {
      const summary = createHarvestSharingSummary(mockHarvests);

      // Each harvest has 2 photos
      expect(summary.photo_count).toBe(6);
    });

    it('should calculate date range', () => {
      const summary = createHarvestSharingSummary(mockHarvests);

      expect(summary.date_range.earliest).toEqual(
        new Date('2025-01-01T00:00:00Z')
      );
      expect(summary.date_range.latest).toEqual(
        new Date('2025-01-05T00:00:00Z')
      );
    });

    it('should include redaction metadata', () => {
      const summary = createHarvestSharingSummary(mockHarvests);

      expect(summary.redacted_at).toBeInstanceOf(Date);
      expect(summary.redaction_version).toBe('1.0.0');
    });

    it('should handle empty harvest list', () => {
      const summary = createHarvestSharingSummary([]);

      expect(summary.total_harvests).toBe(0);
      expect(summary.total_weight_g).toBe(0);
      expect(summary.avg_duration_days).toBeNull();
      expect(summary.photo_count).toBe(0);
    });

    it('should handle harvests with null dry weights', () => {
      const harvestsNullDry: Harvest[] = [
        { ...mockHarvest, dry_weight_g: null, wet_weight_g: 400 },
        { ...mockHarvest, dry_weight_g: null, wet_weight_g: 500 },
      ];

      const summary = createHarvestSharingSummary(harvestsNullDry);

      // Should fallback to wet weights
      expect(summary.total_weight_g).toBe(400 + 500);
    });

    it('should handle incomplete harvests', () => {
      const incompleteHarvests: Harvest[] = [
        { ...mockHarvest, stage_completed_at: null },
        {
          ...mockHarvest,
          stage_completed_at: new Date('2025-01-07T00:00:00Z'),
        },
      ];

      const summary = createHarvestSharingSummary(incompleteHarvests);

      // Only completed harvest contributes to average
      expect(summary.avg_duration_days).toBe(6);
    });
  });

  describe('validateSummaryRedaction', () => {
    const mockHarvests: Harvest[] = [mockHarvest, mockHarvest, mockHarvest];

    it('should pass validation for properly redacted summary', () => {
      const summary = createHarvestSharingSummary(mockHarvests);
      const isValid = validateSummaryRedaction(summary);

      expect(isValid).toBe(true);
    });

    it('should fail if sensitive fields are present', () => {
      const summary = createHarvestSharingSummary(mockHarvests);
      // Inject PII field
      const tainted = { ...summary, user_id: 'user-789' } as any;

      const isValid = validateSummaryRedaction(tainted);

      expect(isValid).toBe(false);
    });

    it('should fail if redaction metadata is missing', () => {
      const summary = createHarvestSharingSummary(mockHarvests);
      // Remove metadata
      const incomplete = { ...summary, redaction_version: undefined } as any;

      const isValid = validateSummaryRedaction(incomplete);

      expect(isValid).toBe(false);
    });

    it('should warn for small sample sizes (k-anonymity)', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const smallSample: Harvest[] = [mockHarvest, mockHarvest];

      const summary = createHarvestSharingSummary(smallSample);
      const isValid = validateSummaryRedaction(summary);

      expect(isValid).toBe(true);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Small sample size')
      );

      consoleSpy.mockRestore();
    });
  });
});
