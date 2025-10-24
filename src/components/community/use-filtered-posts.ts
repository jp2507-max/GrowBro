/**
 * Hook for filtering posts based on age-gating and geo-restrictions
 */

import { useEffect, useState } from 'react';

import type { Post as ApiPost } from '@/api/posts';

interface UseFilteredPostsParams {
  posts: ApiPost[];
  isAgeVerified: boolean;
  userCountry: string | null;
  isAgeLoading: boolean;
  isGeoLoading: boolean;
  checkContentAvailability: (contentId: string) => Promise<boolean>;
}

export function useFilteredPosts({
  posts,
  isAgeVerified,
  userCountry,
  isAgeLoading,
  isGeoLoading,
  checkContentAvailability,
}: UseFilteredPostsParams) {
  const [filteredPosts, setFilteredPosts] = useState<ApiPost[]>([]);
  const [isFiltering, setIsFiltering] = useState(false);

  useEffect(() => {
    const filterPosts = async () => {
      if (isAgeLoading || isGeoLoading) return;

      setIsFiltering(true);
      try {
        // Apply age-gating filter
        let filtered = posts;
        if (!isAgeVerified) {
          filtered = posts.filter((post) => !post.is_age_restricted);
        }

        // Apply geo-restriction filter
        if (userCountry) {
          const availabilityChecks = await Promise.all(
            filtered.map((post) => checkContentAvailability(String(post.id)))
          );
          filtered = filtered.filter((_, index) => availabilityChecks[index]);
        }

        setFilteredPosts(filtered);
      } catch (error) {
        console.error('Error filtering posts:', error);
        // On error, show all posts to avoid blocking content
        setFilteredPosts(posts);
      } finally {
        setIsFiltering(false);
      }
    };

    filterPosts();
  }, [
    posts,
    isAgeVerified,
    userCountry,
    isAgeLoading,
    isGeoLoading,
    checkContentAvailability,
  ]);

  return { filteredPosts, isFiltering };
}
