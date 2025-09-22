import React from 'react';

import modManager from '@/lib/moderation/moderation-manager';
import { cleanup, screen, setup } from '@/lib/test-utils';

import { ModerationActions } from './moderation-actions';

afterEach(cleanup);

describe('ModerationActions', () => {
  const contentId = 123;
  const authorId = 99;

  beforeEach(() => {
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

  test('invokes manager methods on press', async () => {
    const { user } = setup(
      <ModerationActions contentId={contentId} authorId={authorId} />
    );

    await screen.findByTestId('moderation-report-btn');
    await screen.findByTestId('moderation-block-btn');
    await screen.findByTestId('moderation-mute-btn');
    await screen.findByTestId('moderation-delete-btn');

    await user.press(screen.getByTestId('moderation-report-btn'));
    expect(modManager.reportContent).toHaveBeenCalledWith(contentId, 'other');

    await user.press(screen.getByTestId('moderation-block-btn'));
    expect(modManager.blockUser).toHaveBeenCalledWith(authorId);

    await user.press(screen.getByTestId('moderation-mute-btn'));
    expect(modManager.muteUser).toHaveBeenCalledWith(authorId);

    await user.press(screen.getByTestId('moderation-delete-btn'));
    expect(modManager.deleteOwnContent).toHaveBeenCalledWith(contentId);
  });
});
