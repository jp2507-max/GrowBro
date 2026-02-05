import React from 'react';

import PostCommentRedirect from '@/app/post/[id]/comment/[comment-id]';
import { cleanup, setup } from '@/lib/test-utils';

const redirectSpy = jest.fn();
const useLocalSearchParamsMock = jest.fn();

jest.mock('expo-router', () => ({
  Redirect: (props: { href: string }) => {
    redirectSpy(props);
    return null;
  },
  useLocalSearchParams: () => useLocalSearchParamsMock(),
}));

afterEach(() => {
  cleanup();
  redirectSpy.mockClear();
});

describe('PostCommentRedirect', () => {
  it('redirects to the post with commentId', () => {
    useLocalSearchParamsMock.mockReturnValue({
      id: 'post-123',
      'comment-id': 'comment-456',
    });

    setup(<PostCommentRedirect />);

    expect(redirectSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        href: '/feed/post-123?commentId=comment-456',
      })
    );
  });

  it('redirects to the post when commentId is missing', () => {
    useLocalSearchParamsMock.mockReturnValue({
      id: 'post-123',
      'comment-id': undefined,
    });

    setup(<PostCommentRedirect />);

    expect(redirectSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        href: '/feed/post-123',
      })
    );
  });
});
