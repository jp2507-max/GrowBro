/**
 * Moderated Comment Item Component
 *
 * Enhanced CommentItem with integrated moderation features:
 * - Report button for all users
 * - Moderation status indicators
 * - Appeal options for removed comments
 *
 * Requirements: 1.1
 */

import React, { useRef } from 'react';

import { Pressable, Text, View } from '@/components/ui';
import { translate } from '@/lib/i18n';
import { communityIntegration } from '@/lib/moderation/community-integration';
import type { PostComment } from '@/types/community';

import { CommentItem } from './comment-item';
import type { ReportContentModalRef } from './report-content-modal';
import { ReportContentModal } from './report-content-modal';

interface ModeratedCommentItemProps {
  comment: PostComment;
  status?: 'pending' | 'failed' | 'processed';
  isHighlighted?: boolean;
  onRetry?: () => void;
  onCancel?: () => void;
  testID?: string;
}

export function ModeratedCommentItem({
  comment,
  status = 'processed',
  isHighlighted,
  onRetry,
  onCancel,
  testID = 'moderated-comment-item',
}: ModeratedCommentItemProps): React.ReactElement {
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
    console.log('Comment report submitted successfully');
  }, []);

  // Get content locator for reporting
  const contentLocator = communityIntegration.getContentLocator(
    String(comment.id),
    'comment'
  );

  return (
    <View testID={testID}>
      {/* Comment item */}
      <CommentItem
        comment={comment}
        status={status}
        isHighlighted={isHighlighted}
        onRetry={onRetry}
        onCancel={onCancel}
        testID={`${testID}-comment`}
      />

      {/* Report button (only for processed comments) */}
      {canReport && status === 'processed' && (
        <View className="ml-3 mt-1 border-l-2 border-transparent pl-3">
          <Pressable
            onPress={handleReportPress}
            accessibilityRole="button"
            accessibilityLabel={translate('moderation.report_comment')}
            accessibilityHint={translate('moderation.report_comment_hint')}
            className="min-h-11 flex-row items-center gap-1.5"
            testID={`${testID}-report-button`}
          >
            <Text className="text-xs text-neutral-500 dark:text-neutral-400">
              🚩
            </Text>
            <Text className="text-xs text-neutral-500 dark:text-neutral-400">
              {translate('moderation.report')}
            </Text>
          </Pressable>
        </View>
      )}

      {/* Report modal */}
      <ReportContentModal
        ref={reportModalRef}
        contentId={String(comment.id)}
        contentLocator={contentLocator}
        onSuccess={handleReportSuccess}
      />
    </View>
  );
}
