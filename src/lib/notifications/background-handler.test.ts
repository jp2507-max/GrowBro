import { Platform } from 'react-native';

import { cleanup } from '@/lib/test-utils';

import { BackgroundNotificationHandler } from './background-handler';

jest.mock('@/lib/notifications/notification-storage');
jest.mock('@/lib/sentry-utils');

afterEach(() => {
  cleanup();
  jest.clearAllMocks();
  BackgroundNotificationHandler.setDozeMode(false);
});

const createMockMessage = () => ({
  data: {
    type: 'community_interaction',
    messageId: 'msg-123',
    postId: 'post-456',
    userId: 'user-789',
  },
  messageId: 'msg-123',
});

async function setupMockStorage() {
  const { saveNotifications } = await import(
    '@/lib/notifications/notification-storage'
  );
  const mockSave = saveNotifications as jest.Mock;
  mockSave.mockResolvedValue(undefined);
  return mockSave;
}

async function setupMockSentry() {
  const { captureCategorizedErrorSync } = await import('@/lib/sentry-utils');
  return captureCategorizedErrorSync as jest.Mock;
}

function testHandleBackgroundMessage() {
  const mockMessage = createMockMessage();

  it('should handle iOS background messages', async () => {
    Platform.OS = 'ios';
    const mockSave = await setupMockStorage();

    await BackgroundNotificationHandler.handleBackgroundMessage(mockMessage);

    expect(mockSave).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'msg-123',
        type: 'community_interaction',
        messageId: 'msg-123',
      }),
    ]);
  });

  it('should handle Android messages when not in Doze mode', async () => {
    Platform.OS = 'android';
    BackgroundNotificationHandler.setDozeMode(false);
    const mockSave = await setupMockStorage();

    await BackgroundNotificationHandler.handleBackgroundMessage(mockMessage);

    expect(mockSave).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'msg-123',
        type: 'community_interaction',
        messageId: 'msg-123',
      }),
    ]);
  });

  it('should queue messages when in Doze mode on Android', async () => {
    Platform.OS = 'android';
    BackgroundNotificationHandler.setDozeMode(true);
    const { saveNotifications } = await import(
      '@/lib/notifications/notification-storage'
    );
    const mockSave = saveNotifications as jest.Mock;

    await BackgroundNotificationHandler.handleBackgroundMessage(mockMessage);

    expect(mockSave).not.toHaveBeenCalled();
    expect(BackgroundNotificationHandler.getPendingTaskCount()).toBe(1);
  });

  it('should handle errors gracefully', async () => {
    Platform.OS = 'android';
    const { saveNotifications } = await import(
      '@/lib/notifications/notification-storage'
    );
    const mockSave = saveNotifications as jest.Mock;
    mockSave.mockRejectedValue(new Error('Storage error'));
    const mockCapture = await setupMockSentry();

    await BackgroundNotificationHandler.handleBackgroundMessage(mockMessage);

    expect(mockCapture).toHaveBeenCalledWith(expect.any(Error), {
      operation: 'sync_notification_data',
      messageId: 'msg-123',
    });
  });
}

function testProcessPendingTasks() {
  const mockMessage = createMockMessage();

  it('should process all queued tasks', async () => {
    Platform.OS = 'android';
    BackgroundNotificationHandler.setDozeMode(true);
    const message1 = { ...mockMessage, messageId: 'msg-1' };
    const message2 = { ...mockMessage, messageId: 'msg-2' };
    const message3 = { ...mockMessage, messageId: 'msg-3' };

    await BackgroundNotificationHandler.handleBackgroundMessage(message1);
    await BackgroundNotificationHandler.handleBackgroundMessage(message2);
    await BackgroundNotificationHandler.handleBackgroundMessage(message3);
    expect(BackgroundNotificationHandler.getPendingTaskCount()).toBe(3);

    BackgroundNotificationHandler.setDozeMode(false);
    const mockSave = await setupMockStorage();

    await BackgroundNotificationHandler.processPendingTasks();

    expect(mockSave).toHaveBeenCalledTimes(3);
    expect(BackgroundNotificationHandler.getPendingTaskCount()).toBe(0);
  });

  it('should handle empty queue gracefully', async () => {
    await expect(
      BackgroundNotificationHandler.processPendingTasks()
    ).resolves.not.toThrow();
  });

  it('should clear queue after processing', async () => {
    Platform.OS = 'android';
    BackgroundNotificationHandler.setDozeMode(true);

    await BackgroundNotificationHandler.handleBackgroundMessage(mockMessage);
    expect(BackgroundNotificationHandler.getPendingTaskCount()).toBe(1);

    BackgroundNotificationHandler.setDozeMode(false);
    await setupMockStorage();

    await BackgroundNotificationHandler.processPendingTasks();

    expect(BackgroundNotificationHandler.getPendingTaskCount()).toBe(0);
  });

  it('should handle errors in pending tasks', async () => {
    Platform.OS = 'android';
    BackgroundNotificationHandler.setDozeMode(true);

    await BackgroundNotificationHandler.handleBackgroundMessage(mockMessage);
    BackgroundNotificationHandler.setDozeMode(false);

    const { saveNotifications } = await import(
      '@/lib/notifications/notification-storage'
    );
    const mockSave = saveNotifications as jest.Mock;
    mockSave.mockRejectedValue(new Error('Processing error'));
    const mockCapture = await setupMockSentry();

    await BackgroundNotificationHandler.processPendingTasks();

    expect(mockCapture).toHaveBeenCalled();
    expect(BackgroundNotificationHandler.getPendingTaskCount()).toBe(0);
  });
}

function testStateManagement() {
  const mockMessage = createMockMessage();

  it('should update Doze mode state', () => {
    BackgroundNotificationHandler.setDozeMode(true);
    BackgroundNotificationHandler.setDozeMode(false);
  });

  it('should return correct pending task count', async () => {
    Platform.OS = 'android';
    BackgroundNotificationHandler.setDozeMode(true);

    expect(BackgroundNotificationHandler.getPendingTaskCount()).toBe(0);

    await BackgroundNotificationHandler.handleBackgroundMessage(mockMessage);
    expect(BackgroundNotificationHandler.getPendingTaskCount()).toBe(1);

    await BackgroundNotificationHandler.handleBackgroundMessage(mockMessage);
    expect(BackgroundNotificationHandler.getPendingTaskCount()).toBe(2);
  });
}

describe('BackgroundNotificationHandler', () => {
  describe('handleBackgroundMessage', testHandleBackgroundMessage);
  describe('processPendingTasks', testProcessPendingTasks);
  describe('state management', testStateManagement);
});
