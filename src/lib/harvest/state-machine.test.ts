/**
 * Tests for Harvest Workflow State Machine
 *
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7
 */

import { HarvestStage } from '@/types';
import type {
  HarvestAuditAction,
  HarvestAuditStatus,
  OverrideSkipRequest,
  StageRevertRequest,
  StageUndoRequest,
} from '@/types/harvest';

import {
  canUndoStageChange,
  createAuditEntry,
  getPreviousStage,
  getStageMetadata,
  getUndoExpirationTime,
  UNDO_WINDOW_MS,
  validateOverrideRequest,
  validateRevertRequest,
  validateStageTransition,
  validateUndoRequest,
} from './state-machine';

describe('harvest state machine', () => {
  describe('getStageMetadata', () => {
    it('returns correct metadata for HARVEST stage', () => {
      const metadata = getStageMetadata(HarvestStage.HARVEST);
      expect(metadata.stage).toBe(HarvestStage.HARVEST);
      expect(metadata.name).toBe('Harvest');
      expect(metadata.canAdvance).toBe(true);
      expect(metadata.canUndo).toBe(false);
      expect(metadata.canRevert).toBe(false);
    });

    it('returns correct metadata for DRYING stage', () => {
      const metadata = getStageMetadata(HarvestStage.DRYING);
      expect(metadata.stage).toBe(HarvestStage.DRYING);
      expect(metadata.name).toBe('Drying');
      expect(metadata.canAdvance).toBe(true);
      expect(metadata.canUndo).toBe(true);
      expect(metadata.canRevert).toBe(true);
    });

    it('returns correct metadata for CURING stage', () => {
      const metadata = getStageMetadata(HarvestStage.CURING);
      expect(metadata.stage).toBe(HarvestStage.CURING);
      expect(metadata.name).toBe('Curing');
      expect(metadata.canAdvance).toBe(true);
      expect(metadata.canUndo).toBe(true);
      expect(metadata.canRevert).toBe(true);
    });

    it('returns correct metadata for INVENTORY stage', () => {
      const metadata = getStageMetadata(HarvestStage.INVENTORY);
      expect(metadata.stage).toBe(HarvestStage.INVENTORY);
      expect(metadata.name).toBe('Inventory');
      expect(metadata.canAdvance).toBe(false);
      expect(metadata.canUndo).toBe(true);
      expect(metadata.canRevert).toBe(true);
    });
  });

  describe('validateStageTransition', () => {
    it('allows valid forward transition from HARVEST to DRYING', () => {
      const result = validateStageTransition(
        HarvestStage.HARVEST,
        HarvestStage.DRYING
      );
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('allows valid forward transition from DRYING to CURING', () => {
      const result = validateStageTransition(
        HarvestStage.DRYING,
        HarvestStage.CURING
      );
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('allows valid forward transition from CURING to INVENTORY', () => {
      const result = validateStageTransition(
        HarvestStage.CURING,
        HarvestStage.INVENTORY
      );
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('rejects transition to same stage', () => {
      const result = validateStageTransition(
        HarvestStage.DRYING,
        HarvestStage.DRYING
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Already at target stage');
    });

    it('rejects backward transition', () => {
      const result = validateStageTransition(
        HarvestStage.CURING,
        HarvestStage.DRYING
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid transition');
      expect(result.error).toContain('Only forward transitions are allowed');
    });

    it('rejects skipping stages', () => {
      const result = validateStageTransition(
        HarvestStage.HARVEST,
        HarvestStage.CURING
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid transition');
    });

    it('rejects transition from final stage', () => {
      const result = validateStageTransition(
        HarvestStage.INVENTORY,
        HarvestStage.HARVEST
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Cannot advance from final stage');
    });
  });

  describe('undo window validation', () => {
    const baseTime = new Date('2025-01-15T10:00:00.000Z');

    describe('canUndoStageChange', () => {
      it('returns true within 15-second window', () => {
        const completedAt = baseTime;
        const currentTime = new Date(baseTime.getTime() + 10 * 1000); // 10s later
        expect(canUndoStageChange(completedAt, currentTime)).toBe(true);
      });

      it('returns true exactly at 15-second boundary', () => {
        const completedAt = baseTime;
        const currentTime = new Date(baseTime.getTime() + UNDO_WINDOW_MS);
        expect(canUndoStageChange(completedAt, currentTime)).toBe(true);
      });

      it('returns false after 15-second window', () => {
        const completedAt = baseTime;
        const currentTime = new Date(baseTime.getTime() + 16 * 1000); // 16s later
        expect(canUndoStageChange(completedAt, currentTime)).toBe(false);
      });

      it('returns false 1ms after 15-second window', () => {
        const completedAt = baseTime;
        const currentTime = new Date(baseTime.getTime() + UNDO_WINDOW_MS + 1);
        expect(canUndoStageChange(completedAt, currentTime)).toBe(false);
      });
    });

    describe('getUndoExpirationTime', () => {
      it('calculates correct expiration time', () => {
        const completedAt = baseTime;
        const expiresAt = getUndoExpirationTime(completedAt);
        const expected = new Date(baseTime.getTime() + UNDO_WINDOW_MS);
        expect(expiresAt.getTime()).toBe(expected.getTime());
      });
    });

    describe('validateUndoRequest', () => {
      it('allows undo within window for valid stage', () => {
        const completedAt = baseTime;
        const currentTime = new Date(baseTime.getTime() + 10 * 1000);
        const request: StageUndoRequest = {
          harvest_id: 'test-harvest',
          stage_completed_at: completedAt,
        };
        const result = validateUndoRequest(
          request,
          HarvestStage.DRYING,
          currentTime
        );
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it('rejects undo after window expires', () => {
        const completedAt = baseTime;
        const currentTime = new Date(baseTime.getTime() + 20 * 1000);
        const request: StageUndoRequest = {
          harvest_id: 'test-harvest',
          stage_completed_at: completedAt,
        };
        const result = validateUndoRequest(
          request,
          HarvestStage.DRYING,
          currentTime
        );
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Undo window expired');
        expect(result.error).toContain('Use revert instead');
      });

      it('rejects undo for HARVEST stage (cannot undo to nothing)', () => {
        const completedAt = baseTime;
        const currentTime = new Date(baseTime.getTime() + 5 * 1000);
        const request: StageUndoRequest = {
          harvest_id: 'test-harvest',
          stage_completed_at: completedAt,
        };
        const result = validateUndoRequest(
          request,
          HarvestStage.HARVEST,
          currentTime
        );
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Cannot undo from stage');
      });
    });
  });

  describe('validateRevertRequest', () => {
    it('allows revert to earlier stage with valid reason', () => {
      const request: StageRevertRequest = {
        harvest_id: 'test-harvest',
        to_stage: HarvestStage.DRYING,
        reason: 'Need to re-dry due to high moisture content',
      };
      const result = validateRevertRequest(request, HarvestStage.CURING);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('allows revert from INVENTORY to HARVEST', () => {
      const request: StageRevertRequest = {
        harvest_id: 'test-harvest',
        to_stage: HarvestStage.HARVEST,
        reason: 'Major data entry error, need to restart',
      };
      const result = validateRevertRequest(request, HarvestStage.INVENTORY);
      expect(result.valid).toBe(true);
    });

    it('rejects revert to same stage', () => {
      const request: StageRevertRequest = {
        harvest_id: 'test-harvest',
        to_stage: HarvestStage.DRYING,
        reason: 'Test',
      };
      const result = validateRevertRequest(request, HarvestStage.DRYING);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Can only revert to earlier stages');
    });

    it('rejects revert to later stage', () => {
      const request: StageRevertRequest = {
        harvest_id: 'test-harvest',
        to_stage: HarvestStage.CURING,
        reason: 'Test',
      };
      const result = validateRevertRequest(request, HarvestStage.DRYING);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Can only revert to earlier stages');
    });

    it('rejects revert from HARVEST stage', () => {
      const request: StageRevertRequest = {
        harvest_id: 'test-harvest',
        to_stage: HarvestStage.HARVEST,
        reason: 'Test',
      };
      const result = validateRevertRequest(request, HarvestStage.HARVEST);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Cannot revert from stage');
    });

    it('rejects revert without reason', () => {
      const request: StageRevertRequest = {
        harvest_id: 'test-harvest',
        to_stage: HarvestStage.DRYING,
        reason: '',
      };
      const result = validateRevertRequest(request, HarvestStage.CURING);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Reason is mandatory');
    });

    it('rejects revert with whitespace-only reason', () => {
      const request: StageRevertRequest = {
        harvest_id: 'test-harvest',
        to_stage: HarvestStage.DRYING,
        reason: '   ',
      };
      const result = validateRevertRequest(request, HarvestStage.CURING);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Reason is mandatory');
    });
  });

  describe('validateOverrideRequest', () => {
    it('allows override to skip forward with valid reason', () => {
      const request: OverrideSkipRequest = {
        harvest_id: 'test-harvest',
        to_stage: HarvestStage.CURING,
        reason: 'Emergency harvest, skipping drying stage',
      };
      const result = validateOverrideRequest(request, HarvestStage.HARVEST);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('allows override from HARVEST to INVENTORY', () => {
      const request: OverrideSkipRequest = {
        harvest_id: 'test-harvest',
        to_stage: HarvestStage.INVENTORY,
        reason: 'Testing purposes, skip all intermediate stages',
      };
      const result = validateOverrideRequest(request, HarvestStage.HARVEST);
      expect(result.valid).toBe(true);
    });

    it('rejects override to same stage', () => {
      const request: OverrideSkipRequest = {
        harvest_id: 'test-harvest',
        to_stage: HarvestStage.DRYING,
        reason: 'Test',
      };
      const result = validateOverrideRequest(request, HarvestStage.DRYING);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Override can only skip forward');
    });

    it('rejects override to earlier stage', () => {
      const request: OverrideSkipRequest = {
        harvest_id: 'test-harvest',
        to_stage: HarvestStage.HARVEST,
        reason: 'Test',
      };
      const result = validateOverrideRequest(request, HarvestStage.CURING);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Override can only skip forward');
    });

    it('rejects override without reason', () => {
      const request: OverrideSkipRequest = {
        harvest_id: 'test-harvest',
        to_stage: HarvestStage.CURING,
        reason: '',
      };
      const result = validateOverrideRequest(request, HarvestStage.HARVEST);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Reason is mandatory');
    });

    it('rejects override with whitespace-only reason', () => {
      const request: OverrideSkipRequest = {
        harvest_id: 'test-harvest',
        to_stage: HarvestStage.INVENTORY,
        reason: '  \n  ',
      };
      const result = validateOverrideRequest(request, HarvestStage.DRYING);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Reason is mandatory');
    });
  });

  describe('getPreviousStage', () => {
    it('returns null for HARVEST stage', () => {
      expect(getPreviousStage(HarvestStage.HARVEST)).toBeNull();
    });

    it('returns HARVEST for DRYING stage', () => {
      expect(getPreviousStage(HarvestStage.DRYING)).toBe(HarvestStage.HARVEST);
    });

    it('returns DRYING for CURING stage', () => {
      expect(getPreviousStage(HarvestStage.CURING)).toBe(HarvestStage.DRYING);
    });

    it('returns CURING for INVENTORY stage', () => {
      expect(getPreviousStage(HarvestStage.INVENTORY)).toBe(
        HarvestStage.CURING
      );
    });
  });

  describe('createAuditEntry', () => {
    const baseTime = new Date('2025-01-15T10:30:00.000Z');

    it('creates audit entry for stage advance', () => {
      const entry = createAuditEntry({
        harvest_id: 'test-harvest-1',
        user_id: 'user-123',
        action: 'stage_advance' as HarvestAuditAction,
        status: 'permitted' as HarvestAuditStatus,
        from_stage: HarvestStage.HARVEST,
        to_stage: HarvestStage.DRYING,
        reason: null,
        performed_at: baseTime,
      });

      expect(entry.harvest_id).toBe('test-harvest-1');
      expect(entry.user_id).toBe('user-123');
      expect(entry.action).toBe('stage_advance');
      expect(entry.status).toBe('permitted');
      expect(entry.from_stage).toBe(HarvestStage.HARVEST);
      expect(entry.to_stage).toBe(HarvestStage.DRYING);
      expect(entry.reason).toBeNull();
      expect(entry.performed_at).toBe(baseTime);
      expect(entry.metadata).toEqual({});
    });

    it('creates audit entry for override with reason', () => {
      const entry = createAuditEntry({
        harvest_id: 'test-harvest-2',
        user_id: 'user-456',
        action: 'stage_override_skip' as HarvestAuditAction,
        status: 'permitted' as HarvestAuditStatus,
        from_stage: HarvestStage.HARVEST,
        to_stage: HarvestStage.CURING,
        reason: 'Emergency bypass due to equipment failure',
        performed_at: baseTime,
      });

      expect(entry.harvest_id).toBe('test-harvest-2');
      expect(entry.action).toBe('stage_override_skip');
      expect(entry.reason).toBe('Emergency bypass due to equipment failure');
    });

    it('creates audit entry with custom metadata', () => {
      const metadata = {
        elapsed_time_seconds: 12,
        device_id: 'abc123',
      };

      const entry = createAuditEntry({
        harvest_id: 'test-harvest-3',
        user_id: 'user-789',
        action: 'stage_undo' as HarvestAuditAction,
        status: 'permitted' as HarvestAuditStatus,
        from_stage: HarvestStage.DRYING,
        to_stage: HarvestStage.HARVEST,
        reason: null,
        performed_at: baseTime,
        metadata,
      });

      expect(entry.metadata).toEqual(metadata);
    });

    it('creates audit entry for blocked action', () => {
      const entry = createAuditEntry({
        harvest_id: 'test-harvest-4',
        user_id: 'user-999',
        action: 'stage_undo' as HarvestAuditAction,
        status: 'blocked' as HarvestAuditStatus,
        from_stage: HarvestStage.DRYING,
        to_stage: null,
        reason: null,
        performed_at: baseTime,
        metadata: { error: 'Undo window expired' },
      });

      expect(entry.status).toBe('blocked');
      expect(entry.to_stage).toBeNull();
      expect(entry.metadata.error).toBe('Undo window expired');
    });

    it('creates audit entry with null user_id', () => {
      const entry = createAuditEntry({
        harvest_id: 'test-harvest-5',
        user_id: null,
        action: 'stage_advance' as HarvestAuditAction,
        status: 'permitted' as HarvestAuditStatus,
        from_stage: HarvestStage.CURING,
        to_stage: HarvestStage.INVENTORY,
        reason: null,
        performed_at: baseTime,
      });

      expect(entry.user_id).toBeNull();
    });
  });
});
