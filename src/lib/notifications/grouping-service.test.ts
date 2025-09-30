import { Platform } from 'react-native';

import { cleanup } from '@/lib/test-utils';

import { NotificationGroupingService } from './grouping-service';

jest.mock('expo-notifications');
jest.mock('@/lib/notifications/android-channels');
jest.mock('@/lib/sentry-utils');

afterEach(() => {
  cleanup();
  jest.clearAllMocks();
  NotificationGroupingService.resetGroupCount('post_123');
  NotificationGroupingService.resetGroupCount('post_456');
});

function createMockNotification() {
  return {
    notification: {
      request: {
        content: {
          title: 'New Reply',
          body: 'Someone replied to your post',
          data: { postId: '123' },
        },
      },
    },
    type: 'community_interaction' as const,
    postId: '123',
    threadId: 'thread_123',
  };
}

async function setupMockScheduler() {
  const { default: Notifications } = await import('expo-notifications');
  const anyNotifications: any = Notifications as any;
  const mockSchedule = jest.fn().mockResolvedValue('notif-id');
  anyNotifications.scheduleNotificationAsync = mockSchedule;
  return mockSchedule;
}

async function setupMockChannelId(channelId: string) {
  const { getAndroidChannelId } = await import(
    '@/lib/notifications/android-channels'
  );
  (getAndroidChannelId as jest.Mock).mockReturnValue(channelId);
}

function testAndroidGrouping() {
  const mockNotification = createMockNotification();

  beforeEach(() => {
    Platform.OS = 'android';
  });

  it('should create group summary and individual notification', async () => {
    const mockSchedule = await setupMockScheduler();
    await setupMockChannelId('community.interactions.v1');

    await NotificationGroupingService.handleCommunityNotification(
      mockNotification
    );

    expect(mockSchedule).toHaveBeenCalledTimes(2);

    const summaryCall = mockSchedule.mock.calls.find(
      (call) => call[0].groupSummary === true
    );
    expect(summaryCall).toBeDefined();
    expect(summaryCall[0]).toMatchObject({
      content: {
        title: 'Community Activity',
        body: '1 new interaction',
      },
      trigger: null,
      groupKey: 'post_123',
      groupSummary: true,
    });

    const individualCall = mockSchedule.mock.calls.find(
      (call) => !call[0].groupSummary
    );
    expect(individualCall).toBeDefined();
    expect(individualCall[0]).toMatchObject({
      content: {
        title: 'New Reply',
        body: 'Someone replied to your post',
      },
      groupKey: 'post_123',
    });
  });

  it('should use correct channel ID for likes', async () => {
    const mockSchedule = await setupMockScheduler();
    await setupMockChannelId('community.likes.v1');

    const likeNotification = {
      ...mockNotification,
      type: 'community_like' as const,
    };

    await NotificationGroupingService.handleCommunityNotification(
      likeNotification
    );

    expect(mockSchedule).toHaveBeenCalledWith(
      expect.objectContaining({
        channelId: 'community.likes.v1',
      })
    );
  });
}

function testIOSThreading() {
  const mockNotification = createMockNotification();

  beforeEach(() => {
    Platform.OS = 'ios';
  });

  it('should set threadIdentifier for visual grouping', async () => {
    const mockSchedule = await setupMockScheduler();

    await NotificationGroupingService.handleCommunityNotification(
      mockNotification
    );

    expect(mockSchedule).toHaveBeenCalledWith({
      content: {
        title: 'New Reply',
        body: 'Someone replied to your post',
        data: { postId: '123' },
        threadIdentifier: 'thread_123',
      },
      trigger: null,
    });
  });

  it('should fallback to post ID if threadId not provided', async () => {
    const mockSchedule = await setupMockScheduler();

    const notificationWithoutThread = {
      ...mockNotification,
      threadId: undefined,
    };

    await NotificationGroupingService.handleCommunityNotification(
      notificationWithoutThread
    );

    expect(mockSchedule).toHaveBeenCalledWith({
      content: expect.objectContaining({
        threadIdentifier: 'post_123',
      }),
      trigger: null,
    });
  });
}

function testGroupCountManagement() {
  it('should reset count for specific group', async () => {
    Platform.OS = 'android';

    const { default: Notifications } = await import('expo-notifications');
    const anyNotifications: any = Notifications as any;
    anyNotifications.scheduleNotificationAsync = jest
      .fn()
      .mockResolvedValue('notif-id');

    await setupMockChannelId('community.interactions.v1');

    const notification = {
      notification: {
        request: { content: { title: 'Test', body: 'Test', data: {} } },
      },
      type: 'community_interaction' as const,
      postId: '123',
    };

    await NotificationGroupingService.handleCommunityNotification(notification);
    expect(NotificationGroupingService.getGroupCount('post_123')).toBe(1);

    NotificationGroupingService.resetGroupCount('post_123');
    expect(NotificationGroupingService.getGroupCount('post_123')).toBe(0);
  });

  it('should return 0 for unknown group', () => {
    expect(NotificationGroupingService.getGroupCount('unknown_group')).toBe(0);
  });
}

describe('NotificationGroupingService', () => {
  describe('handleCommunityNotification', () => {
    describe('Android grouping', testAndroidGrouping);
    describe('iOS threading', testIOSThreading);
  });

  describe('Group count management', testGroupCountManagement);
});
