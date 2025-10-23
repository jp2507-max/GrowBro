/**
 * Tests for AuditRetentionManager
 *
 * Requirements: 14.1, 6.6
 */

import { AuditRetentionManager } from '../audit-retention-manager';

// Mock Supabase client
const mockSupabase = {
  from: jest.fn(),
  rpc: jest.fn(),
};

// Mock AuditService
const mockAuditService = {
  logEvent: jest.fn(),
  getTargetAuditTrail: jest.fn(),
};

describe('AuditRetentionManager', () => {
  let retentionManager: AuditRetentionManager;

  beforeEach(() => {
    jest.clearAllMocks();
    retentionManager = new AuditRetentionManager(
      mockSupabase as any,
      mockAuditService as any
    );
  });

  describe('applyRetentionPolicy', () => {
    it('should identify expired audit events', async () => {
      // Requirement 14.1: Automated retention policy enforcement
      const expiredEvents = [
        {
          id: 'audit-1',
          event_type: 'report_submitted',
          pii_tagged: false,
          retention_until: new Date('2023-01-01').toISOString(),
        },
        {
          id: 'audit-2',
          event_type: 'decision_made',
          pii_tagged: true,
          retention_until: new Date('2023-06-01').toISOString(),
        },
      ];

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lte: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({
                data: expiredEvents,
                error: null,
              }),
            }),
          }),
        }),
      });

      mockAuditService.logEvent.mockResolvedValue({});

      const result = await retentionManager.applyRetentionPolicy(true);

      expect(result.records_to_delete).toBe(2);
      expect(result.records_deleted).toBe(0); // Dry run
      expect(result.pii_records_anonymized).toBe(0); // Dry run
    });

    it('should separate PII and non-PII events for processing', async () => {
      const expiredEvents = [
        {
          id: 'audit-1',
          event_type: 'report_submitted',
          pii_tagged: true,
          retention_until: new Date('2023-01-01').toISOString(),
        },
        {
          id: 'audit-2',
          event_type: 'decision_made',
          pii_tagged: false,
          retention_until: new Date('2023-01-01').toISOString(),
        },
        {
          id: 'audit-3',
          event_type: 'appeal_filed',
          pii_tagged: true,
          retention_until: new Date('2023-01-01').toISOString(),
        },
      ];

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lte: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({
                data: expiredEvents,
                error: null,
              }),
            }),
          }),
        }),
      });

      mockAuditService.logEvent.mockResolvedValue({});

      const result = await retentionManager.applyRetentionPolicy(false);

      expect(result.records_to_delete).toBe(3);
      expect(result.pii_records_anonymized).toBe(2); // Two PII events

      // Verify PII anonymization was logged
      expect(mockAuditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'pii_anonymization',
          actor_id: 'system',
          action: 'anonymize',
          metadata: expect.objectContaining({
            event_count: 2,
          }),
        })
      );
    });

    it('should handle empty expired events list', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lte: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            }),
          }),
        }),
      });

      const result = await retentionManager.applyRetentionPolicy(true);

      expect(result.records_to_delete).toBe(0);
      expect(result.records_deleted).toBe(0);
      expect(result.pii_records_anonymized).toBe(0);
    });

    it('should throw error on database failure', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lte: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({
                data: null,
                error: { message: 'Database error' },
              }),
            }),
          }),
        }),
      });

      await expect(retentionManager.applyRetentionPolicy()).rejects.toThrow(
        'Failed to query expired audit events'
      );
    });
  });

  describe('scheduleDeletion', () => {
    it('should log deletion schedule for audit events', async () => {
      // Requirement 14.1: Documented deletion with audit trail
      mockAuditService.logEvent.mockResolvedValue({});

      await retentionManager.scheduleDeletion({
        event_ids: ['audit-1', 'audit-2', 'audit-3'],
        deletion_reason: 'Regulatory compliance',
        operator_id: 'admin-123',
      });

      expect(mockAuditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'deletion_scheduled',
          actor_id: 'admin-123',
          actor_type: 'moderator',
          action: 'schedule_deletion',
          metadata: expect.objectContaining({
            event_ids: ['audit-1', 'audit-2', 'audit-3'],
            deletion_reason: 'Regulatory compliance',
          }),
        })
      );
    });
  });

  describe('applyLegalHold', () => {
    it('should apply legal hold to target audit events', async () => {
      // Requirement 14.1: Legal hold management
      const targetEvents = [
        {
          id: 'audit-1',
          event_type: 'report_submitted',
          actor_id: 'user-123',
          actor_type: 'user',
          target_id: 'report-456',
          target_type: 'content_report',
          action: 'create',
          metadata: {},
          timestamp: new Date(),
          signature: 'sig1',
          pii_tagged: false,
          retention_until: new Date(),
          created_at: new Date(),
        },
        {
          id: 'audit-2',
          event_type: 'decision_made',
          actor_id: 'mod-789',
          actor_type: 'moderator',
          target_id: 'report-456',
          target_type: 'content_report',
          action: 'approve',
          metadata: {},
          timestamp: new Date(),
          signature: 'sig2',
          pii_tagged: false,
          retention_until: new Date(),
          created_at: new Date(),
        },
      ];

      mockAuditService.getTargetAuditTrail.mockResolvedValue(targetEvents);
      mockAuditService.logEvent.mockResolvedValue({});

      await retentionManager.applyLegalHold({
        target_id: 'report-456',
        target_type: 'content_report',
        hold_reason: 'Ongoing litigation',
        operator_id: 'legal-officer-123',
      });

      expect(mockAuditService.getTargetAuditTrail).toHaveBeenCalledWith(
        'report-456',
        'content_report'
      );

      expect(mockAuditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'legal_hold_applied',
          actor_id: 'legal-officer-123',
          actor_type: 'moderator',
          target_id: 'report-456',
          target_type: 'content_report',
          action: 'apply_hold',
          metadata: expect.objectContaining({
            hold_reason: 'Ongoing litigation',
            affected_event_count: 2,
          }),
        })
      );
    });
  });

  describe('releaseLegalHold', () => {
    it('should release legal hold and log the action', async () => {
      mockAuditService.logEvent.mockResolvedValue({});

      await retentionManager.releaseLegalHold({
        target_id: 'report-456',
        target_type: 'content_report',
        operator_id: 'legal-officer-123',
      });

      expect(mockAuditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'legal_hold_released',
          actor_id: 'legal-officer-123',
          actor_type: 'moderator',
          target_id: 'report-456',
          target_type: 'content_report',
          action: 'release_hold',
        })
      );
    });
  });

  describe('getRetentionStatistics', () => {
    it('should retrieve retention statistics', async () => {
      // Mock multiple queries for statistics
      let callCount = 0;

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'audit_events') {
          callCount++;

          if (callCount === 1) {
            // Total count
            return {
              select: jest.fn().mockResolvedValue({
                count: 1000,
                error: null,
              }),
            };
          } else if (callCount === 2) {
            // Expired count
            return {
              select: jest.fn().mockReturnValue({
                lte: jest.fn().mockResolvedValue({
                  count: 50,
                  error: null,
                }),
              }),
            };
          } else if (callCount === 3) {
            // PII count
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({
                  count: 100,
                  error: null,
                }),
              }),
            };
          } else if (callCount === 4) {
            // Oldest event
            return {
              select: jest.fn().mockReturnValue({
                order: jest.fn().mockReturnValue({
                  limit: jest.fn().mockReturnValue({
                    single: jest.fn().mockResolvedValue({
                      data: { timestamp: '2023-01-01T00:00:00Z' },
                      error: null,
                    }),
                  }),
                }),
              }),
            };
          } else {
            // Newest event
            return {
              select: jest.fn().mockReturnValue({
                order: jest.fn().mockReturnValue({
                  limit: jest.fn().mockReturnValue({
                    single: jest.fn().mockResolvedValue({
                      data: { timestamp: '2024-10-26T00:00:00Z' },
                      error: null,
                    }),
                  }),
                }),
              }),
            };
          }
        }
        return {};
      });

      const stats = await retentionManager.getRetentionStatistics();

      expect(stats.total_audit_events).toBe(1000);
      expect(stats.events_expired).toBe(50);
      expect(stats.events_with_pii).toBe(100);
      expect(stats.oldest_event_date).toEqual(new Date('2023-01-01T00:00:00Z'));
      expect(stats.newest_event_date).toEqual(new Date('2024-10-26T00:00:00Z'));
    });

    it('should handle null date ranges', async () => {
      let callCount = 0;

      mockSupabase.from.mockImplementation(() => {
        callCount++;

        if (callCount <= 3) {
          return {
            select: jest.fn().mockReturnValue({
              lte: jest.fn().mockResolvedValue({ count: 0, error: null }),
              eq: jest.fn().mockResolvedValue({ count: 0, error: null }),
            }),
          };
        } else {
          // Return null for date queries
          return {
            select: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                limit: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: null,
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
      });

      const stats = await retentionManager.getRetentionStatistics();

      expect(stats.oldest_event_date).toBeNull();
      expect(stats.newest_event_date).toBeNull();
    });
  });
});
