/**
 * PostCardAvatar - Floating avatar chip for post cards
 *
 * Glass-style pill with avatar image and username.
 * Positioned absolute top-left on card, links to user profile.
 */

import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet } from 'react-native';

import { GlassSurface } from '@/components/shared/glass-surface';
import { Image, Pressable, Text, View } from '@/components/ui';
import { translate, type TxKeyPath } from '@/lib/i18n';

const styles = StyleSheet.create({
  chip: {
    borderRadius: 20,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
});

type PostCardAvatarProps = {
  userId: string;
  displayUsername: string;
  avatarUrl?: string | null;
  testID?: string;
};

export const PostCardAvatar = React.memo(function PostCardAvatar({
  userId,
  displayUsername,
  avatarUrl,
  testID = 'post-card-avatar',
}: PostCardAvatarProps): React.ReactElement {
  const router = useRouter();

  const handlePress = React.useCallback(() => {
    router.push(`/community/${userId}`);
  }, [router, userId]);

  return (
    <Pressable
      onPress={handlePress}
      accessibilityLabel={displayUsername}
      accessibilityHint={translate(
        'accessibility.community.open_profile_hint' as TxKeyPath
      )}
      accessibilityRole="button"
      testID={testID}
    >
      <GlassSurface
        glassEffectStyle="clear"
        style={styles.chip}
        fallbackClassName="bg-black/30 border border-white/15"
      >
        <View className="flex-row items-center gap-2 py-1 pl-1 pr-3">
          {avatarUrl ? (
            <Image
              source={{ uri: avatarUrl }}
              style={styles.avatar}
              contentFit="cover"
              accessibilityIgnoresInvertColors
            />
          ) : (
            <View
              className="items-center justify-center rounded-full bg-primary-600"
              style={styles.avatar}
            >
              <Text className="text-xs font-bold text-white">
                {displayUsername.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <Text
            className="text-xs font-bold tracking-wide text-white"
            numberOfLines={1}
          >
            {displayUsername}
          </Text>
        </View>
      </GlassSurface>
    </Pressable>
  );
});
