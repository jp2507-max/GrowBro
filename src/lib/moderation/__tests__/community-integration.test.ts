/**
 * Community Integration Tests
 *
 * Tests the integration between moderation system and community features
 *
 * Requirements: 1.1, 8.7, 9.4
 */

import { supabase } from '@/lib/supabase';

import { communityIntegration } from '../community-integration';
import { contentVisibilityService } from '../content-visibility-service';

// Mock Supabase
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

// Mock auth utils
jest.mock('@/lib/auth/user-utils', () => ({
  getOptionalAuthenticatedUserId: jest.fn(),
}));

describe('Community Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Content Visibility', () => {
    it('should check content visibility with moderation status', async () => {
      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
          }),
        }),
      });

      (supabase.from as jest.Mock).mockImplementation(mockFrom);

      const result = await communityIntegration.checkContentVisibility(
        'post-123',
        'post'
      );

      expect(result.visible).toBe(true);
    });

    it('should return not visible for removed content', async () => {
      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { action: 'remove', status: 'executed' },
                error: null,
              }),
            }),
          }),
        }),
      });

      (supabase.from as jest.Mock).mockImplementation(mockFrom);

      const result = await communityIntegration.checkContentVisibility(
        'post-123',
        'post'
      );

      expect(result.visible).toBe(false);
      expect(result.reason).toBe('removed');
    });
  });

  describe('Report Permission', () => {
    it('should allow users without violations to report', async () => {
      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116' },
            }),
          }),
        }),
      });

      (supabase.from as jest.Mock).mockImplementation(mockFrom);

      const result = await communityIntegration.canUserReportContent('user-1');

      expect(result.allowed).toBe(true);
    });

    it('should block suspended users from reporting', async () => {
      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                manifestly_unfounded_reports: 5,
                status: 'suspended',
              },
              error: null,
            }),
          }),
        }),
      });

      (supabase.from as jest.Mock).mockImplementation(mockFrom);

      const result = await communityIntegration.canUserReportContent('user-1');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('suspended');
    });
  });

  describe('Content Locator', () => {
    it('should generate correct post locator', () => {
      const locator = communityIntegration.getContentLocator('123', 'post');
      expect(locator).toBe('growbro://feed/123');
    });

    it('should generate correct comment locator', () => {
      const locator = communityIntegration.getContentLocator('456', 'comment');
      expect(locator).toBe('growbro://comment/456');
    });
  });

  describe('Content Visibility Service', () => {
    it('should apply moderation decision to content', async () => {
      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'decision-1',
                action: 'remove',
                reasoning: 'Test reason',
                statement_of_reasons: null,
              },
              error: null,
            }),
          }),
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            error: null,
          }),
        }),
      });

      (supabase.from as jest.Mock).mockImplementation(mockFrom);

      await expect(
        contentVisibilityService.applyModerationDecision({
          decisionId: 'decision-1',
          contentId: 'post-123',
          contentType: 'post',
          action: 'remove',
        })
      ).resolves.not.toThrow();
    });

    it('should restore content visibility after appeal', async () => {
      const mockFrom = jest.fn().mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            error: null,
          }),
        }),
      });

      (supabase.from as jest.Mock).mockImplementation(mockFrom);

      await expect(
        contentVisibilityService.restoreContentVisibility('post-123', 'post')
      ).resolves.not.toThrow();
    });
  });
});
