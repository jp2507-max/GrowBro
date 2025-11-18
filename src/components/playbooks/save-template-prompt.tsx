/**
 * Save Template Prompt
 *
 * Prompts user to save customized playbook as template when threshold is met
 */

import type { TFunction } from 'i18next';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, Input, Text, View } from '../ui';

interface SaveTemplatePromptProps {
  customizationPercentage: number;
  totalTasks: number;
  customizedTasks: number;
  onSave: (options: {
    name: string;
    tags: string[];
    isCommunity: boolean;
  }) => Promise<void>;
  onDismiss: () => void;
  visible: boolean;
}

function StatsDisplay({
  percentage,
  customized,
  total,
  t,
}: {
  percentage: number;
  customized: number;
  total: number;
  t: TFunction;
}) {
  return (
    <View className="mb-6 rounded-lg bg-primary-50 p-4 dark:bg-primary-900/20">
      <View className="flex-row items-center justify-between">
        <Text className="text-sm font-medium text-charcoal-700 dark:text-neutral-300">
          {t('playbooks.customizationLevel')}
        </Text>
        <Text className="text-lg font-bold text-primary-600 dark:text-primary-400">
          {Math.round(percentage)}%
        </Text>
      </View>
      <View className="mt-2 flex-row items-center justify-between">
        <Text className="text-xs text-neutral-600 dark:text-neutral-400">
          {t('playbooks.customizedTasks')}
        </Text>
        <Text className="text-sm font-medium text-charcoal-700 dark:text-neutral-300">
          {customized} / {total}
        </Text>
      </View>
    </View>
  );
}

function CommunityToggle({
  isCommunity,
  onToggle,
  t,
}: {
  isCommunity: boolean;
  onToggle: () => void;
  t: TFunction;
}) {
  return (
    <View className="mb-6 flex-row items-center justify-between rounded-lg bg-neutral-50 p-4 dark:bg-charcoal-800">
      <View className="flex-1">
        <Text className="text-sm font-medium text-charcoal-900 dark:text-neutral-100">
          {t('playbooks.shareWithCommunity')}
        </Text>
        <Text className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
          {t('playbooks.shareWithCommunityHint')}
        </Text>
      </View>
      <Button
        variant={isCommunity ? 'default' : 'outline'}
        size="sm"
        onPress={onToggle}
        testID="community-toggle"
      >
        {isCommunity ? t('common.yes') : t('common.no')}
      </Button>
    </View>
  );
}

// eslint-disable-next-line max-lines-per-function
export function SaveTemplatePrompt({
  customizationPercentage,
  totalTasks,
  customizedTasks,
  onSave,
  onDismiss,
  visible,
}: SaveTemplatePromptProps) {
  const { t } = useTranslation();

  const [name, setName] = useState('');
  const [tags, setTags] = useState('');
  const [isCommunity, setIsCommunity] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;

    setIsSaving(true);
    try {
      await onSave({
        name: name.trim(),
        tags: tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        isCommunity,
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!visible) return null;

  return (
    <View
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/50"
      testID="save-template-prompt"
    >
      <View className="mx-4 w-full max-w-lg rounded-2xl bg-white p-6 dark:bg-charcoal-900">
        <View className="mb-4">
          <Text className="text-xl font-semibold text-charcoal-900 dark:text-neutral-100">
            {t('playbooks.saveAsTemplate')}
          </Text>
          <Text className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
            {t('playbooks.saveAsTemplateDescription', {
              percentage: Math.round(customizationPercentage),
              customized: customizedTasks,
              total: totalTasks,
            })}
          </Text>
        </View>

        <StatsDisplay
          percentage={customizationPercentage}
          customized={customizedTasks}
          total={totalTasks}
          t={t}
        />

        <View className="mb-4">
          <Text className="mb-2 text-sm font-medium text-charcoal-700 dark:text-neutral-300">
            {t('playbooks.templateName')}
          </Text>
          <Input
            value={name}
            onChangeText={setName}
            placeholder={t('playbooks.templateNamePlaceholder')}
            testID="template-name-input"
          />
        </View>

        <View className="mb-4">
          <Text className="mb-2 text-sm font-medium text-charcoal-700 dark:text-neutral-300">
            {t('playbooks.tags')}
          </Text>
          <Input
            value={tags}
            onChangeText={setTags}
            placeholder={t('playbooks.tagsPlaceholder')}
            testID="template-tags-input"
          />
          <Text className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            {t('playbooks.tagsHint')}
          </Text>
        </View>

        <CommunityToggle
          isCommunity={isCommunity}
          onToggle={() => setIsCommunity(!isCommunity)}
          t={t}
        />

        <View className="flex-row gap-3">
          <Button
            variant="outline"
            onPress={onDismiss}
            disabled={isSaving}
            className="flex-1"
            testID="dismiss-button"
          >
            {t('common.notNow')}
          </Button>
          <Button
            onPress={handleSave}
            disabled={isSaving || !name.trim()}
            loading={isSaving}
            className="flex-1"
            testID="save-template-button"
          >
            {t('common.save')}
          </Button>
        </View>
      </View>
    </View>
  );
}
