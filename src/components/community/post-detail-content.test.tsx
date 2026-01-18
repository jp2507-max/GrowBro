import React from 'react';

import { act, cleanup, fireEvent, render, screen } from '@/lib/test-utils';
import type { Post, PostComment } from '@/types/community';

import { PostDetailContent } from './post-detail-content';

jest.mock('@/components/community/post-action-bar', () => ({
  PostActionBar: () => null,
}));

jest.mock('./moderated-comment-item', () => {
  const { View } = require('react-native');

  return {
    ModeratedCommentItem: ({
      testID,
      onLayout,
    }: {
      testID?: string;
      onLayout?: (e: { nativeEvent: { layout: { y: number } } }) => void;
    }) => <View testID={testID} onLayout={onLayout} />,
  };
});

afterEach(cleanup);

function createTestPost(overrides: Partial<Post> = {}): Post {
  return {
    id: 'post-1',
    userId: 'user-1',
    body: '',
    created_at: '2025-01-01T00:00:00.000Z',
    updated_at: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function createTestComment(
  overrides: Partial<PostComment> & Pick<PostComment, 'id'>
): PostComment {
  const { id, ...restOverrides } = overrides;
  return {
    id,
    post_id: 'post-1',
    user_id: 'user-1',
    body: 'Hello',
    created_at: '2025-01-01T00:00:00.000Z',
    updated_at: '2025-01-01T00:00:00.000Z',
    ...restOverrides,
  };
}

describe('PostDetailContent', () => {
  beforeEach(() => {
    jest.useFakeTimers();

    // Ensure RAF-based effects can be controlled by Jest timers
    (
      global as {
        requestAnimationFrame: (cb: (time: number) => void) => number;
      }
    ).requestAnimationFrame = (cb: (time: number) => void) =>
      setTimeout(() => cb(0), 0) as unknown as number;
    (
      global as { cancelAnimationFrame: (id: number) => void }
    ).cancelAnimationFrame = (id: number) => clearTimeout(id);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('scrolls to highlighted comment when layout is known', () => {
    const scrollTo = jest.fn();
    const scrollViewRef = { current: null } as React.RefObject<{
      scrollTo: typeof scrollTo;
    } | null>;

    const comments: PostComment[] = [
      createTestComment({ id: 'c1' }),
      createTestComment({ id: 'c2' }),
    ];

    render(
      <PostDetailContent
        post={createTestPost()}
        displayUsername="user"
        relativeTime="now"
        isDark={false}
        hasImage={false}
        commentBody=""
        setCommentBody={() => {}}
        onCommentSubmit={() => {}}
        isSubmitting={false}
        comments={comments}
        isLoadingComments={false}
        highlightedCommentId="c2"
        bottomInset={0}
        commentInputRef={{ current: null }}
        scrollViewRef={scrollViewRef}
        onAuthorPress={() => {}}
        onStrainPress={() => {}}
        onSharePress={() => {}}
      />
    );

    // Assign scrollViewRef.current before triggering layout events
    (
      scrollViewRef as { current: { scrollTo: typeof scrollTo } | null }
    ).current = { scrollTo };

    fireEvent(screen.getByTestId('comment-list'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 400, width: 100, height: 100 } },
    });
    fireEvent(screen.getByTestId('comment-item-c2'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 120, width: 100, height: 50 } },
    });

    act(() => {
      jest.runAllTimers();
    });

    expect(scrollTo).toHaveBeenCalledWith(
      expect.objectContaining({ y: 496, animated: true })
    );
  });
});
