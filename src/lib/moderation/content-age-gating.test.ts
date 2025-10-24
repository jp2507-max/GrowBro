/**
 * Content Age-Gating Engine Tests
 *
 * Tests age-restricted content filtering, flagging, and safer defaults
 *
 * Requirement 8.2: Age-restricted content enforcement
 */

import { createClient } from '@supabase/supabase-js';

import {
  ContentAgeGatingEngine,
  ContentAgeGatingHooks,
} from './content-age-gating';

// Mock Supabase client
jest.mock('@supabase/supabase-js');

describe('ContentAgeGatingEngine', () => {
  let engine: ContentAgeGatingEngine;
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      upsert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      single: jest.fn(),
    };

    (createClient as jest.Mock).mockReturnValue(mockSupabase);

    engine = new ContentAgeGatingEngine(mockSupabase);
  });

  describe('checkAgeGating', () => {
    it('should grant access to non-restricted content', async () => {
      const userId = 'user-123';
      const contentId = 'post-456';
      const contentType = 'post';

      // Mock no restriction
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' },
      });

      const result = await engine.checkAgeGating(
        userId,
        contentId,
        contentType
      );

      expect(result.granted).toBe(true);
      expect(result.reason).toBe('content_not_restricted');
      expect(result.requiresVerification).toBe(false);
    });

    it('should grant access to verified users for restricted content', async () => {
      const userId = 'user-123';
      const contentId = 'post-456';
      const contentType = 'post';

      // Mock restriction
      mockSupabase.single
        .mockResolvedValueOnce({
          data: {
            content_id: contentId,
            content_type: contentType,
            is_age_restricted: true,
            min_age: 18,
          },
          error: null,
        })
        // Mock verified user
        .mockResolvedValueOnce({
          data: {
            user_id: userId,
            is_age_verified: true,
          },
          error: null,
        });

      const result = await engine.checkAgeGating(
        userId,
        contentId,
        contentType
      );

      expect(result.granted).toBe(true);
      expect(result.reason).toBe('age_verified');
    });

    it('should deny access to unverified users for restricted content', async () => {
      const userId = 'user-123';
      const contentId = 'post-456';
      const contentType = 'post';

      // Mock restriction
      mockSupabase.single
        .mockResolvedValueOnce({
          data: {
            content_id: contentId,
            is_age_restricted: true,
          },
          error: null,
        })
        // Mock unverified user
        .mockResolvedValueOnce({
          data: {
            user_id: userId,
            is_age_verified: false,
            is_minor: true,
          },
          error: null,
        });

      const result = await engine.checkAgeGating(
        userId,
        contentId,
        contentType
      );

      expect(result.granted).toBe(false);
      expect(result.reason).toBe('minor_protections_active');
      expect(result.requiresVerification).toBe(true);
    });
  });

  describe('flagAgeRestrictedContent', () => {
    it('should flag content as age-restricted', async () => {
      const contentId = 'post-456';
      const contentType = 'post';

      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: 'restriction-123',
          content_id: contentId,
          content_type: contentType,
          is_age_restricted: true,
          min_age: 18,
          flagged_by_system: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        error: null,
      });

      const result = await engine.flagAgeRestrictedContent({
        contentId,
        contentType,
        minAge: 18,
        flaggedBySystem: true,
        flaggedByAuthor: false,
        flaggedByModerator: false,
        restrictionReason: 'Cannabis-related content',
      });

      expect(result.isAgeRestricted).toBe(true);
      expect(result.contentId).toBe(contentId);
      expect(mockSupabase.upsert).toHaveBeenCalled();
    });

    it('should support author-initiated age restriction tagging', async () => {
      const contentId = 'post-456';
      const contentType = 'post';

      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: 'restriction-123',
          content_id: contentId,
          content_type: contentType,
          is_age_restricted: true,
          flagged_by_author: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        error: null,
      });

      const result = await engine.flagAgeRestrictedContent({
        contentId,
        contentType,
        minAge: 18,
        flaggedBySystem: false,
        flaggedByAuthor: true,
        flaggedByModerator: false,
        restrictionReason: 'Author tagged as 18+',
      });

      expect(result.flaggedByAuthor).toBe(true);
    });

    it('should support moderator flagging with moderator ID', async () => {
      const contentId = 'post-456';
      const contentType = 'post';
      const moderatorId = 'mod-789';

      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: 'restriction-123',
          content_id: contentId,
          content_type: contentType,
          is_age_restricted: true,
          flagged_by_moderator: true,
          moderator_id: moderatorId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        error: null,
      });

      const result = await engine.flagAgeRestrictedContent({
        contentId,
        contentType,
        minAge: 18,
        flaggedBySystem: false,
        flaggedByAuthor: false,
        flaggedByModerator: true,
        moderatorId,
        restrictionReason: 'Moderator review',
      });

      expect(result.flaggedByModerator).toBe(true);
      expect(result.moderatorId).toBe(moderatorId);
    });
  });

  describe('autoFlagContent', () => {
    it('should automatically flag content with age-restricted keywords', async () => {
      const contentId = 'post-456';
      const contentType = 'post';
      const contentText =
        'My cannabis grow is looking great! The THC levels are amazing.';

      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: 'restriction-123',
          content_id: contentId,
          is_age_restricted: true,
          flagged_by_system: true,
          keywords_detected: ['cannabis', 'thc'],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        error: null,
      });

      const flagged = await engine.autoFlagContent(
        contentId,
        contentType,
        contentText
      );

      expect(flagged).toBe(true);
      expect(mockSupabase.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          flagged_by_system: true,
          keywords_detected: expect.arrayContaining(['cannabis', 'thc']),
        }),
        expect.any(Object)
      );
    });

    it('should not flag content without restricted keywords', async () => {
      const contentId = 'post-456';
      const contentType = 'post';
      const contentText = 'I love gardening and growing tomatoes!';

      const flagged = await engine.autoFlagContent(
        contentId,
        contentType,
        contentText
      );

      expect(flagged).toBe(false);
      expect(mockSupabase.upsert).not.toHaveBeenCalled();
    });

    it('should detect multiple age-restricted keywords', async () => {
      const contentId = 'post-456';
      const contentType = 'post';
      const contentText =
        'Medical cannabis cultivation guide. Learn about marijuana growing techniques.';

      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: 'restriction-123',
          keywords_detected: ['cannabis', 'cultivation', 'marijuana', 'grow'],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        error: null,
      });

      const flagged = await engine.autoFlagContent(
        contentId,
        contentType,
        contentText
      );

      expect(flagged).toBe(true);
    });
  });

  describe('filterContentByAge', () => {
    it('should not filter content for verified users', async () => {
      const userId = 'user-123';
      const contentIds = ['post-1', 'post-2', 'post-3'];
      const contentType = 'post';

      // Mock verified user
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          user_id: userId,
          is_age_verified: true,
        },
        error: null,
      });

      const filtered = await engine.filterContentByAge(
        userId,
        contentIds,
        contentType
      );

      expect(filtered).toEqual(contentIds);
      expect(mockSupabase.from).toHaveBeenCalledWith('user_age_status');
    });

    it('should filter restricted content for unverified users', async () => {
      const userId = 'user-123';
      const contentIds = ['post-1', 'post-2', 'post-3'];
      const contentType = 'post';

      // Mock unverified user
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          user_id: userId,
          is_age_verified: false,
        },
        error: null,
      });

      // Mock restricted content
      mockSupabase.select.mockResolvedValueOnce({
        data: [{ content_id: 'post-1' }, { content_id: 'post-3' }],
        error: null,
      });

      const filtered = await engine.filterContentByAge(
        userId,
        contentIds,
        contentType
      );

      expect(filtered).toEqual(['post-2']); // Only non-restricted content
      expect(mockSupabase.from).toHaveBeenCalledWith(
        'content_age_restrictions'
      );
    });

    it('should apply safer defaults for minors', async () => {
      const userId = 'user-123';
      const contentIds = ['post-1', 'post-2'];
      const contentType = 'post';

      // Mock minor user
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          user_id: userId,
          is_age_verified: false,
          is_minor: true,
        },
        error: null,
      });

      // Mock all content is restricted
      mockSupabase.select.mockResolvedValueOnce({
        data: contentIds.map((id) => ({ content_id: id })),
        error: null,
      });

      const filtered = await engine.filterContentByAge(
        userId,
        contentIds,
        contentType
      );

      expect(filtered).toEqual([]); // All content filtered for minor
    });
  });

  describe('removeAgeRestriction', () => {
    it('should remove age restriction from content', async () => {
      const contentId = 'post-456';
      const contentType = 'post';

      mockSupabase.update.mockResolvedValueOnce({
        error: null,
      });

      await engine.removeAgeRestriction(contentId, contentType);

      expect(mockSupabase.update).toHaveBeenCalledWith({
        is_age_restricted: false,
      });
    });
  });

  describe('getAgeRestrictionStats', () => {
    it('should return statistics for age-restricted content', async () => {
      mockSupabase.select.mockResolvedValueOnce({
        data: [
          {
            flagged_by_system: true,
            flagged_by_author: false,
            flagged_by_moderator: false,
          },
          {
            flagged_by_system: true,
            flagged_by_author: false,
            flagged_by_moderator: false,
          },
          {
            flagged_by_system: false,
            flagged_by_author: true,
            flagged_by_moderator: false,
          },
          {
            flagged_by_system: false,
            flagged_by_author: false,
            flagged_by_moderator: true,
          },
        ],
        error: null,
      });

      const stats = await engine.getAgeRestrictionStats();

      expect(stats.totalRestricted).toBe(4);
      expect(stats.systemFlagged).toBe(2);
      expect(stats.authorFlagged).toBe(1);
      expect(stats.moderatorFlagged).toBe(1);
    });
  });

  describe('applySaferDefaults', () => {
    it('should apply safer defaults for new users (minors)', async () => {
      const userId = 'user-123';

      mockSupabase.upsert.mockResolvedValueOnce({
        error: null,
      });

      await engine.applySaferDefaults(userId);

      expect(mockSupabase.upsert).toHaveBeenCalledWith({
        user_id: userId,
        is_age_verified: false,
        is_minor: true,
        minor_protections_enabled: true,
        show_age_restricted_content: false,
      });
    });
  });
});

describe('ContentAgeGatingHooks', () => {
  let hooks: ContentAgeGatingHooks;
  let mockEngine: jest.Mocked<ContentAgeGatingEngine>;

  beforeEach(() => {
    mockEngine = {
      autoFlagContent: jest.fn(),
      filterContentByAge: jest.fn(),
      applySaferDefaults: jest.fn(),
    } as any;

    hooks = new ContentAgeGatingHooks(mockEngine);
  });

  describe('onContentCreated', () => {
    it('should auto-flag content on creation', async () => {
      const contentId = 'post-456';
      const contentType = 'post';
      const contentText = 'Cannabis growing guide';

      mockEngine.autoFlagContent.mockResolvedValueOnce(true);

      await hooks.onContentCreated(contentId, contentType, contentText);

      expect(mockEngine.autoFlagContent).toHaveBeenCalledWith(
        contentId,
        contentType,
        contentText
      );
    });
  });

  describe('onFeedLoad', () => {
    it('should filter feed content based on user age', async () => {
      const userId = 'user-123';
      const contentIds = ['post-1', 'post-2', 'post-3'];
      const contentType = 'post';

      mockEngine.filterContentByAge.mockResolvedValueOnce(['post-2']);

      const result = await hooks.onFeedLoad(userId, contentIds, contentType);

      expect(result).toEqual(['post-2']);
      expect(mockEngine.filterContentByAge).toHaveBeenCalled();
    });
  });

  describe('onUserRegistered', () => {
    it('should apply safer defaults on user registration', async () => {
      const userId = 'user-123';

      mockEngine.applySaferDefaults.mockResolvedValueOnce(undefined);

      await hooks.onUserRegistered(userId);

      expect(mockEngine.applySaferDefaults).toHaveBeenCalledWith(userId);
    });
  });
});
