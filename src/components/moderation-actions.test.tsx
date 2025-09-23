// Create mock authentication error class for testing
import React from 'react';

import { showErrorMessage } from '@/components/ui/utils';
// Mock getAuthenticatedUserId
import * as authUtils from '@/lib/auth/user-utils';
import { AuthenticationError } from '@/lib/auth/user-utils';
// Mock the translate function
import * as i18nUtils from '@/lib/i18n/utils';
import { moderationManager as modManager } from '@/lib/moderation/moderation-manager';
import { captureCategorizedErrorSync } from '@/lib/sentry-utils';
import { cleanup, screen, setup, waitFor } from '@/lib/test-utils';

import { ModerationActions } from './moderation-actions';
const mockGetAuthenticatedUserId = jest.spyOn(
  authUtils,
  'getAuthenticatedUserId'
);
jest.spyOn(i18nUtils, 'translate').mockImplementation((key: string) => key);

jest.mock('@/lib/sentry-utils');
jest.mock('@/components/ui/utils');

afterEach(cleanup);

const contentId = 123;
const authorId = 99;
const userId = 'user-123';

const setupMocks = () => {
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
};

describe('ModerationActions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupMocks();
  });

  test('renders all moderation buttons', async () => {
    setup(<ModerationActions contentId={contentId} authorId={authorId} />);
    expect(await screen.findByTestId('moderation-actions')).toBeOnTheScreen();
    expect(screen.getByTestId('moderation-report-btn')).toBeOnTheScreen();
    expect(screen.getByTestId('moderation-block-btn')).toBeOnTheScreen();
    expect(screen.getByTestId('moderation-mute-btn')).toBeOnTheScreen();
    expect(screen.getByTestId('moderation-delete-btn')).toBeOnTheScreen();
  });
});

describe('ModerationActions - successful interactions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupMocks();
  });

  test('invokes manager methods on press with authenticated userId', async () => {
    const { user } = setup(
      <ModerationActions contentId={contentId} authorId={authorId} />
    );

    await screen.findByTestId('moderation-report-btn');

    await user.press(screen.getByTestId('moderation-report-btn'));
    await waitFor(() =>
      expect(modManager.reportContent).toHaveBeenCalledWith(
        contentId,
        'other',
        userId
      )
    );

    await user.press(screen.getByTestId('moderation-block-btn'));
    await waitFor(() =>
      expect(modManager.blockUser).toHaveBeenCalledWith(authorId, userId)
    );

    await user.press(screen.getByTestId('moderation-mute-btn'));
    await waitFor(() =>
      expect(modManager.muteUser).toHaveBeenCalledWith(authorId, userId)
    );

    await user.press(screen.getByTestId('moderation-delete-btn'));
    await waitFor(() =>
      expect(modManager.deleteOwnContent).toHaveBeenCalledWith(
        contentId,
        userId
      )
    );
  });
});

describe('ModerationActions - delete success callback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupMocks();
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

describe('ModerationActions - error handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupMocks();
  });

  test('handles authentication error gracefully', async () => {
    const authError = new AuthenticationError('Not authenticated');
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
});
