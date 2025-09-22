import React from 'react';

import { Button, View } from '@/components/ui';
import { showErrorMessage } from '@/components/ui/utils';
import { translate } from '@/lib';
import { AuthenticationError, getAuthenticatedUserId } from '@/lib/auth';
import modManager from '@/lib/moderation/moderation-manager';
import { captureCategorizedErrorSync } from '@/lib/sentry-utils';

type Props = {
  contentId: string | number;
  authorId: string | number;
  onDeleteSuccess?: () => void;
};

const handleError = (error: unknown, fallbackMessage: string) => {
  if (error instanceof AuthenticationError) {
    showErrorMessage(translate('moderation.authentication_required'));
  } else {
    captureCategorizedErrorSync(error);
    showErrorMessage(fallbackMessage);
  }
};

const ModerationButton = ({
  label,
  testId,
  onPress,
  variant = 'default',
}: {
  label: string;
  testId: string;
  onPress: () => Promise<void>;
  variant?: 'default' | 'destructive';
}) => (
  <Button
    size="sm"
    label={label}
    variant={variant}
    onPress={onPress}
    testID={testId}
  />
);

export function ModerationActions({
  contentId,
  authorId,
  onDeleteSuccess,
}: Props) {
  const reportContent = async () => {
    try {
      const userId = await getAuthenticatedUserId();
      await modManager.reportContent(contentId, 'other', userId);
    } catch (error) {
      handleError(error, translate('moderation.report_failed'));
    }
  };

  const blockUser = async () => {
    try {
      const userId = await getAuthenticatedUserId();
      await modManager.blockUser(authorId, userId);
    } catch (error) {
      handleError(error, translate('moderation.block_failed'));
    }
  };

  const muteUser = async () => {
    try {
      const userId = await getAuthenticatedUserId();
      await modManager.muteUser(authorId, userId);
    } catch (error) {
      handleError(error, translate('moderation.mute_failed'));
    }
  };

  const deleteContent = async () => {
    try {
      const userId = await getAuthenticatedUserId();
      const res = await modManager.deleteOwnContent(contentId, userId);
      if (res.status === 'ok') onDeleteSuccess?.();
    } catch (error) {
      handleError(error, translate('moderation.delete_failed'));
    }
  };

  return (
    <View className="flex-row flex-wrap gap-2" testID="moderation-actions">
      <ModerationButton
        label={translate('moderation.report')}
        testId="moderation-report-btn"
        onPress={reportContent}
      />
      <ModerationButton
        label={translate('moderation.block')}
        testId="moderation-block-btn"
        onPress={blockUser}
      />
      <ModerationButton
        label={translate('moderation.mute')}
        testId="moderation-mute-btn"
        onPress={muteUser}
      />
      <ModerationButton
        label={translate('moderation.delete')}
        testId="moderation-delete-btn"
        variant="destructive"
        onPress={deleteContent}
      />
    </View>
  );
}

export default ModerationActions;
