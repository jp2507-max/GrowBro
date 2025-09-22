import React from 'react';

import { showErrorMessage } from '@/components/ui/utils';
import modManager from '@/lib/moderation/moderation-manager';
import { captureCategorizedErrorSync } from '@/lib/sentry-utils';
import { cleanup, screen, setup } from '@/lib/test-utils';

import { ModerationActions } from './moderation-actions';

jest.mock('@/lib/sentry-utils');
jest.mock('@/components/ui/utils');
jest.mock('@/lib', () => ({
  translate: jest.fn((key: string) => key), // Return key as-is for testing
}));

// Create mock authentication error class for testing
class MockAuthenticationError extends Error {
  constructor(message: string = 'User not authenticated') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

// Mock the auth module
const mockGetAuthenticatedUserId = jest.fn();
jest.mock('@/lib/auth', () => ({
  AuthenticationError: MockAuthenticationError,
  getAuthenticatedUserId: mockGetAuthenticatedUserId,
}));

afterEach(cleanup);

describe('ModerationActions', () => {
  const contentId = 123;
  const authorId = 99;
  const userId = 'user-123';

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAuthenticatedUserId.mockResolvedValue(userId);
    jest
      .spyOn(modManager, 'reportContent')
      .mockResolvedValue({ status: 'sent', submittedAt: Date.now() } as any);
    jest
      .spyOn(modManager, 'blockUser')
      .mockResolvedValue({ status: 'ok', blockedUserId: authorId } as any);
    jest
      .spyOn(modManager, 'muteUser')
      .mockResolvedValue({ status: 'ok', mutedUserId: authorId } as any);
    jest
      .spyOn(modManager, 'deleteOwnContent')
      .mockResolvedValue({ status: 'ok', contentId } as any);
  });

  test('renders all moderation buttons', async () => {
    setup(<ModerationActions contentId={contentId} authorId={authorId} />);
    expect(await screen.findByTestId('moderation-actions')).toBeOnTheScreen();
    expect(screen.getByTestId('moderation-report-btn')).toBeOnTheScreen();
    expect(screen.getByTestId('moderation-block-btn')).toBeOnTheScreen();
    expect(screen.getByTestId('moderation-mute-btn')).toBeOnTheScreen();
    expect(screen.getByTestId('moderation-delete-btn')).toBeOnTheScreen();
  });

  test('invokes manager methods on press with authenticated userId', async () => {
    const { user } = setup(
      <ModerationActions contentId={contentId} authorId={authorId} />
    );

    await screen.findByTestId('moderation-report-btn');

    await user.press(screen.getByTestId('moderation-report-btn'));
    expect(modManager.reportContent).toHaveBeenCalledWith(
      contentId,
      'other',
      userId
    );

    await user.press(screen.getByTestId('moderation-block-btn'));
    expect(modManager.blockUser).toHaveBeenCalledWith(authorId, userId);

    await user.press(screen.getByTestId('moderation-mute-btn'));
    expect(modManager.muteUser).toHaveBeenCalledWith(authorId, userId);

    await user.press(screen.getByTestId('moderation-delete-btn'));
    expect(modManager.deleteOwnContent).toHaveBeenCalledWith(contentId, userId);
  });

  test('handles authentication error gracefully', async () => {
    const authError = new MockAuthenticationError('Not authenticated');
    mockGetAuthenticatedUserId.mockRejectedValue(authError);

    const { user } = setup(
      <ModerationActions contentId={contentId} authorId={authorId} />
    );

    await screen.findByTestId('moderation-report-btn');
    await user.press(screen.getByTestId('moderation-report-btn'));

    expect(showErrorMessage).toHaveBeenCalledWith(
      'moderation.authentication_required'
    );
  });

  test('handles network error gracefully', async () => {
    const networkError = new Error('Network error');
    jest.spyOn(modManager, 'deleteOwnContent').mockRejectedValue(networkError);

    const { user } = setup(
      <ModerationActions contentId={contentId} authorId={authorId} />
    );

    await screen.findByTestId('moderation-delete-btn');
    await user.press(screen.getByTestId('moderation-delete-btn'));

    expect(captureCategorizedErrorSync).toHaveBeenCalledWith(networkError);
    expect(showErrorMessage).toHaveBeenCalledWith('moderation.delete_failed');
  });

  test('calls onDeleteSuccess when delete succeeds', async () => {
    const onDeleteSuccess = jest.fn();

    const { user } = setup(
      <ModerationActions
        contentId={contentId}
        authorId={authorId}
        onDeleteSuccess={onDeleteSuccess}
      />
    );

    await screen.findByTestId('moderation-delete-btn');
    await user.press(screen.getByTestId('moderation-delete-btn'));

    expect(onDeleteSuccess).toHaveBeenCalled();
  });
});
