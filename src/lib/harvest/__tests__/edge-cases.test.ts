/**
 * Edge Cases Test Suite
 *
 * Comprehensive tests for harvest edge case handling
 * Requirements: 19.1, 19.2, 19.3, 19.4, 19.5
 */

import { HarvestStages } from '@/types';

import {
  getClockSkewGuidance,
  getHarvestValidationGuidance,
  getInvalidTimestampOrderGuidance,
  getInvalidWeightRatioGuidance,
  getMissingDryWeightGuidance,
  getOverlappingHarvestsGuidance,
  getStorageFullGuidance,
  getSyncConflictGuidance,
  getUnusualDurationGuidance,
} from '../edge-case-guidance';
import {
  checkOverlappingHarvests,
  validateOverlapOverride,
} from '../overlap-detection';
import {
  calculateElapsedDays,
  updateStageTimestamps,
  validateStageDuration,
} from '../stage-edit-handler';
import {
  calculateClockSkew,
  compareServerTimestamps,
  getAuthoritativeTimestamp,
  validateTimestampOrdering,
  validateTimestampSource,
} from '../time-sync-validator';

// Mock WatermelonDB
jest.mock('../../watermelon', () => ({
  database: {
    get: jest.fn(),
    write: jest.fn((fn) => fn()),
  },
}));

describe('Overlap Detection', () => {
  describe('validateOverlapOverride', () => {
    it('should reject empty reason', () => {
      const result = validateOverlapOverride({ reason: '' });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('mandatory');
    });

    it('should reject reason with only whitespace', () => {
      const result = validateOverlapOverride({ reason: '   ' });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('mandatory');
    });

    it('should reject reason shorter than 10 characters', () => {
      const result = validateOverlapOverride({ reason: 'Too short' });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('at least 10 characters');
    });

    it('should accept valid reason with sufficient detail', () => {
      const result = validateOverlapOverride({
        reason: 'Different grow medium requires separate tracking',
      });
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept reason with metadata', () => {
      const result = validateOverlapOverride({
        reason: 'Starting second harvest for backup genetics',
        performedBy: 'user-123',
      });
      expect(result.valid).toBe(true);
    });
  });

  // Note: Actual database queries tested in integration tests
  describe('checkOverlappingHarvests (unit)', () => {
    it('should handle query errors gracefully', async () => {
      const { database } = require('../../watermelon');
      database.get.mockReturnValue({
        query: jest.fn().mockReturnValue({
          fetch: jest.fn().mockRejectedValue(new Error('DB error')),
        }),
      });

      const result = await checkOverlappingHarvests('plant-1');

      expect(result.hasOverlap).toBe(false);
      expect(result.canProceed).toBe(false);
      expect(result.message).toContain('Failed to validate');
    });
  });
});

describe('Stage Edit Handler', () => {
  describe('calculateElapsedDays', () => {
    it('should calculate days between two dates', () => {
      const start = new Date('2025-01-01T00:00:00Z');
      const end = new Date('2025-01-08T00:00:00Z');

      const days = calculateElapsedDays(start, end);
      expect(days).toBe(7);
    });

    it('should handle same-day dates', () => {
      const start = new Date('2025-01-01T00:00:00Z');
      const end = new Date('2025-01-01T12:00:00Z');

      const days = calculateElapsedDays(start, end);
      expect(days).toBe(0.5);
    });

    it('should handle fractional days with rounding', () => {
      const start = new Date('2025-01-01T00:00:00Z');
      const end = new Date('2025-01-01T08:00:00Z'); // 8 hours = 0.333... days

      const days = calculateElapsedDays(start, end);
      expect(days).toBe(0.3); // Rounded to 1 decimal
    });

    it('should handle negative duration (end before start)', () => {
      const start = new Date('2025-01-08T00:00:00Z');
      const end = new Date('2025-01-01T00:00:00Z');

      const days = calculateElapsedDays(start, end);
      expect(days).toBe(-7);
    });
  });

  describe('updateStageTimestamps', () => {
    it('should reject start date after completion date', async () => {
      const result = await updateStageTimestamps({
        harvestId: 'test-harvest',
        stageStartedAt: new Date('2025-01-08T00:00:00Z'),
        stageCompletedAt: new Date('2025-01-01T00:00:00Z'),
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('before completion date');
    });

    it('should reject future start date', async () => {
      const futureDate = new Date(Date.now() + 86400000); // +1 day

      const result = await updateStageTimestamps({
        harvestId: 'test-harvest',
        stageStartedAt: futureDate,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('cannot be in the future');
    });

    it('should reject future completion date', async () => {
      const futureDate = new Date(Date.now() + 86400000); // +1 day

      const result = await updateStageTimestamps({
        harvestId: 'test-harvest',
        stageCompletedAt: futureDate,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('cannot be in the future');
    });

    it('should accept valid past timestamps', async () => {
      const { database } = require('../../watermelon');
      const mockHarvest: any = {
        id: 'test-harvest',
        stage: HarvestStages.DRYING,
        stageStartedAt: new Date('2025-01-01T00:00:00Z'),
        stageCompletedAt: null,
        update: jest.fn((fn: any) => {
          fn(mockHarvest);
          return Promise.resolve(mockHarvest);
        }),
      };

      database.get.mockReturnValue({
        find: jest.fn().mockResolvedValue(mockHarvest),
      });

      const result = await updateStageTimestamps({
        harvestId: 'test-harvest',
        stageStartedAt: new Date('2025-01-05T00:00:00Z'),
        notes: 'Adjusted start date',
      });

      expect(result.success).toBe(true);
      expect(result.durationRecomputed).toBe(true);
    });
  });

  describe('validateStageDuration', () => {
    it('should warn when duration is below minimum', () => {
      const mockHarvest = {
        id: 'test',
        stage: HarvestStages.DRYING,
        stageStartedAt: new Date('2025-01-08T00:00:00Z'),
        stageCompletedAt: new Date('2025-01-10T00:00:00Z'), // 2 days (min is 5)
      } as any;

      const result = validateStageDuration(mockHarvest);

      expect(result.valid).toBe(true); // Still valid, just warnings
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain('below recommended minimum');
    });

    it('should warn when duration exceeds maximum', () => {
      const mockHarvest = {
        id: 'test',
        stage: HarvestStages.DRYING,
        stageStartedAt: new Date('2025-01-01T00:00:00Z'),
        stageCompletedAt: new Date('2025-02-01T00:00:00Z'), // 31 days (max is 21)
      } as any;

      const result = validateStageDuration(mockHarvest);

      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain('exceeds recommended maximum');
    });

    it('should have no warnings for optimal duration', () => {
      const mockHarvest = {
        id: 'test',
        stage: HarvestStages.DRYING,
        stageStartedAt: new Date('2025-01-01T00:00:00Z'),
        stageCompletedAt: new Date('2025-01-08T00:00:00Z'), // 7 days (target)
      } as any;

      const result = validateStageDuration(mockHarvest);

      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });
  });
});

describe('Time Sync Validator', () => {
  describe('calculateClockSkew', () => {
    it('should detect no significant skew for small differences', () => {
      const client = new Date('2025-01-01T12:00:05Z');
      const server = new Date('2025-01-01T12:00:00Z'); // 5 seconds diff

      const result = calculateClockSkew(client, server);

      expect(result.skewMs).toBe(5000);
      expect(result.isSignificant).toBe(false); // < MIN_CLOCK_SKEW_MS
      expect(result.shouldWarn).toBe(false);
    });

    it('should detect significant skew below warning threshold', () => {
      const client = new Date('2025-01-01T12:01:00Z');
      const server = new Date('2025-01-01T12:00:00Z'); // 1 minute diff

      const result = calculateClockSkew(client, server);

      expect(result.skewMs).toBe(60000);
      expect(result.isSignificant).toBe(true); // > MIN_CLOCK_SKEW_MS
      expect(result.shouldWarn).toBe(false); // < MAX_CLOCK_SKEW_MS
    });

    it('should warn for large clock skew', () => {
      const client = new Date('2025-01-01T12:10:00Z');
      const server = new Date('2025-01-01T12:00:00Z'); // 10 minutes diff

      const result = calculateClockSkew(client, server);

      expect(result.skewMs).toBe(600000);
      expect(result.isSignificant).toBe(true);
      expect(result.shouldWarn).toBe(true); // > MAX_CLOCK_SKEW_MS
      expect(result.message).toContain('10 minutes');
    });

    it('should handle negative time differences', () => {
      const client = new Date('2025-01-01T12:00:00Z');
      const server = new Date('2025-01-01T12:10:00Z'); // Client behind

      const result = calculateClockSkew(client, server);

      expect(result.skewMs).toBe(600000); // Absolute value
      expect(result.shouldWarn).toBe(true);
    });
  });

  describe('validateTimestampSource', () => {
    it('should reject null timestamp', () => {
      const result = validateTimestampSource(null, 'server');

      expect(result.valid).toBe(false);
      expect(result.warning).toContain('null or undefined');
    });

    it('should warn for client timestamp usage', () => {
      const result = validateTimestampSource(new Date(), 'client');

      expect(result.valid).toBe(true);
      expect(result.warning).toContain('Server timestamp should override');
    });

    it('should accept server timestamp without warning', () => {
      const result = validateTimestampSource(new Date(), 'server');

      expect(result.valid).toBe(true);
      expect(result.warning).toBeUndefined();
    });
  });

  describe('compareServerTimestamps', () => {
    it('should return -1 for earlier timestamp', () => {
      const t1 = new Date('2025-01-01T00:00:00Z');
      const t2 = new Date('2025-01-02T00:00:00Z');

      expect(compareServerTimestamps(t1, t2)).toBe(-1);
    });

    it('should return 1 for later timestamp', () => {
      const t1 = new Date('2025-01-02T00:00:00Z');
      const t2 = new Date('2025-01-01T00:00:00Z');

      expect(compareServerTimestamps(t1, t2)).toBe(1);
    });

    it('should return 0 for equal timestamps', () => {
      const t1 = new Date('2025-01-01T12:00:00Z');
      const t2 = new Date('2025-01-01T12:00:00Z');

      expect(compareServerTimestamps(t1, t2)).toBe(0);
    });
  });

  describe('getAuthoritativeTimestamp', () => {
    it('should prefer server timestamp', () => {
      const server = new Date('2025-01-01T12:00:00Z');
      const client = new Date('2025-01-01T12:05:00Z');

      const result = getAuthoritativeTimestamp(server, client);

      expect(result.timestamp).toEqual(server);
      expect(result.source).toBe('server');
      expect(result.shouldSync).toBe(false);
    });

    it('should fallback to client timestamp when server unavailable', () => {
      const client = new Date('2025-01-01T12:05:00Z');

      const result = getAuthoritativeTimestamp(null, client);

      expect(result.timestamp).toEqual(client);
      expect(result.source).toBe('client');
      expect(result.shouldSync).toBe(true);
    });
  });

  describe('validateTimestampOrdering', () => {
    it('should validate correct timestamp ordering', () => {
      const timestamps = [
        { label: 'Start', timestamp: new Date('2025-01-01T00:00:00Z') },
        { label: 'Middle', timestamp: new Date('2025-01-05T00:00:00Z') },
        { label: 'End', timestamp: new Date('2025-01-10T00:00:00Z') },
      ];

      const result = validateTimestampOrdering(timestamps);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid ordering', () => {
      const timestamps = [
        { label: 'Start', timestamp: new Date('2025-01-10T00:00:00Z') },
        { label: 'End', timestamp: new Date('2025-01-01T00:00:00Z') },
      ];

      const result = validateTimestampOrdering(timestamps);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('must be before');
    });

    it('should detect equal timestamps as invalid', () => {
      const same = new Date('2025-01-01T00:00:00Z');
      const timestamps = [
        { label: 'First', timestamp: same },
        { label: 'Second', timestamp: same },
      ];

      const result = validateTimestampOrdering(timestamps);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
    });
  });
});

describe('Edge Case Guidance', () => {
  describe('getOverlappingHarvestsGuidance', () => {
    it('should provide guidance for overlapping harvests', () => {
      const guidance = getOverlappingHarvestsGuidance('Test Plant', 2);

      expect(guidance.title).toContain('overlappingHarvests');
      expect(guidance.severity).toBe('warning');
      expect(guidance.actions).toHaveLength(3);
      expect(guidance.actions[0].actionType).toBe('navigate');
    });
  });

  describe('getMissingDryWeightGuidance', () => {
    it('should provide guidance for missing dry weight', () => {
      const guidance = getMissingDryWeightGuidance();

      expect(guidance.title).toContain('missingDryWeight');
      expect(guidance.severity).toBe('error');
      expect(guidance.actions.some((a) => a.actionType === 'fix')).toBe(true);
    });
  });

  describe('getUnusualDurationGuidance', () => {
    it('should provide guidance for too short duration', () => {
      const guidance = getUnusualDurationGuidance({
        stage: HarvestStages.DRYING,
        actualDays: 2,
        recommendedMin: 5,
        recommendedMax: 14,
      });

      expect(guidance.title).toContain('durationTooShort');
      expect(guidance.severity).toBe('warning');
      expect(guidance.actions).toHaveLength(3);
    });

    it('should provide guidance for too long duration', () => {
      const guidance = getUnusualDurationGuidance({
        stage: HarvestStages.DRYING,
        actualDays: 30,
        recommendedMin: 5,
        recommendedMax: 14,
      });

      expect(guidance.title).toContain('durationTooLong');
      expect(guidance.severity).toBe('info');
    });
  });

  describe('getHarvestValidationGuidance', () => {
    it('should return empty array for valid state', () => {
      const guidance = getHarvestValidationGuidance({});

      expect(guidance).toHaveLength(0);
    });

    it('should return multiple guidance messages for multiple issues', () => {
      const guidance = getHarvestValidationGuidance({
        hasOverlap: true,
        missingDryWeight: true,
        syncConflict: true,
      });

      expect(guidance).toHaveLength(3);
      expect(guidance.some((g) => g.title.includes('overlapping'))).toBe(true);
      expect(guidance.some((g) => g.title.includes('missingDryWeight'))).toBe(
        true
      );
      expect(guidance.some((g) => g.title.includes('syncConflict'))).toBe(true);
    });

    it('should include duration guidance when provided', () => {
      const guidance = getHarvestValidationGuidance({
        durationIssue: {
          stage: HarvestStages.CURING,
          days: 2,
          min: 14,
          max: 60,
        },
      });

      expect(guidance).toHaveLength(1);
      expect(guidance[0].title).toContain('duration');
    });

    it('should include clock skew guidance', () => {
      const guidance = getHarvestValidationGuidance({
        clockSkew: 600000, // 10 minutes in ms
      });

      expect(guidance).toHaveLength(1);
      expect(guidance[0].title).toContain('clockSkew');
    });
  });

  describe('All guidance functions', () => {
    it('should provide valid guidance structure', () => {
      const allGuidance = [
        getOverlappingHarvestsGuidance('Plant', 1),
        getMissingDryWeightGuidance(),
        getUnusualDurationGuidance({
          stage: HarvestStages.DRYING,
          actualDays: 2,
          recommendedMin: 5,
          recommendedMax: 14,
        }),
        getClockSkewGuidance(10),
        getInvalidTimestampOrderGuidance(),
        getInvalidWeightRatioGuidance(),
        getSyncConflictGuidance(),
        getStorageFullGuidance(450, 500),
      ];

      allGuidance.forEach((guidance) => {
        expect(guidance).toHaveProperty('title');
        expect(guidance).toHaveProperty('description');
        expect(guidance).toHaveProperty('actions');
        expect(guidance).toHaveProperty('severity');
        expect(['info', 'warning', 'error']).toContain(guidance.severity);
        expect(Array.isArray(guidance.actions)).toBe(true);
        expect(guidance.actions.length).toBeGreaterThan(0);

        guidance.actions.forEach((action) => {
          expect(action).toHaveProperty('label');
          expect(action).toHaveProperty('actionType');
          expect(['navigate', 'fix', 'override', 'dismiss']).toContain(
            action.actionType
          );
        });
      });
    });
  });
});

describe('Edge Cases - Requirement Coverage', () => {
  it('should cover Requirement 19.1: Overlapping harvests detection', () => {
    const override = validateOverlapOverride({
      reason: 'Starting second harvest for backup',
    });
    expect(override.valid).toBe(true);
  });

  it('should cover Requirement 19.2: Back-dated edits with duration recomputation', () => {
    const start = new Date('2025-01-01T00:00:00Z');
    const end = new Date('2025-01-15T00:00:00Z');
    const days = calculateElapsedDays(start, end);
    expect(days).toBe(14);
  });

  it('should cover Requirement 19.3: Missing weights validation', () => {
    const guidance = getMissingDryWeightGuidance();
    expect(guidance.severity).toBe('error');
    expect(guidance.actions.some((a) => a.actionType === 'fix')).toBe(true);
  });

  it('should cover Requirement 19.4: Server timestamps as authoritative', () => {
    const server = new Date('2025-01-01T12:00:00Z');
    const client = new Date('2025-01-01T12:05:00Z');
    const result = getAuthoritativeTimestamp(server, client);
    expect(result.source).toBe('server');
  });

  it('should cover Requirement 19.5: User guidance for unusual states', () => {
    const guidance = getHarvestValidationGuidance({
      hasOverlap: true,
      invalidWeightRatio: true,
    });
    expect(guidance.length).toBeGreaterThan(0);
    guidance.forEach((g) => {
      expect(g.actions.length).toBeGreaterThan(0);
    });
  });
});
