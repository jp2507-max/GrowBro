/**
 * Tests for Trusted Flagger Service
 * Requirements: 11.1, 11.2, 11.3
 */

import { supabase } from '@/lib/supabase';

import {
  certifyFlagger,
  getFlaggerById,
  getFlaggersDueForReview,
  isUserTrustedFlagger,
  listFlaggers,
  registerFlagger,
  updateFlaggerMetrics,
  updateFlaggerStatus,
} from './trusted-flagger-service';

// Mock Supabase
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

// Mock audit service
jest.mock('./audit-service', () => ({
  AuditService: jest.fn().mockImplementation(() => ({
    logEvent: jest.fn().mockResolvedValue({}),
  })),
}));

const mockSupabaseChain = {
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  is: jest.fn().mockReturnThis(),
  contains: jest.fn().mockReturnThis(),
  lte: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  single: jest.fn(),
};

describe('Trusted Flagger Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset chain mock - each method returns mockSupabaseChain
    // to enable reassignment pattern used in listFlaggers
    mockSupabaseChain.select.mockReturnValue(mockSupabaseChain);
    mockSupabaseChain.insert.mockReturnValue(mockSupabaseChain);
    mockSupabaseChain.update.mockReturnValue(mockSupabaseChain);
    mockSupabaseChain.eq.mockReturnValue(mockSupabaseChain);
    mockSupabaseChain.is.mockReturnValue(mockSupabaseChain);
    mockSupabaseChain.contains.mockReturnValue(mockSupabaseChain);
    mockSupabaseChain.lte.mockReturnValue(mockSupabaseChain);
    mockSupabaseChain.order.mockReturnValue(mockSupabaseChain);
    (supabase.from as jest.Mock).mockReturnValue(mockSupabaseChain);
  });

  describe('registerFlagger', () => {
    it('should register a new trusted flagger', async () => {
      const mockFlaggerId = 'flagger-123';

      mockSupabaseChain.single.mockResolvedValue({
        data: { id: mockFlaggerId },
        error: null,
      });

      const input = {
        organizationName: 'Test Org',
        contactInfo: { email: 'test@example.com' },
        specialization: ['hate_speech', 'csam'],
      };

      const result = await registerFlagger(input);

      expect(result.flaggerId).toBe(mockFlaggerId);
      expect(supabase.from).toHaveBeenCalledWith('trusted_flaggers');
      expect(mockSupabaseChain.insert).toHaveBeenCalled();
    });

    it('should throw error if organization name is missing', async () => {
      const input = {
        organizationName: '',
        contactInfo: { email: 'test@example.com' },
        specialization: ['hate_speech'],
      };

      await expect(registerFlagger(input)).rejects.toThrow(
        'Organization name is required'
      );
    });

    it('should throw error if email is missing', async () => {
      const input = {
        organizationName: 'Test Org',
        contactInfo: { email: '' },
        specialization: ['hate_speech'],
      };

      await expect(registerFlagger(input)).rejects.toThrow(
        'Contact email is required'
      );
    });

    it('should throw error if specialization is empty', async () => {
      const input = {
        organizationName: 'Test Org',
        contactInfo: { email: 'test@example.com' },
        specialization: [],
      };

      await expect(registerFlagger(input)).rejects.toThrow(
        'At least one specialization is required'
      );
    });
  });

  describe('certifyFlagger', () => {
    it('should certify a trusted flagger', async () => {
      mockSupabaseChain.single.mockResolvedValue({
        data: {},
        error: null,
      });

      const input = {
        flaggerId: 'flagger-123',
        certifiedBy: 'moderator-456',
        reviewNotes: 'Meets all criteria',
      };

      await certifyFlagger(input);

      expect(supabase.from).toHaveBeenCalledWith('trusted_flaggers');
      expect(mockSupabaseChain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'active',
        })
      );
    });

    it('should handle certification errors', async () => {
      // Mock the update chain to return error (not single)
      (supabase.from as jest.Mock).mockReturnValue({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        }),
      });

      const input = {
        flaggerId: 'flagger-123',
        certifiedBy: 'moderator-456',
      };

      await expect(certifyFlagger(input)).rejects.toThrow(
        'Failed to certify trusted flagger: Database error'
      );
    });
  });

  describe('updateFlaggerStatus', () => {
    it('should update flagger status', async () => {
      mockSupabaseChain.single.mockResolvedValue({
        data: {},
        error: null,
      });

      const input = {
        flaggerId: 'flagger-123',
        status: 'suspended' as const,
        reason: 'Low accuracy rate',
        updatedBy: 'moderator-456',
      };

      await updateFlaggerStatus(input);

      expect(mockSupabaseChain.update).toHaveBeenCalledWith({
        status: 'suspended',
      });
    });

    it('should require a reason for status update', async () => {
      const input = {
        flaggerId: 'flagger-123',
        status: 'suspended' as const,
        reason: '',
        updatedBy: 'moderator-456',
      };

      await expect(updateFlaggerStatus(input)).rejects.toThrow(
        'Reason is required for status update'
      );
    });
  });

  describe('getFlaggerById', () => {
    it('should return flagger by id', async () => {
      const mockFlagger = {
        id: 'flagger-123',
        organization_name: 'Test Org',
        contact_info: { email: 'test@example.com' },
        specialization: ['hate_speech'],
        status: 'active',
        quality_metrics: {
          accuracy_rate: 0.9,
          average_handling_time_hours: 2,
          total_reports: 100,
          upheld_decisions: 90,
        },
        certification_date: '2025-01-01T00:00:00Z',
        review_date: '2025-07-01T00:00:00Z',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
        deleted_at: null,
      };

      mockSupabaseChain.single.mockResolvedValue({
        data: mockFlagger,
        error: null,
      });

      const result = await getFlaggerById('flagger-123');

      expect(result).toBeDefined();
      expect(result?.id).toBe('flagger-123');
      expect(result?.organization_name).toBe('Test Org');
    });

    it('should return null if flagger not found', async () => {
      mockSupabaseChain.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' },
      });

      const result = await getFlaggerById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('listFlaggers', () => {
    it('should list flaggers with filters', async () => {
      const mockFlaggers = [
        {
          id: 'flagger-1',
          organization_name: 'Org 1',
          status: 'active',
          certification_date: '2025-01-01T00:00:00Z',
          review_date: '2025-07-01T00:00:00Z',
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
        },
      ];

      // Treat mockSupabaseChain as a Promise-like object
      // by adding then/catch methods
      (mockSupabaseChain as any).then = jest
        .fn()
        .mockImplementation((resolve) =>
          resolve({ data: mockFlaggers, error: null })
        );

      const result = await listFlaggers({ status: 'active' });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('flagger-1');
    });
  });

  describe('isUserTrustedFlagger', () => {
    it('should return true for active trusted flagger', async () => {
      mockSupabaseChain.single.mockResolvedValue({
        data: { id: 'flagger-123' },
        error: null,
      });

      const result = await isUserTrustedFlagger('flagger-123');

      expect(result).toBe(true);
    });

    it('should return false for non-flagger', async () => {
      mockSupabaseChain.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' },
      });

      const result = await isUserTrustedFlagger('user-456');

      expect(result).toBe(false);
    });
  });

  describe('updateFlaggerMetrics', () => {
    it('should update quality metrics', async () => {
      const mockCurrentMetrics = {
        quality_metrics: {
          accuracy_rate: 0.8,
          average_handling_time_hours: 3,
          total_reports: 50,
          upheld_decisions: 40,
        },
      };

      mockSupabaseChain.single.mockResolvedValueOnce({
        data: mockCurrentMetrics,
        error: null,
      });

      mockSupabaseChain.single.mockResolvedValueOnce({
        data: {},
        error: null,
      });

      await updateFlaggerMetrics('flagger-123', {
        total_reports: 60,
        upheld_decisions: 50,
      });

      expect(mockSupabaseChain.update).toHaveBeenCalledWith({
        quality_metrics: expect.objectContaining({
          total_reports: 60,
          upheld_decisions: 50,
        }),
      });
    });
  });

  describe('getFlaggersDueForReview', () => {
    it('should return flaggers needing review', async () => {
      const mockFlaggers = [
        {
          id: 'flagger-1',
          status: 'active',
          review_date: new Date(Date.now() - 1000).toISOString(),
          certification_date: '2025-01-01T00:00:00Z',
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
        },
      ];

      // Treat mockSupabaseChain as a Promise-like object
      (mockSupabaseChain as any).then = jest
        .fn()
        .mockImplementation((resolve) =>
          resolve({ data: mockFlaggers, error: null })
        );

      const result = await getFlaggersDueForReview();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('flagger-1');
    });
  });
});
