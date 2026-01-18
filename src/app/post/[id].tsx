// Route alias for deep linking: growbro://post/:id
// This redirects to the main feed/[id] screen
import { type Href, Redirect, useLocalSearchParams } from 'expo-router';

export default function PostRedirect() {
  const { id, commentId } = useLocalSearchParams<{
    id: string;
    commentId?: string;
  }>();

  // Redirect to feed/[id] with optional commentId
  const href = (
    commentId ? `/feed/${id}?commentId=${commentId}` : `/feed/${id}`
  ) as Href;

  return <Redirect href={href} />;
}
