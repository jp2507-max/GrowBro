/**
 * Tests for AuditService
 *
 * Requirements: 6.1, 6.2, 6.6, 14.1, 14.3
 */

import type { AuditEventInput } from '@/types/moderation';

import { AuditService } from '../audit-service';

// Mock Supabase client
const mockSupabase = {
  from: jest.fn(),
  rpc: jest.fn(),
};

describe('AuditService', () => {
  let auditService: AuditService;

  beforeEach(() => {
    jest.clearAllMocks();
    auditService = new AuditService(mockSupabase as any);
  });

  describe('logEvent', () => {
    it('should create immutable audit event with signature', async () => {
      // Requirement 6.1: Create immutable audit entries with complete metadata
      const mockInsert = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: {
              id: 'audit-123',
              event_type: 'report_submitted',
              actor_id: 'user-456',
              actor_type: 'user',
              target_id: 'report-789',
              target_type: 'content_report',
              action: 'create',
              metadata: { reason: 'spam' },
              timestamp: new Date().toISOString(),
              signature: 'abc123signature',
              pii_tagged: false,
              retention_until: new Date().toISOString(),
              created_at: new Date().toISOString(),
            },
            error: null,
          }),
        }),
      });

      mockSupabase.from.mockReturnValue({
        insert: mockInsert,
      });

      const eventInput: AuditEventInput = {
        event_type: 'report_submitted',
        actor_id: 'user-456',
        actor_type: 'user',
        target_id: 'report-789',
        target_type: 'content_report',
        action: 'create',
        metadata: { reason: 'spam' },
      };

      const result = await auditService.logEvent(eventInput);

      expect(result.id).toBe('audit-123');
      expect(result.event_type).toBe('report_submitted');
      expect(result.signature).toBe('abc123signature');
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'report_submitted',
          actor_id: 'user-456',
          actor_type: 'user',
          target_id: 'report-789',
          target_type: 'content_report',
          action: 'create',
          metadata: { reason: 'spam' },
        })
      );
    });

    it('should calculate retention dates correctly for audit events', async () => {
      // Requirement 14.1: Apply GDPR data minimization with documented retention
      const mockInsert = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: {
              id: 'audit-123',
              event_type: 'decision_made',
              actor_id: 'mod-123',
              actor_type: 'moderator',
              target_id: 'decision-456',
              target_type: 'moderation_decision',
              action: 'approve',
              metadata: {},
              timestamp: new Date().toISOString(),
              signature: 'sig123',
              pii_tagged: false,
              retention_until: new Date().toISOString(),
              created_at: new Date().toISOString(),
            },
            error: null,
          }),
        }),
      });

      mockSupabase.from.mockReturnValue({
        insert: mockInsert,
      });

      await auditService.logEvent({
        event_type: 'decision_made',
        actor_id: 'mod-123',
        actor_type: 'moderator',
        target_id: 'decision-456',
        target_type: 'moderation_decision',
        action: 'approve',
      });

      // Check that retention_until was set
      const insertCall = mockInsert.mock.calls[0][0];
      expect(insertCall.retention_until).toBeDefined();

      // For decision_made events, retention should be 7 years (2555 days)
      const now = new Date();
      const retention = new Date(insertCall.retention_until);
      const daysDiff = Math.floor(
        (retention.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Should be approximately 2555 days (7 years)
      expect(daysDiff).toBeGreaterThan(2500);
      expect(daysDiff).toBeLessThan(2600);
    });

    it('should apply shorter retention for PII-tagged events', async () => {
      // Requirement 14.1: PII anonymization after 30 days
      const mockInsert = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: {
              id: 'audit-123',
              event_type: 'report_submitted',
              actor_id: 'user-456',
              actor_type: 'user',
              target_id: 'report-789',
              target_type: 'content_report',
              action: 'create',
              metadata: { email: 'user@example.com' },
              timestamp: new Date().toISOString(),
              signature: 'sig123',
              pii_tagged: true,
              retention_until: new Date().toISOString(),
              created_at: new Date().toISOString(),
            },
            error: null,
          }),
        }),
      });

      mockSupabase.from.mockReturnValue({
        insert: mockInsert,
      });

      await auditService.logEvent({
        event_type: 'report_submitted',
        actor_id: 'user-456',
        actor_type: 'user',
        target_id: 'report-789',
        target_type: 'content_report',
        action: 'create',
        metadata: { email: 'user@example.com' },
        pii_tagged: true,
      });

      const insertCall = mockInsert.mock.calls[0][0];
      const now = new Date();
      const retention = new Date(insertCall.retention_until);
      const daysDiff = Math.floor(
        (retention.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Should be approximately 30 days for PII
      expect(daysDiff).toBeGreaterThan(25);
      expect(daysDiff).toBeLessThan(35);
    });

    it('should throw error if event logging fails', async () => {
      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database error' },
            }),
          }),
        }),
      });

      await expect(
        auditService.logEvent({
          event_type: 'report_submitted',
          actor_id: 'user-456',
          actor_type: 'user',
          target_id: 'report-789',
          target_type: 'content_report',
          action: 'create',
        })
      ).rejects.toThrow('Failed to log audit event');
    });
  });

  describe('queryAuditTrail', () => {
    it('should query audit trail and log access', async () => {
      // Requirement 6.2: Maintain chain of custody with access logging
      const mockEvents = [
        {
          id: 'audit-1',
          event_type: 'report_submitted',
          actor_id: 'user-123',
          actor_type: 'user',
          target_id: 'report-456',
          target_type: 'content_report',
          action: 'create',
          metadata: {},
          timestamp: new Date().toISOString(),
          signature: 'sig1',
          pii_tagged: false,
          retention_until: new Date().toISOString(),
          created_at: new Date().toISOString(),
        },
      ];

      // Mock the query
      const mockRange = jest.fn().mockResolvedValue({
        data: mockEvents,
        error: null,
        count: 1,
      });

      const mockOrder = jest.fn().mockReturnValue({
        range: mockRange,
      });

      const mockSelect = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        order: mockOrder,
      });

      // Mock access logging
      const mockInsert = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: {
              id: 'audit-access-log',
              event_type: 'audit_access',
              actor_id: 'mod-789',
              actor_type: 'moderator',
              target_id: 'audit_trail',
              target_type: 'system',
              action: 'query',
              metadata: {},
              timestamp: new Date().toISOString(),
              signature: 'sig-access',
              pii_tagged: false,
              retention_until: new Date().toISOString(),
              created_at: new Date().toISOString(),
            },
            error: null,
          }),
        }),
      });

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'audit_events') {
          // First call is for access logging, second is for query
          if (mockSupabase.from.mock.calls.length === 1) {
            return { insert: mockInsert };
          }
          return { select: mockSelect };
        }
        return { select: mockSelect };
      });

      const result = await auditService.queryAuditTrail(
        {
          event_type: 'report_submitted',
          limit: 10,
        },
        {
          accessor_id: 'mod-789',
          accessor_type: 'moderator',
          purpose: 'compliance_review',
        }
      );

      expect(result.events).toHaveLength(1);
      expect(result.total_count).toBe(1);
      expect(result.has_more).toBe(false);

      // Verify access was logged
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'audit_access',
          actor_id: 'mod-789',
          actor_type: 'moderator',
        })
      );
    });

    it('should filter audit trail by multiple criteria', async () => {
      const mockSelect = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({
          data: [],
          error: null,
          count: 0,
        }),
      });

      const mockInsert = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: {},
            error: null,
          }),
        }),
      });

      mockSupabase.from.mockImplementation(() => ({
        insert: mockInsert,
        select: mockSelect,
      }));

      const start_date = new Date('2024-01-01');
      const end_date = new Date('2024-12-31');

      await auditService.queryAuditTrail(
        {
          event_type: ['report_submitted', 'decision_made'],
          actor_id: 'mod-123',
          target_type: 'content_report',
          start_date,
          end_date,
          limit: 50,
          offset: 10,
        },
        {
          accessor_id: 'admin-456',
          accessor_type: 'moderator',
          purpose: 'audit',
        }
      );

      // Verify filters were applied
      const selectInstance = mockSelect.mock.results[0].value;
      expect(selectInstance.in).toHaveBeenCalledWith('event_type', [
        'report_submitted',
        'decision_made',
      ]);
      expect(selectInstance.eq).toHaveBeenCalledWith('actor_id', 'mod-123');
      expect(selectInstance.eq).toHaveBeenCalledWith(
        'target_type',
        'content_report'
      );
      expect(selectInstance.gte).toHaveBeenCalledWith(
        'timestamp',
        start_date.toISOString()
      );
      expect(selectInstance.lte).toHaveBeenCalledWith(
        'timestamp',
        end_date.toISOString()
      );
    });
  });

  describe('verifyIntegrity', () => {
    it('should verify audit event signature', async () => {
      // Requirement 6.6: Prevent tampering through cryptographic signatures
      mockSupabase.rpc.mockResolvedValue({
        data: true,
        error: null,
      });

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { signature: 'valid-signature' },
              error: null,
            }),
          }),
        }),
      });

      const result = await auditService.verifyIntegrity('audit-123');

      expect(result.is_valid).toBe(true);
      expect(result.event_id).toBe('audit-123');
      expect(mockSupabase.rpc).toHaveBeenCalledWith('verify_audit_signature', {
        p_event_id: 'audit-123',
      });
    });

    it('should detect tampered signatures', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: false,
        error: null,
      });

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { signature: 'tampered-signature' },
              error: null,
            }),
          }),
        }),
      });

      const result = await auditService.verifyIntegrity('audit-123');

      expect(result.is_valid).toBe(false);
      expect(result.event_id).toBe('audit-123');
    });

    it('should handle verification errors', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Verification failed' },
      });

      const result = await auditService.verifyIntegrity('audit-123');

      expect(result.is_valid).toBe(false);
      expect(result.error).toBe('Verification failed');
    });
  });

  describe('verifyPartitionIntegrity', () => {
    it('should verify partition checksum', async () => {
      // Requirement 6.6: Partition-level integrity verification
      mockSupabase.rpc.mockResolvedValue({
        data: [{ record_count: 100, checksum: 'abc123' }],
        error: null,
      });

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                checksum: 'abc123',
                record_count: 100,
              },
              error: null,
            }),
          }),
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: {},
            error: null,
          }),
        }),
      });

      const result = await auditService.verifyPartitionIntegrity(
        'audit_events_202410'
      );

      expect(result).toBe(true);
      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'generate_partition_checksum',
        {
          p_partition_name: 'audit_events_202410',
        }
      );
    });

    it('should detect tampered partitions', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: [{ record_count: 100, checksum: 'different-checksum' }],
        error: null,
      });

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                checksum: 'original-checksum',
                record_count: 100,
              },
              error: null,
            }),
          }),
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: {},
            error: null,
          }),
        }),
      });

      const result = await auditService.verifyPartitionIntegrity(
        'audit_events_202410'
      );

      expect(result).toBe(false);
    });
  });

  describe('getTargetAuditTrail', () => {
    it('should retrieve all audit events for a target', async () => {
      // Requirement 6.1: Complete audit trail for entity
      const mockEvents = [
        {
          id: 'audit-1',
          event_type: 'report_submitted',
          actor_id: 'user-123',
          actor_type: 'user',
          target_id: 'report-456',
          target_type: 'content_report',
          action: 'create',
          metadata: {},
          timestamp: new Date('2024-01-01').toISOString(),
          signature: 'sig1',
          pii_tagged: false,
          retention_until: new Date().toISOString(),
          created_at: new Date().toISOString(),
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
          timestamp: new Date('2024-01-02').toISOString(),
          signature: 'sig2',
          pii_tagged: false,
          retention_until: new Date().toISOString(),
          created_at: new Date().toISOString(),
        },
      ];

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({
            data: mockEvents,
            error: null,
          }),
        }),
      });

      const result = await auditService.getTargetAuditTrail(
        'report-456',
        'content_report'
      );

      expect(result).toHaveLength(2);
      expect(result[0].action).toBe('create');
      expect(result[1].action).toBe('approve');
    });
  });

  describe('getSoRSubmissionTrail', () => {
    it('should retrieve SoR submission trail for decision', async () => {
      // Requirement 6.1: SoR submission trail for legal transparency
      const mockTrail = {
        statement_id: 'sor-123',
        payload_hash: 'abc123hash',
        submitted_at: new Date().toISOString(),
        transparency_db_id: 'ec-db-456',
        attempts: 1,
        status: 'submitted',
      };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockTrail,
              error: null,
            }),
          }),
        }),
      });

      const result = await auditService.getSoRSubmissionTrail('decision-789');

      expect(result).not.toBeNull();
      expect(result?.statement_id).toBe('sor-123');
      expect(result?.transparency_db_id).toBe('ec-db-456');
      expect(result?.status).toBe('submitted');
    });

    it('should return null if submission trail not found', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Not found' },
            }),
          }),
        }),
      });

      const result = await auditService.getSoRSubmissionTrail('decision-999');

      expect(result).toBeNull();
    });
  });
});
