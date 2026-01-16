import { type SupabaseClient } from '@supabase/supabase-js';

import { type AgeAuditService } from './age-audit-service';
import { AgeGatingService } from './age-gating-service';

// Mock AgeAuditService
const mockLogAgeGatingEvent = jest.fn();
const mockAgeAuditService = {
  logAgeGatingEvent: mockLogAgeGatingEvent,
} as unknown as AgeAuditService;

// Mock Supabase
const mockSelect = jest.fn();
const mockEq = jest.fn();
const mockLimit = jest.fn();
const mockFrom = jest.fn(() => ({
  select: mockSelect,
}));

mockSelect.mockReturnValue({ eq: mockEq });
mockEq.mockReturnValue({ eq: mockEq }); // Chained eq
// The second eq returns object with limit
mockEq.mockReturnValue({ limit: mockLimit });

const mockSupabase = {
  from: mockFrom,
} as unknown as SupabaseClient;

describe('AgeGatingService', () => {
  let service: AgeGatingService;
  const consoleErrorSpy = jest
    .spyOn(console, 'error')
    .mockImplementation(() => {});

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AgeGatingService(mockSupabase, mockAgeAuditService);

    // Reset chain mocks
    mockFrom.mockClear();
    mockSelect.mockClear();
    mockEq.mockClear();
    mockLimit.mockClear();

    // Re-setup the chain for each test as robustly as possible

    // Let's use a simpler chaining mock strategy
    mockLimit.mockResolvedValue({ data: [], error: null });

    const builder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      limit: mockLimit,
    };
    mockFrom.mockReturnValue(builder);
  });

  afterAll(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('isContentAgeRestricted', () => {
    it('should fail-closed (return true) and log error when Supabase returns an error', async () => {
      mockLimit.mockResolvedValue({
        data: null,
        error: { message: 'DB Connection Error' },
      });

      const result = await service.isContentAgeRestricted('content-1', 'post');

      expect(result).toBe(true);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[AgeGatingService] Restriction lookup failed:',
        'DB Connection Error'
      );
    });

    it('should return true when content is restricted', async () => {
      mockLimit.mockResolvedValue({
        data: [{ is_age_restricted: true }],
        error: null,
      });

      const result = await service.isContentAgeRestricted('content-1', 'post');

      expect(result).toBe(true);
    });

    it('should return false when content is not restricted', async () => {
      mockLimit.mockResolvedValue({
        data: [{ is_age_restricted: false }],
        error: null,
      });

      const result = await service.isContentAgeRestricted('content-1', 'post');

      expect(result).toBe(false);
    });

    it('should return false when content record is missing', async () => {
      mockLimit.mockResolvedValue({
        data: [],
        error: null,
      });

      const result = await service.isContentAgeRestricted('content-1', 'post');

      expect(result).toBe(false);
    });
  });
});
