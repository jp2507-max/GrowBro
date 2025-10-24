import React from 'react';
import { useTranslation } from 'react-i18next';

import { Button, Input, Text, View } from '@/components/ui';

type EvidenceSectionProps = {
  evidenceUrls: string[];
  newEvidenceUrl: string;
  onNewEvidenceUrlChange: (value: string) => void;
  onAddEvidence: () => void;
  onRemoveEvidence: (index: number) => void;
};

export function EvidenceSection({
  evidenceUrls,
  newEvidenceUrl,
  onNewEvidenceUrlChange,
  onAddEvidence,
  onRemoveEvidence,
}: EvidenceSectionProps) {
  const { t } = useTranslation();

  return (
    <View className="mb-6">
      <Text className="mb-2 text-sm font-medium text-charcoal-950 dark:text-neutral-100">
        {t('appeals.label.evidence')}
      </Text>
      <Text className="mb-2 text-xs text-neutral-600 dark:text-neutral-400">
        {t('appeals.hint.evidence')}
      </Text>

      {/* Evidence URL Input */}
      <View className="mb-2 flex-row gap-2">
        <Input
          value={newEvidenceUrl}
          onChangeText={onNewEvidenceUrlChange}
          placeholder="https://example.com/evidence.jpg"
          className="flex-1"
          keyboardType="url"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Button
          variant="outline"
          onPress={onAddEvidence}
          disabled={!newEvidenceUrl.trim() || evidenceUrls.length >= 5}
          size="sm"
        >
          <Text>{t('common.add')}</Text>
        </Button>
      </View>

      {/* Evidence URL List */}
      {evidenceUrls.length > 0 && (
        <View className="gap-2">
          {evidenceUrls.map((url, index) => (
            <View
              key={index}
              className="flex-row items-center justify-between rounded-lg bg-neutral-100 p-2 dark:bg-charcoal-900"
            >
              <Text
                className="flex-1 text-sm text-charcoal-950 dark:text-neutral-100"
                numberOfLines={1}
              >
                {url}
              </Text>
              <Button
                variant="ghost"
                onPress={() => onRemoveEvidence(index)}
                size="sm"
              >
                <Text className="text-danger-600">✕</Text>
              </Button>
            </View>
          ))}
        </View>
      )}

      <Text className="mt-2 text-xs text-neutral-500 dark:text-neutral-500">
        {t('appeals.notice.evidenceOptional')} ({evidenceUrls.length}/5)
      </Text>
    </View>
  );
}
