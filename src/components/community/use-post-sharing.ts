/**
 * usePostSharing - Deep linking and sharing logic for posts
 */

import * as Linking from 'expo-linking';
import { useCallback } from 'react';
import { Share as NativeShare } from 'react-native';

import { haptics } from '@/lib/haptics';
import { translate, type TxKeyPath } from '@/lib/i18n';
import { showErrorToast } from '@/lib/settings/toast-utils';

type UsePostSharingReturn = {
  handleSharePress: () => Promise<void>;
};

export function usePostSharing(postId: string): UsePostSharingReturn {
  const handleSharePress = useCallback(async () => {
    haptics.selection();
    try {
      // Create a deep link to the post using expo-linking
      const url = Linking.createURL(`/feed/${postId}`);
      const message = `Check out this post on GrowBro: ${url}`;

      const result = await NativeShare.share(
        {
          message,
          url, // iOS: url parameter
          title: 'Share Post', // Android: dialog title
        },
        {
          // Android: show choose dialog
          dialogTitle: 'Share Post',
        }
      );

      if (result.action === NativeShare.sharedAction && result.activityType) {
        console.debug('Shared via', result.activityType);
      }
    } catch (error) {
      showErrorToast(
        translate('common.error' as TxKeyPath),
        error instanceof Error ? error.message : undefined
      );
    }
  }, [postId]);

  return { handleSharePress };
}
