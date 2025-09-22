import * as React from 'react';

import { Button, Text, View } from '@/components/ui';
import { appealsQueue } from '@/lib/moderation/appeals-queue';
import { moderationQueue } from '@/lib/moderation/moderation-queue';

export default function ModerationDashboard() {
  const [, force] = React.useReducer((x) => x + 1, 0);
  const queue = moderationQueue.getQueue();
  const audit = moderationQueue.getAuditTrail();

  return (
    <View className="flex-1 p-4" testID="moderation-dashboard">
      <Text className="mb-2 text-xl">Moderation Queue</Text>
      {queue.length === 0 ? (
        <Text testID="queue-empty">Empty</Text>
      ) : (
        queue.map((r) => (
          <View key={r.id} className="mb-2" testID={`queue-item-${r.id}`}>
            <Text>
              {r.contentId} — {r.reason} — {r.status} — attempts: {r.attempts}
            </Text>
            <Button
              size="sm"
              label="Escalate"
              onPress={() => {
                moderationQueue.escalateToHuman(r.id, 'manual');
                force();
              }}
            />
            <Button
              size="sm"
              label="Appeal"
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
          label="Process All"
          onPress={async () => {
            await moderationQueue.processAll();
            force();
          }}
          testID="process-all-btn"
        />
      </View>

      <Text className="mb-2 mt-6 text-xl">Audit Trail</Text>
      {audit.length === 0 ? (
        <Text testID="audit-empty">Empty</Text>
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
