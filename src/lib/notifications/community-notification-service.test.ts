import { jest } from '@jest/globals';

import {
  CommunityNotificationService,
  generatePostDeepLink,
  LIKE_NOTIFICATION_RATE_LIMIT,
  parsePostDeepLink,
} from './community-notification-service';

// Mock database
const mockDatabase = {
  collections: {
    get: jest.fn(),
  },
  write: jest.fn().mockImplementation(async (executor: any) => {
    return executor({});
  }),
} as any;

function setupMockCollection() {
  const mockCollection = {
    query: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    fetch: jest.fn(),
    create: jest.fn(),
  };
  mockDatabase.collections.get.mockReturnValue(mockCollection);
  return mockCollection;
}

describe('CommunityNotificationService', () => {
  let service: CommunityNotificationService;
  let mockCollection: any;
  const testUserId = 'test-user-123';

  beforeEach(() => {
    jest.clearAllMocks();
    mockCollection = setupMockCollection();
    service = new CommunityNotificationService(mockDatabase);
  });

  describe('getCommunityNotificationConfig', () => {
    it('should return defaults when no preferences exist', async () => {
      mockCollection.fetch.mockResolvedValue([]);

      const config = await service.getCommunityNotificationConfig(testUserId);

      expect(config).toEqual({
        communityInteractionsEnabled: true,
        communityLikesEnabled: true,
      });
    });

    it('should return existing preferences', async () => {
      const mockPref = {
        communityInteractions: false,
        communityLikes: true,
      };
      mockCollection.fetch.mockResolvedValue([mockPref]);

      const config = await service.getCommunityNotificationConfig(testUserId);

      expect(config).toEqual({
        communityInteractionsEnabled: false,
        communityLikesEnabled: true,
      });
    });
  });

  describe('updateCommunityNotificationConfig', () => {
    it('should update preferences via findOrCreate', async () => {
      const mockPref = {
        update: jest.fn(),
      };
      mockCollection.fetch.mockResolvedValue([]);
      mockCollection.create.mockResolvedValue(mockPref);

      await service.updateCommunityNotificationConfig(testUserId, {
        communityInteractionsEnabled: false,
        communityLikesEnabled: false,
      });

      expect(mockDatabase.write).toHaveBeenCalled();
    });
  });

  describe('areLikeNotificationsEnabled', () => {
    it('should return true by default', async () => {
      mockCollection.fetch.mockResolvedValue([]);

      const enabled = await service.areLikeNotificationsEnabled(testUserId);
      expect(enabled).toBe(true);
    });

    it('should return false when disabled', async () => {
      const mockPref = {
        communityLikes: false,
        communityInteractions: true,
      };
      mockCollection.fetch.mockResolvedValue([mockPref]);

      const enabled = await service.areLikeNotificationsEnabled(testUserId);
      expect(enabled).toBe(false);
    });
  });

  describe('areCommentNotificationsEnabled', () => {
    it('should return true by default', async () => {
      mockCollection.fetch.mockResolvedValue([]);

      const enabled = await service.areCommentNotificationsEnabled(testUserId);
      expect(enabled).toBe(true);
    });

    it('should return false when disabled', async () => {
      const mockPref = {
        communityInteractions: false,
        communityLikes: true,
      };
      mockCollection.fetch.mockResolvedValue([mockPref]);

      const enabled = await service.areCommentNotificationsEnabled(testUserId);
      expect(enabled).toBe(false);
    });
  });
});

describe('LIKE_NOTIFICATION_RATE_LIMIT', () => {
  it('should define correct rate limit constants', () => {
    expect(LIKE_NOTIFICATION_RATE_LIMIT.maxPerPost).toBe(1);
    expect(LIKE_NOTIFICATION_RATE_LIMIT.windowMinutes).toBe(5);
    expect(LIKE_NOTIFICATION_RATE_LIMIT.collapseKeyPrefix).toBe('like_');
  });
});

describe('generatePostDeepLink', () => {
  it('should generate link for post without comment', () => {
    const link = generatePostDeepLink('post-123');
    expect(link).toBe('growbro://post/post-123');
  });

  it('should generate link for post with comment', () => {
    const link = generatePostDeepLink('post-123', 'comment-456');
    expect(link).toBe('growbro://post/post-123/comment/comment-456');
  });
});

describe('parsePostDeepLink', () => {
  it('should parse post-only deep link', () => {
    const result = parsePostDeepLink('growbro://post/post-123');
    expect(result).toEqual({
      postId: 'post-123',
      commentId: undefined,
    });
  });

  it('should parse post with comment deep link', () => {
    const result = parsePostDeepLink(
      'growbro://post/post-123/comment/comment-456'
    );
    expect(result).toEqual({
      postId: 'post-123',
      commentId: 'comment-456',
    });
  });

  it('should return null for invalid protocol', () => {
    const result = parsePostDeepLink('https://example.com/post/123');
    expect(result).toBeNull();
  });

  it('should return null for invalid path', () => {
    const result = parsePostDeepLink('growbro://invalid/path');
    expect(result).toBeNull();
  });

  it('should return null for missing post ID', () => {
    const result = parsePostDeepLink('growbro://post/');
    expect(result).toBeNull();
  });
});
