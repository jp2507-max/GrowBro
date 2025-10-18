/**
 * User Profile Screen
 *
 * Displays user profile with avatar, username, bio, and paginated posts
 * Handles loading states, errors, and restricted profiles
 */

import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';

import { useUserProfile } from '@/api/community';
import { useUserPosts } from '@/api/community/use-user-posts';
import {
  ProfileSkeleton,
  RestrictedProfileMessage,
  UserPostsList,
  UserProfileHeader,
} from '@/components/community';
import { FocusAwareStatusBar, View } from '@/components/ui';
import { translate } from '@/lib/i18n';

export default function UserProfile() {
  const router = useRouter();
  const { userId } = useLocalSearchParams<{ userId: string }>();

  const {
    data: profile,
    isPending: isLoadingProfile,
    isError: isProfileError,
  } = useUserProfile({ variables: { userId } });

  const {
    data: postsData,
    isPending: isLoadingPosts,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useUserPosts({ variables: { userId, limit: 20 } });

  // Flatten all pages of posts (compute before conditional returns)
  const allPosts = React.useMemo(
    () => postsData?.pages.flatMap((page) => page.results) ?? [],
    [postsData]
  );

  const handleBack = React.useCallback(() => {
    router.back();
  }, [router]);

  const handleEndReached = React.useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Loading state
  if (isLoadingProfile || isLoadingPosts) {
    return (
      <View className="flex-1">
        <Stack.Screen
          options={{
            title: translate('nav.profile'),
            headerBackTitle: translate('nav.back'),
          }}
        />
        <FocusAwareStatusBar />
        <ProfileSkeleton />
      </View>
    );
  }

  // Error or restricted profile state
  if (isProfileError || !profile) {
    return (
      <View className="flex-1">
        <Stack.Screen
          options={{
            title: translate('nav.profile'),
            headerBackTitle: translate('nav.back'),
          }}
        />
        <FocusAwareStatusBar />
        <RestrictedProfileMessage reason="not_found" onBack={handleBack} />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-neutral-50 dark:bg-neutral-950">
      <Stack.Screen
        options={{
          title: profile.username,
          headerBackTitle: translate('nav.back'),
        }}
      />
      <FocusAwareStatusBar />

      <UserProfileHeader profile={profile} />

      <View className="flex-1">
        <UserPostsList
          posts={allPosts}
          isLoading={false}
          isFetchingNextPage={isFetchingNextPage}
          hasNextPage={hasNextPage ?? false}
          onEndReached={handleEndReached}
        />
      </View>
    </View>
  );
}
