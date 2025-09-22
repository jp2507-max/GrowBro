import React from 'react';

import { Button, View } from '@/components/ui';
import { translate } from '@/lib';
import modManager from '@/lib/moderation/moderation-manager';

type Props = {
  contentId: string | number;
  authorId: string | number;
  onDeleteSuccess?: () => void;
};

export function ModerationActions({
  contentId,
  authorId,
  onDeleteSuccess,
}: Props) {
  return (
    <View className="flex-row flex-wrap gap-2" testID="moderation-actions">
      <Button
        size="sm"
        label={translate('moderation.report')}
        onPress={() => modManager.reportContent(contentId, 'other')}
        testID="moderation-report-btn"
      />
      <Button
        size="sm"
        label={translate('moderation.block')}
        onPress={() => modManager.blockUser(authorId)}
        testID="moderation-block-btn"
      />
      <Button
        size="sm"
        label={translate('moderation.mute')}
        onPress={() => modManager.muteUser(authorId)}
        testID="moderation-mute-btn"
      />
      <Button
        size="sm"
        variant="destructive"
        label={translate('moderation.delete')}
        onPress={async () => {
          const res = await modManager.deleteOwnContent(contentId);
          if (res.status === 'ok') onDeleteSuccess?.();
        }}
        testID="moderation-delete-btn"
      />
    </View>
  );
}

export default ModerationActions;
