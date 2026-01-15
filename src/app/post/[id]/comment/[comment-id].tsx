import { type Href, Redirect, useLocalSearchParams } from 'expo-router';
import type { ReactElement } from 'react';

export default function PostCommentRedirect(): ReactElement {
  const params = useLocalSearchParams<{
    id: string;
    'comment-id': string;
  }>();

  const postId = params.id;
  const commentId = params['comment-id'];

  if (!postId) {
    return <Redirect href="/feed" />;
  }

  const href = (
    commentId
      ? `/feed/${postId}?commentId=${encodeURIComponent(commentId)}`
      : `/feed/${postId}`
  ) as Href;

  return <Redirect href={href} />;
}
