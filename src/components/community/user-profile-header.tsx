/**
 * UserProfileHeader component
 *
 * Displays user profile information including avatar, username, and bio
 */

import React from 'react';

import type { UserProfile } from '@/api/community';
import { Image, Text, View } from '@/components/ui';

interface UserProfileHeaderProps {
  profile: UserProfile;
  testID?: string;
}

export function UserProfileHeader({
  profile,
  testID = 'user-profile-header',
}: UserProfileHeaderProps): React.ReactElement {
  return (
    <View className="p-4" testID={testID}>
      <View className="flex-row items-center gap-4">
        {profile.avatar_url ? (
          <Image
            source={{ uri: profile.avatar_url }}
            className="size-20 rounded-full"
            contentFit="cover"
            testID={`${testID}-avatar`}
          />
        ) : (
          <View
            className="size-20 items-center justify-center rounded-full bg-primary-200 dark:bg-primary-800"
            testID={`${testID}-avatar-placeholder`}
          >
            <Text className="text-3xl font-bold text-primary-700 dark:text-primary-300">
              {profile.username.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}

        <View className="flex-1">
          <Text
            className="text-xl font-bold text-neutral-900 dark:text-neutral-100"
            testID={`${testID}-username`}
          >
            {profile.username}
          </Text>
          {profile.bio && (
            <Text
              className="mt-1 text-sm text-neutral-600 dark:text-neutral-400"
              testID={`${testID}-bio`}
            >
              {profile.bio}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}
