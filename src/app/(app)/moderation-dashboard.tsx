import * as React from 'react';

import { Button, Text, View } from '@/components/ui';
import { translate } from '@/lib/i18n/utils';
import { appealsQueue } from '@/lib/moderation/appeals-queue';
import { moderationQueue } from '@/lib/moderation/moderation-queue';

export default function ModerationDashboard() {
  const [, force] = React.useReducer((x) => x + 1, 0);
  const queue = moderationQueue.getQueue();
  const audit = moderationQueue.getAuditTrail();

  return (
    <View className="flex-1 p-4" testID="moderation-dashboard">
      <Text className="mb-2 text-xl">
        {translate('moderation.queue.title')}
      </Text>
      {queue.length === 0 ? (
        <Text testID="queue-empty">{translate('moderation.queue.empty')}</Text>
      ) : (
        queue.map((r) => (
          <View key={r.id} className="mb-2" testID={`queue-item-${r.id}`}>
            <Text>
              {r.contentId} — {r.reason} — {r.status} — attempts: {r.attempts}
            </Text>
            <Button
              size="sm"
              label={translate('moderation.queue.escalate')}
              onPress={() => {
                moderationQueue.escalateToHuman(r.id, 'manual');
                force();
              }}
            />
            <Button
              size="sm"
              label={translate('moderation.queue.appeal')}
              onPress={async () => {
                appealsQueue.enqueue(r.contentId, 'appeal: context');
                await appealsQueue.processAll();
              }}
            />
          </View>
        ))
      )}

      <View className="mt-4">
        <Button
          label={translate('moderation.queue.processAll')}
          onPress={async () => {
            await moderationQueue.processAll();
            force();
          }}
          testID="process-all-btn"
        />
      </View>

      <Text className="mb-2 mt-6 text-xl">
        {translate('moderation.audit.title')}
      </Text>
      {audit.length === 0 ? (
        <Text testID="audit-empty">{translate('moderation.audit.empty')}</Text>
      ) : (
        audit.slice(0, 20).map((a) => (
          <Text key={a.id} testID={`audit-item-${a.id}`}>
            {a.action} @ {new Date(a.at).toLocaleString()}
          </Text>
        ))
      )}
    </View>
  );
}
