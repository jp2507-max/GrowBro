/**
 * SLA Monitor Service Tests
 *
 * Tests for SLA monitoring, compliance tracking, and alerting
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
 */

import { DateTime } from 'luxon';

import type { ContentReport } from '@/types/moderation';

import { SLAMonitorService } from './sla-monitor-service';

// Mock Supabase
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

// Mock audit service
jest.mock('../audit-service', () => ({
  AuditService: jest.fn().mockImplementation(() => ({
    logEvent: jest.fn().mockResolvedValue(undefined),
  })),
}));

// Mock metrics trackers
jest.mock('../moderation-metrics-trackers', () => ({
  trackSLABreach: jest.fn(),
}));

describe('SLAMonitorService', () => {
  let service: SLAMonitorService;
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SLAMonitorService();

    const { supabase } = require('@/lib/supabase');
    mockSupabase = supabase;
  });

  describe('monitorActiveReports', () => {
    it('should fetch and monitor active reports', async () => {
      const mockReports = [
        {
          id: 'report-1',
          content_id: 'content-1',
          content_type: 'post',
          report_type: 'illegal',
          status: 'pending',
          priority: 80,
          sla_deadline: DateTime.now().plus({ hours: 2 }).toISO(),
          created_at: DateTime.now().minus({ hours: 20 }).toISO(),
          updated_at: DateTime.now().toISO(),
        },
      ];

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({
          data: mockReports,
          error: null,
        }),
      });

      const results = await service.monitorActiveReports();

      expect(results).toHaveLength(1);
      expect(results[0]).toHaveProperty('reportId', 'report-1');
      expect(results[0]).toHaveProperty('status');
      expect(results[0]).toHaveProperty('shouldAlert');
    });

    it('should return empty array when no active reports', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      });

      const results = await service.monitorActiveReports();

      expect(results).toEqual([]);
    });

    it('should throw error on database failure', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        }),
      });

      await expect(service.monitorActiveReports()).rejects.toThrow(
        'Failed to fetch reports for SLA monitoring'
      );
    });
  });

  describe('monitorSingleReport', () => {
    it('should calculate correct SLA status for green report', async () => {
      const mockReport = {
        id: 'report-1',
        created_at: DateTime.now().minus({ hours: 1 }).toISO(),
        sla_deadline: DateTime.now().plus({ hours: 23 }).toISO(),
        priority: 50,
      };

      const result = await service.monitorSingleReport(mockReport as any);

      expect(result.status).toBe('green');
      expect(result.isBreached).toBe(false);
      expect(result.shouldAlert).toBe(false);
    });

    it('should detect 75% threshold alert', async () => {
      const mockReport = {
        id: 'report-1',
        created_at: DateTime.now().minus({ hours: 18 }).toISO(),
        sla_deadline: DateTime.now().plus({ hours: 6 }).toISO(),
        priority: 50,
        last_alert_level: undefined,
      };

      const result = await service.monitorSingleReport(mockReport as any);

      expect(result.percentUsed).toBeGreaterThanOrEqual(75);
      expect(result.shouldAlert).toBe(true);
      expect(result.alertLevel).toBe(75);
    });

    it('should detect 90% threshold alert', async () => {
      const mockReport = {
        id: 'report-1',
        created_at: DateTime.now().minus({ hours: 21.6 }).toISO(),
        sla_deadline: DateTime.now().plus({ hours: 2.4 }).toISO(),
        priority: 50,
        last_alert_level: 75,
      };

      const result = await service.monitorSingleReport(mockReport as any);

      expect(result.percentUsed).toBeGreaterThanOrEqual(90);
      expect(result.shouldAlert).toBe(true);
      expect(result.alertLevel).toBe(90);
    });

    it('should detect breached SLA', async () => {
      const mockReport = {
        id: 'report-1',
        created_at: DateTime.now().minus({ hours: 25 }).toISO(),
        sla_deadline: DateTime.now().minus({ hours: 1 }).toISO(),
        priority: 50,
      };

      const result = await service.monitorSingleReport(mockReport as any);

      expect(result.isBreached).toBe(true);
      expect(result.status).toBe('critical');
    });
  });

  describe('getComplianceMetrics', () => {
    it('should calculate compliance metrics correctly', async () => {
      const startDate = DateTime.now().minus({ days: 7 }).toJSDate();
      const endDate = DateTime.now().toJSDate();

      const mockReports = [
        {
          id: 'report-1',
          created_at: DateTime.now().minus({ days: 5 }).toISO(),
          sla_deadline: DateTime.now().minus({ days: 4, hours: 12 }).toISO(),
          resolved_at: DateTime.now().minus({ days: 4, hours: 18 }).toISO(),
          status: 'resolved',
        },
        {
          id: 'report-2',
          created_at: DateTime.now().minus({ days: 3 }).toISO(),
          sla_deadline: DateTime.now().minus({ days: 2 }).toISO(),
          resolved_at: DateTime.now().minus({ days: 2, hours: 2 }).toISO(),
          status: 'resolved',
        },
      ];

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        in: jest.fn().mockResolvedValue({
          data: mockReports,
          error: null,
        }),
      });

      const metrics = await service.getComplianceMetrics(startDate, endDate);

      expect(metrics.totalReports).toBe(2);
      expect(metrics.withinSLA).toBe(1);
      expect(metrics.breached).toBe(1);
      expect(metrics.complianceRate).toBe(50);
      expect(metrics.averageResponseTimeMs).toBeGreaterThan(0);
    });

    it('should handle empty dataset', async () => {
      const startDate = DateTime.now().minus({ days: 7 }).toJSDate();
      const endDate = DateTime.now().toJSDate();

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        in: jest.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      });

      const metrics = await service.getComplianceMetrics(startDate, endDate);

      expect(metrics.totalReports).toBe(0);
      expect(metrics.complianceRate).toBe(100);
      expect(metrics.averageResponseTimeMs).toBe(0);
    });
  });

  describe('getAtRiskReports', () => {
    it('should identify reports at risk (>75% time used)', async () => {
      const mockReports = [
        {
          id: 'report-1',
          created_at: DateTime.now().minus({ hours: 18 }).toISO(),
          sla_deadline: DateTime.now().plus({ hours: 6 }).toISO(),
          status: 'pending',
        },
        {
          id: 'report-2',
          created_at: DateTime.now().minus({ hours: 10 }).toISO(),
          sla_deadline: DateTime.now().plus({ hours: 14 }).toISO(),
          status: 'pending',
        },
      ];

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: mockReports,
          error: null,
        }),
      });

      const atRisk = await service.getAtRiskReports();

      expect(atRisk.length).toBeGreaterThan(0);
      expect(atRisk[0].id).toBe('report-1');
    });
  });

  describe('getBreachedReports', () => {
    it('should fetch reports past deadline', async () => {
      const mockReports = [
        {
          id: 'report-1',
          created_at: DateTime.now().minus({ days: 2 }).toISO(),
          sla_deadline: DateTime.now().minus({ hours: 1 }).toISO(),
          status: 'pending',
        },
      ];

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        lt: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: mockReports,
          error: null,
        }),
      });

      const breached = await service.getBreachedReports();

      expect(breached).toHaveLength(1);
      expect(breached[0].id).toBe('report-1');
    });
  });

  describe('logSLABreach', () => {
    it('should log breach with audit trail and metrics', async () => {
      const mockReport: ContentReport = {
        id: 'report-1',
        content_id: 'content-1',
        content_type: 'post',
        content_locator: 'https://example.com',
        content_hash: 'hash123',
        reporter_id: 'user-1',
        reporter_contact: { email: 'reporter@example.com' },
        trusted_flagger: false,
        report_type: 'illegal',
        explanation: 'Test explanation',
        good_faith_declaration: true,
        status: 'pending',
        priority: 80,
        sla_deadline: DateTime.now().minus({ hours: 1 }).toJSDate(),
        created_at: DateTime.now().minus({ days: 2 }).toJSDate(),
        updated_at: DateTime.now().toJSDate(),
      };

      await service.logSLABreach('report-1', mockReport);

      const { trackSLABreach } = require('../moderation-metrics-trackers');
      expect(trackSLABreach).toHaveBeenCalledWith(
        'report-1',
        'illegal',
        expect.any(Number)
      );
    });
  });

  describe('updateLastAlertLevel', () => {
    it('should update alert level in database', async () => {
      const mockUpdate = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockResolvedValue({
        error: null,
      });

      mockSupabase.from.mockReturnValue({
        update: mockUpdate,
        eq: mockEq,
      });

      await service.updateLastAlertLevel('report-1', 75);

      expect(mockUpdate).toHaveBeenCalledWith({ last_alert_level: 75 });
      expect(mockEq).toHaveBeenCalledWith('id', 'report-1');
    });
  });

  describe('getDashboardMetrics', () => {
    it('should calculate real-time dashboard metrics', async () => {
      const mockReports = [
        {
          id: 'report-1',
          created_at: DateTime.now().minus({ hours: 18 }).toISO(),
          sla_deadline: DateTime.now().plus({ hours: 6 }).toISO(),
        },
        {
          id: 'report-2',
          created_at: DateTime.now().minus({ hours: 25 }).toISO(),
          sla_deadline: DateTime.now().minus({ hours: 1 }).toISO(),
        },
      ];

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockResolvedValue({
          data: mockReports,
          error: null,
        }),
      });

      const metrics = await service.getDashboardMetrics();

      expect(metrics.activeReports).toBe(2);
      expect(metrics.atRisk).toBeGreaterThanOrEqual(0);
      expect(metrics.breached).toBeGreaterThanOrEqual(1);
      expect(metrics.complianceRate).toBeLessThanOrEqual(100);
      expect(metrics.averageTimeRemainingMs).toBeGreaterThanOrEqual(0);
    });
  });
});
