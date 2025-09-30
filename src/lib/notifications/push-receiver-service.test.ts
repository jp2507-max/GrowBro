import { cleanup } from '@/lib/test-utils';

import {
  __testResetGlobals,
  PushReceiverService,
} from './push-receiver-service';

jest.mock('expo-notifications');
jest.mock('@/lib/notifications/deep-link-service');
jest.mock('@/lib/notifications/grouping-service');
jest.mock('@/lib/notifications/push-service');
jest.mock('@/lib/sentry-utils');

afterEach(() => {
  cleanup();
  __testResetGlobals();
  jest.clearAllMocks();
});

async function setupMockNotifications() {
  const { default: Notifications } = await import('expo-notifications');
  const anyNotifications: any = Notifications as any;
  return anyNotifications;
}

function testSetupNotificationHandlers() {
  it('should set up notification handler with correct settings', async () => {
    const anyNotifications = await setupMockNotifications();
    const mockSetHandler = jest.fn();
    anyNotifications.setNotificationHandler = mockSetHandler;

    await PushReceiverService.setupNotificationHandlers();

    expect(mockSetHandler).toHaveBeenCalledWith({
      handleNotification: expect.any(Function),
    });

    const handler = mockSetHandler.mock.calls[0][0].handleNotification;
    const result = await handler();
    expect(result).toEqual({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    });
  });

  it('should register foreground and response listeners', async () => {
    const anyNotifications = await setupMockNotifications();
    const mockAddForeground = jest.fn(() => ({ remove: jest.fn() }));
    const mockAddResponse = jest.fn(() => ({ remove: jest.fn() }));

    anyNotifications.setNotificationHandler = jest.fn();
    anyNotifications.addNotificationReceivedListener = mockAddForeground;
    anyNotifications.addNotificationResponseReceivedListener = mockAddResponse;

    await PushReceiverService.setupNotificationHandlers();

    expect(mockAddForeground).toHaveBeenCalledWith(expect.any(Function));
    expect(mockAddResponse).toHaveBeenCalledWith(expect.any(Function));
  });

  it('should remove existing subscriptions before creating new ones', async () => {
    const anyNotifications = await setupMockNotifications();
    const mockRemove = jest.fn();

    anyNotifications.setNotificationHandler = jest.fn();
    anyNotifications.addNotificationReceivedListener = jest.fn(() => ({
      remove: mockRemove,
    }));
    anyNotifications.addNotificationResponseReceivedListener = jest.fn(() => ({
      remove: mockRemove,
    }));

    await PushReceiverService.setupNotificationHandlers();
    expect(mockRemove).not.toHaveBeenCalled();

    await PushReceiverService.setupNotificationHandlers();
    expect(mockRemove).toHaveBeenCalledTimes(2);
  });
}

function testRemoveNotificationHandlers() {
  it('should remove all notification subscriptions', async () => {
    const anyNotifications = await setupMockNotifications();
    const mockRemove = jest.fn();

    anyNotifications.setNotificationHandler = jest.fn();
    anyNotifications.addNotificationReceivedListener = jest.fn(() => ({
      remove: mockRemove,
    }));
    anyNotifications.addNotificationResponseReceivedListener = jest.fn(() => ({
      remove: mockRemove,
    }));

    await PushReceiverService.setupNotificationHandlers();
    PushReceiverService.removeNotificationHandlers();

    expect(mockRemove).toHaveBeenCalledTimes(2);
  });

  it('should handle null subscriptions gracefully', () => {
    expect(() => {
      PushReceiverService.removeNotificationHandlers();
    }).not.toThrow();
  });
}

function testHandleNotificationResponse() {
  it('should navigate to deep link when provided', async () => {
    const { DeepLinkService } = await import(
      '@/lib/notifications/deep-link-service'
    );
    const mockHandle = jest
      .fn()
      .mockResolvedValue({ ok: true, path: '/post/456' });
    (DeepLinkService.handle as jest.Mock) = mockHandle;

    const anyNotifications = await setupMockNotifications();
    let responseHandler: any;

    anyNotifications.setNotificationHandler = jest.fn();
    anyNotifications.addNotificationReceivedListener = jest.fn(() => ({
      remove: jest.fn(),
    }));
    anyNotifications.addNotificationResponseReceivedListener = jest.fn(
      (handler) => {
        responseHandler = handler;
        return { remove: jest.fn() };
      }
    );

    await PushReceiverService.setupNotificationHandlers();

    const response = {
      notification: {
        request: {
          content: {
            data: {
              deepLink: 'growbro://post/456',
            },
          },
        },
      },
      actionIdentifier: 'default',
    };

    await responseHandler(response);

    expect(mockHandle).toHaveBeenCalledWith('growbro://post/456');
  });
}

describe('PushReceiverService', () => {
  describe('setupNotificationHandlers', testSetupNotificationHandlers);
  describe('removeNotificationHandlers', testRemoveNotificationHandlers);
  describe('handleNotificationResponse', testHandleNotificationResponse);
});
