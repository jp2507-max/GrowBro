/**
 * Transparency Service Tests
 *
 * Tests for DSA Arts. 15 & 24 compliance reporting
 * Requirements: 6.3, 6.5, 13.2, 13.7
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import { TransparencyService } from './transparency-service';

// Mock ODS integration
jest.mock('./ods-integration', () => ({
  getODSStatistics: jest.fn().mockResolvedValue({
    totalEscalations: 5,
    resolved: 3,
    pending: 2,
    averageResolutionDays: 45,
    outcomeBreakdown: { upheld: 2, rejected: 1, partial: 0, no_decision: 0 },
    upholdsReversed: 2,
  }),
}));

describe('TransparencyService', () => {
  let service: TransparencyService;
  let mockSupabase: SupabaseClient;

  beforeEach(() => {
    // Create a minimal mock Supabase client
    mockSupabase = {
      from: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        lt: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        not: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({ data: [], error: null }),
      })),
    } as any;

    service = new TransparencyService(mockSupabase);
  });

  describe('Annual Report Generation', () => {
    it('should create report structure with all required sections', async () => {
      // Mock minimal data
      (mockSupabase.from as jest.Mock).mockImplementation(() => ({
        select: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        not: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({ data: [], error: null, count: 0 }),
      }));

      const report = await service.generateAnnualReport(2024);

      // Verify report structure
      expect(report).toBeDefined();
      expect(report.period.year).toBe(2024);
      expect(report.platformInfo).toBeDefined();
      expect(report.platformInfo.name).toBe('GrowBro');
      expect(report.notices).toBeDefined();
      expect(report.decisions).toBeDefined();
      expect(report.appeals).toBeDefined();
      expect(report.ods).toBeDefined();
      expect(report.repeatOffenders).toBeDefined();
      expect(report.trustedFlaggers).toBeDefined();
      expect(report.sorSubmissions).toBeDefined();
      expect(report.complianceNotes).toBeDefined();
      expect(Array.isArray(report.complianceNotes)).toBe(true);
    });
  });

  describe('Real-Time Dashboard', () => {
    it('should return current system metrics', async () => {
      (mockSupabase.from as jest.Mock).mockImplementation(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        lt: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({ data: [], error: null, count: 0 }),
      }));

      const dashboard = await service.getRealTimeDashboard();

      expect(dashboard).toBeDefined();
      expect(dashboard.timestamp).toBeInstanceOf(Date);
      expect(typeof dashboard.pendingReports).toBe('number');
      expect(typeof dashboard.slaBreaches).toBe('number');
      expect(typeof dashboard.activeAppeals).toBe('number');
      expect(dashboard.circuitBreakerStatus).toBeDefined();
      expect(dashboard.last24Hours).toBeDefined();
      expect(typeof dashboard.last24Hours.reportsReceived).toBe('number');
      expect(typeof dashboard.last24Hours.decisionsIssued).toBe('number');
      expect(typeof dashboard.last24Hours.appealsSubmitted).toBe('number');
      expect(typeof dashboard.last24Hours.sorSubmissions).toBe('number');
    });
  });

  describe('Authority Export', () => {
    it('should generate export with PII redaction', async () => {
      const mockData = [
        {
          id: '1',
          content_id: 'content-1',
          reporter_contact: 'pii@example.com',
          ip_address: '192.168.1.1',
          created_at: '2024-06-01',
        },
      ];

      // Create a proper mock chain that returns itself for all methods
      const mockChain = {
        select: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
      };

      // Override the final methods to return data
      mockChain.lte = jest
        .fn()
        .mockResolvedValue({ data: mockData, error: null });
      mockChain.in = jest
        .fn()
        .mockResolvedValue({ data: mockData, error: null });
      mockChain.insert = jest
        .fn()
        .mockResolvedValue({ data: null, error: null });

      (mockSupabase.from as jest.Mock).mockImplementation(() => mockChain);

      const period = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
        year: 2024,
      };

      const exportData = await service.exportForAuthority(
        'authority-123',
        period,
        'json'
      );

      expect(exportData).toBeDefined();
      expect(exportData.requestedBy).toBe('authority-123');
      expect(exportData.format).toBe('json');
      expect(exportData.metadata.piiRedacted).toBe(true);
      expect(exportData.metadata.legalBasis).toContain('DSA Art. 15');
      expect(exportData.data).toBeDefined();
      expect(exportData.data.reports).toBeDefined();
      expect(exportData.data.decisions).toBeDefined();
      expect(exportData.data.appeals).toBeDefined();
      expect(exportData.data.auditTrail).toBeDefined();

      // Verify PII redaction
      const reports = exportData.data.reports;
      if (reports.length > 0) {
        expect(reports[0]).not.toHaveProperty('reporter_contact');
        expect(reports[0]).not.toHaveProperty('ip_address');
      }
    });
  });
});
