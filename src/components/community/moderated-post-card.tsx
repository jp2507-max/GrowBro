/**
 * Moderated Post Card Component
 *
 * Enhanced PostCard with integrated moderation features:
 * - Report button for all users
 * - Age-gating enforcement
 * - Geo-restriction handling
 * - Moderation status indicators
 *
 * Requirements: 1.1, 8.7, 9.4
 */

import React, { useRef } from 'react';

import type { Post as ApiPost } from '@/api/posts';
import { Pressable, Text, View } from '@/components/ui';
import { translate } from '@/lib/i18n';
import { communityIntegration } from '@/lib/moderation/community-integration';

import { AgeGatedPostCard } from './age-gated-post-card';
import type { ReportContentModalRef } from './report-content-modal';
import { ReportContentModal } from './report-content-modal';

interface ModeratedPostCardProps {
  post: ApiPost;
  isAgeVerified: boolean;
  onDelete?: (postId: number | string, undoExpiresAt: string) => void;
  onVerifyPress?: () => void;
  testID?: string;
}

export function ModeratedPostCard({
  post,
  isAgeVerified,
  onDelete,
  onVerifyPress,
  testID = 'moderated-post-card',
}: ModeratedPostCardProps): React.ReactElement {
  const reportModalRef = useRef<ReportContentModalRef>(null);
  const [canReport, setCanReport] = React.useState(true);

  // Check if user can report content
  React.useEffect(() => {
    const checkReportPermission = async () => {
      try {
        const userId = await import('@/lib/auth/user-utils').then((m) =>
          m.getOptionalAuthenticatedUserId()
        );
        if (userId) {
          const result =
            await communityIntegration.canUserReportContent(userId);
          setCanReport(result.allowed);
        }
      } catch (error) {
        console.error('Error checking report permission:', error);
      }
    };

    checkReportPermission();
  }, []);

  const handleReportPress = React.useCallback(() => {
    reportModalRef.current?.present();
  }, []);

  const handleReportSuccess = React.useCallback(() => {
    // Show success feedback
    console.log('Report submitted successfully');
  }, []);

  // Get content locator for reporting
  const contentLocator = communityIntegration.getContentLocator(
    String(post.id),
    'post'
  );

  return (
    <View testID={testID}>
      {/* Age-gated post card */}
      <AgeGatedPostCard
        post={post}
        isAgeVerified={isAgeVerified}
        onDelete={onDelete}
        onVerifyPress={onVerifyPress}
        testID={`${testID}-post`}
      />

      {/* Report button */}
      {canReport && (
        <View className="px-4 pb-2">
          <Pressable
            onPress={handleReportPress}
            accessibilityRole="button"
            accessibilityLabel={translate('moderation.report_content')}
            accessibilityHint={translate('moderation.report_content_hint')}
            className="min-h-11 flex-row items-center justify-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 py-2 dark:border-neutral-700 dark:bg-neutral-900"
            testID={`${testID}-report-button`}
          >
            <Text className="text-sm text-neutral-700 dark:text-neutral-300">
              🚩
            </Text>
            <Text className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
              {translate('moderation.report_content')}
            </Text>
          </Pressable>
        </View>
      )}

      {/* Report modal */}
      <ReportContentModal
        ref={reportModalRef}
        contentId={String(post.id)}
        contentLocator={contentLocator}
        onSuccess={handleReportSuccess}
      />
    </View>
  );
}
