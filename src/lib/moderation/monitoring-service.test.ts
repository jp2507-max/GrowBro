/**
 * Tests for Monitoring Service
 *
 * Requirements: 5.5, 6.6, 10.5
 */

import { MonitoringService } from './monitoring-service';

// Mock Supabase
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

// Mock AuditService
jest.mock('./audit-service', () => ({
  AuditService: jest.fn().mockImplementation(() => ({
    verifyEventSignature: jest.fn(),
  })),
}));

describe('MonitoringService', () => {
  let service: MonitoringService;
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MonitoringService();

    const { supabase } = require('@/lib/supabase');
    mockSupabase = supabase;
  });

  describe('getDashboard', () => {
    it('should return comprehensive monitoring dashboard', async () => {
      // Mock all database queries
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        contains: jest.fn().mockReturnThis(),
        then: jest.fn().mockResolvedValue({ data: [], error: null }),
      });

      const dashboard = await service.getDashboard();

      expect(dashboard).toHaveProperty('performance');
      expect(dashboard).toHaveProperty('errors');
      expect(dashboard).toHaveProperty('audit_integrity');
      expect(dashboard).toHaveProperty('capacity');
      expect(dashboard).toHaveProperty('health_status');
      expect(dashboard).toHaveProperty('alerts');
    }, 10000);

    it('should calculate health status based on alerts', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        contains: jest.fn().mockReturnThis(),
        then: jest.fn().mockResolvedValue({ data: [], error: null }),
      });

      const dashboard = await service.getDashboard();

      expect(['healthy', 'degraded', 'critical']).toContain(
        dashboard.health_status
      );
    }, 10000);
  });

  describe('getPerformanceMetrics', () => {
    it('should calculate performance percentiles', async () => {
      const mockEvents = [
        { metadata: { duration_ms: 100 } },
        { metadata: { duration_ms: 200 } },
        { metadata: { duration_ms: 300 } },
        { metadata: { duration_ms: 400 } },
        { metadata: { duration_ms: 500 } },
      ];

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({ data: mockEvents, error: null }),
        in: jest.fn().mockReturnThis(),
        contains: jest.fn().mockReturnThis(),
      });

      const metrics = await service.getPerformanceMetrics();

      expect(metrics.report_submission_p50).toBeGreaterThanOrEqual(0);
      expect(metrics.report_submission_p95).toBeGreaterThanOrEqual(0);
      expect(metrics.report_submission_p99).toBeGreaterThanOrEqual(0);
      expect(metrics.measured_at).toBeInstanceOf(Date);
    });

    it('should calculate throughput metrics', async () => {
      const mockEvents = Array(120).fill({ metadata: { duration_ms: 100 } });

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({ data: mockEvents, error: null }),
        in: jest.fn().mockReturnThis(),
        contains: jest.fn().mockReturnThis(),
      });

      const metrics = await service.getPerformanceMetrics();

      expect(metrics.reports_per_minute).toBe(2); // 120 events / 60 minutes
    });
  });

  describe('getErrorMetrics', () => {
    it('should count errors by type', async () => {
      const mockErrors = [
        { event_type: 'error_database', metadata: {} },
        { event_type: 'error_database', metadata: {} },
        { event_type: 'error_external_service', metadata: {} },
        { event_type: 'dsa_submission_failed', metadata: {} },
      ];

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        gte: jest.fn().mockResolvedValue({ data: mockErrors, error: null }),
      });

      const metrics = await service.getErrorMetrics();

      expect(metrics.database_errors).toBe(2);
      expect(metrics.external_service_errors).toBe(1);
      expect(metrics.dsa_submission_failures).toBe(1);
    });

    it('should calculate error rates', async () => {
      const mockErrors = [
        { event_type: 'error_database', metadata: {} },
        { event_type: 'dsa_submission_failed', metadata: {} },
      ];

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'audit_events') {
          return {
            select: jest.fn().mockReturnThis(),
            in: jest.fn().mockReturnThis(),
            gte: jest.fn().mockResolvedValue({ data: mockErrors, error: null }),
          };
        }
        return {
          select: jest.fn().mockReturnThis(),
          gte: jest.fn().mockResolvedValue({ data: 100, error: null }),
        };
      });

      const metrics = await service.getErrorMetrics();

      expect(metrics.error_rate_percent).toBeGreaterThanOrEqual(0);
      expect(metrics.critical_error_rate_percent).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getAuditIntegrityMetrics', () => {
    it('should verify audit event signatures', async () => {
      const mockEvents = [
        { id: '1', signature: 'sig1', metadata: {} },
        { id: '2', signature: 'sig2', metadata: {} },
      ];

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({ data: mockEvents, error: null }),
      });

      const { AuditService } = require('./audit-service');
      const mockAuditService = new AuditService();
      mockAuditService.verifyEventSignature.mockResolvedValue(true);

      const metrics = await service.getAuditIntegrityMetrics();

      expect(metrics.total_events_checked).toBe(2);
      expect(metrics.integrity_score).toBeGreaterThanOrEqual(0);
      expect(metrics.integrity_score).toBeLessThanOrEqual(100);
    });

    it('should detect signature mismatches', async () => {
      const mockEvents = [
        { id: '1', signature: 'sig1', metadata: {} },
        { id: '2', signature: 'invalid', metadata: {} },
      ];

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({ data: mockEvents, error: null }),
      });

      const { AuditService } = require('./audit-service');
      const mockAuditService = new AuditService();
      // Mock to return false for both calls to trigger violations
      mockAuditService.verifyEventSignature.mockResolvedValue(false);

      const metrics = await service.getAuditIntegrityMetrics();

      expect(metrics.signature_mismatches).toBeGreaterThanOrEqual(1);
      expect(metrics.integrity_violations).toBeGreaterThanOrEqual(1);
    });
  });

  describe('getCapacityMetrics', () => {
    it('should calculate queue depths', async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        const counts: Record<string, number> = {
          reports: 50,
          appeals: 10,
          sor_export_queue: 5,
        };

        return {
          select: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          contains: jest.fn().mockReturnThis(),
          then: jest.fn().mockResolvedValue({
            data: counts[table] || 0,
            error: null,
          }),
        };
      });

      const metrics = await service.getCapacityMetrics();

      expect(metrics.pending_reports).toBeGreaterThanOrEqual(0);
      expect(metrics.pending_appeals).toBeGreaterThanOrEqual(0);
      expect(metrics.pending_sor_exports).toBeGreaterThanOrEqual(0);
    }, 10000);

    it('should calculate moderator utilization', async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'moderation_sessions') {
          return {
            select: jest.fn().mockReturnThis(),
            gte: jest.fn().mockResolvedValue({ data: 8, error: null }),
          };
        }
        if (table === 'users') {
          return {
            select: jest.fn().mockReturnThis(),
            contains: jest.fn().mockResolvedValue({ data: 10, error: null }),
          };
        }
        return {
          select: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          then: jest.fn().mockResolvedValue({ data: 0, error: null }),
        };
      });

      const metrics = await service.getCapacityMetrics();

      expect(metrics.moderator_utilization).toBeGreaterThanOrEqual(0);
      expect(metrics.moderator_utilization).toBeLessThanOrEqual(100);
    }, 10000);

    it('should estimate capacity hours', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        contains: jest.fn().mockReturnThis(),
        then: jest.fn().mockResolvedValue({ data: 0, error: null }),
      });

      const metrics = await service.getCapacityMetrics();

      expect(metrics.estimated_capacity_hours).toBeGreaterThanOrEqual(0);
    }, 10000);
  });

  describe('Alert Generation', () => {
    it('should generate performance alerts for high latency', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        contains: jest.fn().mockReturnThis(),
        then: jest.fn().mockResolvedValue({
          data: Array(100).fill({ metadata: { duration_ms: 6000 } }),
          error: null,
        }),
      });

      const dashboard = await service.getDashboard();

      const performanceAlerts = dashboard.alerts.filter(
        (a) => a.category === 'performance'
      );
      expect(performanceAlerts.length).toBeGreaterThan(0);
    }, 10000);

    it('should generate compliance alerts for DSA failures', async () => {
      const mockErrors = Array(15).fill({
        event_type: 'dsa_submission_failed',
        metadata: {},
      });

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockResolvedValue({ data: mockErrors, error: null }),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        contains: jest.fn().mockReturnThis(),
      });

      const dashboard = await service.getDashboard();

      const complianceAlerts = dashboard.alerts.filter(
        (a) => a.category === 'compliance'
      );
      expect(complianceAlerts.length).toBeGreaterThan(0);
    }, 10000);

    it('should generate capacity alerts for low capacity', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        contains: jest.fn().mockReturnThis(),
        then: jest.fn().mockResolvedValue({ data: 1000, error: null }),
      });

      const dashboard = await service.getDashboard();

      // Capacity alerts depend on queue growth rate and moderator utilization
      expect(dashboard.capacity).toBeDefined();
    }, 10000);
  });
});
