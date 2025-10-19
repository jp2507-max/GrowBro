import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { cleanup } from '@/lib/test-utils';

import {
  type CommunityNotification,
  NotificationGroupingService,
} from './grouping-service';

jest.mock('expo-notifications', () => ({
  scheduleNotificationAsync: jest.fn(),
}));
jest.mock('@/lib/notifications/android-channels');
jest.mock('@/lib/sentry-utils');

afterEach(() => {
  cleanup();
  jest.clearAllMocks();
  NotificationGroupingService.resetGroupCount('post_123');
  NotificationGroupingService.resetGroupCount('post_456');
  NotificationGroupingService.resetGroupCount('thread_123');
});

function createMockNotification(): CommunityNotification {
  return {
    notification: {
      date: Date.now(),
      request: {
        identifier: 'test-notification-id',
        content: {
          title: 'New Reply',
          subtitle: '',
          body: 'Someone replied to your post',
          data: { postId: '123' },
          categoryIdentifier: '',
          sound: 'default' as const,
        },
        trigger: null,
      },
    } as Notifications.Notification,
    type: 'community.interaction' as const,
    postId: '123',
    threadId: 'thread_123',
  };
}

function setupMockScheduler(): jest.MockedFunction<
  typeof Notifications.scheduleNotificationAsync
> {
  const mockSchedule = jest.mocked(Notifications.scheduleNotificationAsync);
  mockSchedule.mockResolvedValue('notif-id');
  return mockSchedule;
}

function setupMockChannelId(channelId: string): void {
  const {
    getAndroidChannelId,
  } = require('@/lib/notifications/android-channels');
  jest.mocked(getAndroidChannelId).mockReturnValue(channelId);
}

function testAndroidGrouping() {
  const mockNotification = createMockNotification();

  beforeEach(() => {
    Platform.OS = 'android';
  });

  it('should create group summary and individual notification', async () => {
    const mockSchedule = setupMockScheduler();
    setupMockChannelId('community.interactions.v1');

    await NotificationGroupingService.handleCommunityNotification(
      mockNotification
    );

    expect(mockSchedule).toHaveBeenCalledTimes(2);

    const summaryCall = mockSchedule.mock.calls.find(
      (call) => call[0].content.data?.type === 'summary'
    );
    expect(summaryCall).toBeDefined();
    expect(summaryCall![0]).toMatchObject({
      content: {
        title: 'Community Activity',
        body: '1 new interaction',
        data: { groupKey: 'thread_123', type: 'summary' },
      },
      trigger: { channelId: 'community.interactions.v1' },
    });

    const individualCall = mockSchedule.mock.calls.find(
      (call) => !call[0].content.data?.type
    );
    expect(individualCall).toBeDefined();
    expect(individualCall![0]).toMatchObject({
      content: {
        title: 'New Reply',
        body: 'Someone replied to your post',
        data: { postId: '123', groupKey: 'thread_123' },
      },
      trigger: { channelId: 'community.interactions.v1' },
    });
  });

  it('should use correct channel ID for likes', async () => {
    const mockSchedule = setupMockScheduler();
    setupMockChannelId('community.likes.v1');

    const likeNotification = {
      ...mockNotification,
      type: 'community.like' as const,
    };

    await NotificationGroupingService.handleCommunityNotification(
      likeNotification
    );

    expect(mockSchedule).toHaveBeenCalledWith(
      expect.objectContaining({
        trigger: { channelId: 'community.likes.v1' },
      })
    );
  });

  it('should present single notification without grouping when postId and threadId are missing', async () => {
    const mockSchedule = setupMockScheduler();
    setupMockChannelId('community.interactions.v1');

    const notificationWithoutIds = {
      ...mockNotification,
      postId: undefined,
      threadId: undefined,
    };

    await NotificationGroupingService.handleCommunityNotification(
      notificationWithoutIds
    );

    expect(mockSchedule).toHaveBeenCalledTimes(1);
    expect(mockSchedule).toHaveBeenCalledWith({
      content: {
        title: 'New Reply',
        body: 'Someone replied to your post',
        data: { postId: '123' },
      },
      trigger: { channelId: 'community.interactions.v1' },
    });
  });
}

function testIOSThreading() {
  const mockNotification = createMockNotification();

  beforeEach(() => {
    Platform.OS = 'ios';
  });

  it('should set threadIdentifier for visual grouping', async () => {
    const mockSchedule = setupMockScheduler();

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
    const mockSchedule = setupMockScheduler();

    const { threadId: _t, ...notificationWithoutThread } = mockNotification;
    await NotificationGroupingService.handleCommunityNotification(
      notificationWithoutThread as unknown as CommunityNotification
    );

    expect(mockSchedule).toHaveBeenCalledWith({
      content: expect.objectContaining({
        threadIdentifier: 'post_123',
      }),
      trigger: null,
    });
  });
}

function testGroupCountManagement(): void {
  it('should reset count for specific group', async () => {
    Platform.OS = 'android';

    const Notifications = require('expo-notifications');
    const anyNotifications: any = Notifications as any;
    anyNotifications.scheduleNotificationAsync = jest
      .fn()
      .mockResolvedValue('notif-id');

    setupMockChannelId('community.interactions.v1');

    const notification = {
      notification: {
        date: Date.now(),
        request: {
          identifier: 'test-notification-id',
          content: {
            title: 'Test',
            subtitle: '',
            body: 'Test',
            data: {},
            categoryIdentifier: '',
            sound: 'default' as const,
          },
          trigger: null,
        },
      } as Notifications.Notification,
      type: 'community.interaction' as const,
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
