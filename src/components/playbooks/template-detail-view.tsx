/**
 * Template Detail View
 *
 * Displays detailed information about a community template
 */

import React from 'react';
import { ScrollView } from 'react-native';

import type { CommunityTemplate } from '@/api/templates';
import { Button, Text, View } from '@/components/ui';

interface TemplateDetailViewProps {
  template: CommunityTemplate;
  onAdopt: (template: CommunityTemplate) => void;
  onRate?: (template: CommunityTemplate) => void;
}

function TemplateHeader({ template }: { template: CommunityTemplate }) {
  return (
    <View className="mb-4">
      <Text className="mb-2 text-2xl font-bold text-neutral-900 dark:text-neutral-100">
        {template.name}
      </Text>
      <View className="flex-row items-center gap-2">
        <View className="rounded-full bg-primary-100 px-3 py-1 dark:bg-primary-900">
          <Text className="text-sm font-medium text-primary-700 dark:text-primary-300">
            {template.setup.replace(/_/g, ' ').toUpperCase()}
          </Text>
        </View>
        <Text className="text-sm text-neutral-600 dark:text-neutral-400">
          by {template.authorHandle}
        </Text>
      </View>
    </View>
  );
}

function TemplateStats({ template }: { template: CommunityTemplate }) {
  return (
    <View className="mb-4 flex-row gap-3">
      <View className="flex-1 rounded-lg bg-neutral-100 p-3 dark:bg-charcoal-900">
        <Text className="text-xs text-neutral-500 dark:text-neutral-500">
          Duration
        </Text>
        <Text className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          {template.totalWeeks || 0} weeks
        </Text>
      </View>
      <View className="flex-1 rounded-lg bg-neutral-100 p-3 dark:bg-charcoal-900">
        <Text className="text-xs text-neutral-500 dark:text-neutral-500">
          Tasks
        </Text>
        <Text className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          {template.taskCount}
        </Text>
      </View>
      <View className="flex-1 rounded-lg bg-neutral-100 p-3 dark:bg-charcoal-900">
        <Text className="text-xs text-neutral-500 dark:text-neutral-500">
          Adopted
        </Text>
        <Text className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          {template.adoptionCount}
        </Text>
      </View>
    </View>
  );
}

function TemplateRating({
  template,
  onRate,
}: {
  template: CommunityTemplate;
  onRate?: (template: CommunityTemplate) => void;
}) {
  if (!template.ratingAverage) return null;

  return (
    <View className="mb-4 rounded-lg bg-neutral-100 p-3 dark:bg-charcoal-900">
      <View className="flex-row items-center justify-between">
        <View>
          <Text className="text-xs text-neutral-500 dark:text-neutral-500">
            Community Rating
          </Text>
          <View className="flex-row items-center gap-2">
            <Text className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
              {template.ratingAverage.toFixed(1)}
            </Text>
            <Text className="text-sm text-neutral-600 dark:text-neutral-400">
              ⭐ ({template.ratingCount} ratings)
            </Text>
          </View>
        </View>
        {onRate && (
          <Button
            testID="template-rate-button"
            variant="outline"
            size="sm"
            onPress={() => onRate(template)}
          >
            <Text>Rate</Text>
          </Button>
        )}
      </View>
    </View>
  );
}

function TemplateLicense({ license }: { license: string }) {
  return (
    <View className="dark:bg-primary-950 mb-4 rounded-lg bg-primary-50 p-3">
      <Text className="mb-1 text-xs font-medium text-primary-700 dark:text-primary-300">
        License: {license}
      </Text>
      <Text className="text-xs text-primary-600 dark:text-primary-400">
        You can use and modify this playbook with attribution to the author
      </Text>
    </View>
  );
}

function TemplatePhases({ phases }: { phases: string[] }) {
  return (
    <View className="mb-4">
      <Text className="mb-2 text-lg font-semibold text-neutral-900 dark:text-neutral-100">
        Growth Phases
      </Text>
      <View className="flex-row flex-wrap gap-2">
        {phases.map((phase) => (
          <View
            key={phase}
            className="rounded-full bg-neutral-200 px-3 py-1 dark:bg-charcoal-800"
          >
            <Text className="text-sm capitalize text-neutral-700 dark:text-neutral-300">
              {phase}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function TemplateStepsPreview({ template }: { template: CommunityTemplate }) {
  return (
    <View className="mb-6">
      <Text className="mb-2 text-lg font-semibold text-neutral-900 dark:text-neutral-100">
        Tasks Preview ({template.steps.length} total)
      </Text>
      <View className="rounded-lg bg-neutral-100 p-3 dark:bg-charcoal-900">
        {template.steps.slice(0, 5).map((step) => (
          <View
            key={step.id}
            className="mb-2 border-b border-neutral-200 pb-2 last:mb-0 last:border-b-0 last:pb-0 dark:border-charcoal-800"
          >
            <Text className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
              {step.title}
            </Text>
            <Text className="text-xs text-neutral-500 dark:text-neutral-500">
              Day {step.relativeDay} • {step.phase} • {step.taskType}
            </Text>
          </View>
        ))}
        {template.steps.length > 5 && (
          <Text className="mt-2 text-xs text-neutral-500 dark:text-neutral-500">
            + {template.steps.length - 5} more tasks
          </Text>
        )}
      </View>
    </View>
  );
}

export function TemplateDetailView({
  template,
  onAdopt,
  onRate,
}: TemplateDetailViewProps) {
  return (
    <ScrollView className="flex-1 bg-neutral-50 dark:bg-charcoal-950">
      <View className="p-4">
        <TemplateHeader template={template} />

        {template.description && (
          <View className="mb-4 rounded-lg bg-neutral-100 p-3 dark:bg-charcoal-900">
            <Text className="text-sm text-neutral-700 dark:text-neutral-300">
              {template.description}
            </Text>
          </View>
        )}

        <TemplateStats template={template} />
        <TemplateRating template={template} onRate={onRate} />
        <TemplateLicense license={template.license} />
        <TemplatePhases phases={template.phaseOrder} />
        <TemplateStepsPreview template={template} />

        <Button
          testID="template-adopt-button"
          onPress={() => onAdopt(template)}
          size="lg"
        >
          <Text className="font-semibold">Adopt This Playbook</Text>
        </Button>

        <Text className="mt-2 text-center text-xs text-neutral-500 dark:text-neutral-500">
          You can customize the playbook after adopting it
        </Text>
      </View>
    </ScrollView>
  );
}
