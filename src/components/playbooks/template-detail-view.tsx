/**
 * Template Detail View
 *
 * Displays detailed information about a community template
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';

import type { CommunityTemplate } from '@/api/templates';
import { Button, Text, View } from '@/components/ui';

interface TemplateDetailViewProps {
  template: CommunityTemplate;
  onAdopt: (template: CommunityTemplate) => void;
  onRate?: (template: CommunityTemplate) => void;
}

function TemplateHeader({ template }: { template: CommunityTemplate }) {
  // Displays the template title, setup type badge, and author information
  const { t } = useTranslation();
  return (
    <View className="mb-4">
      <Text className="mb-2 text-2xl font-bold text-text-primary">
        {template.name}
      </Text>
      <View className="flex-row items-center gap-2">
        <View className="rounded-full bg-primary-100 px-3 py-1 dark:bg-primary-900">
          <Text className="text-sm font-medium text-primary-700 dark:text-primary-300">
            {template.setup.replace(/_/g, ' ').toUpperCase()}
          </Text>
        </View>
        <Text className="text-sm text-text-secondary">
          {t('playbooks.templates.detail.authorPrefix')} {template.authorHandle}
        </Text>
      </View>
    </View>
  );
}

function TemplateStats({ template }: { template: CommunityTemplate }) {
  // Shows key statistics: duration in weeks, total tasks, and adoption count
  const { t } = useTranslation();
  return (
    <View className="mb-4 flex-row gap-3">
      <View className="flex-1 rounded-lg bg-card p-3">
        <Text className="text-xs text-text-secondary">
          {t('playbooks.templates.detail.duration')}
        </Text>
        <Text className="text-lg font-semibold text-text-primary">
          {template.totalWeeks || 0} weeks
        </Text>
      </View>
      <View className="flex-1 rounded-lg bg-card p-3">
        <Text className="text-xs text-text-secondary">
          {t('playbooks.templates.detail.tasks')}
        </Text>
        <Text className="text-lg font-semibold text-text-primary">
          {template.taskCount}
        </Text>
      </View>
      <View className="flex-1 rounded-lg bg-card p-3">
        <Text className="text-xs text-text-secondary">
          {t('playbooks.templates.detail.adopted')}
        </Text>
        <Text className="text-lg font-semibold text-text-primary">
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
  // Displays community rating with star emoji and rating count, includes rate button if onRate provided
  const { t } = useTranslation();
  if (!template.ratingAverage) return null;

  return (
    <View className="mb-4 rounded-lg bg-card p-3">
      <View className="flex-row items-center justify-between">
        <View>
          <Text className="text-xs text-text-secondary">
            {t('playbooks.templates.detail.communityRating')}
          </Text>
          <View className="flex-row items-center gap-2">
            <Text className="text-2xl font-bold text-text-primary">
              {template.ratingAverage.toFixed(1)}
            </Text>
            <Text className="text-sm text-text-secondary">
              ⭐ ({template.ratingCount}{' '}
              {t('playbooks.templates.detail.ratings')})
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
            <Text>{t('playbooks.templates.detail.rateButton')}</Text>
          </Button>
        )}
      </View>
    </View>
  );
}

function TemplateLicense({ license }: { license: string }) {
  // Shows the template's license information with educational attribution notice
  const { t } = useTranslation();
  return (
    <View className="dark:bg-primary-950 mb-4 rounded-lg bg-primary-50 p-3">
      <Text className="mb-1 text-xs font-medium text-primary-700 dark:text-primary-300">
        {t('playbooks.templates.detail.licensePrefix')} {license}
      </Text>
      <Text className="text-xs text-primary-600 dark:text-primary-400">
        {t('playbooks.templates.detail.licenseDescription')}
      </Text>
    </View>
  );
}

function TemplatePhases({ phases }: { phases: string[] }) {
  // Displays the growth phases covered by this template as capitalized badges
  const { t } = useTranslation();
  return (
    <View className="mb-4">
      <Text className="mb-2 text-lg font-semibold text-text-primary">
        {t('playbooks.templates.detail.growthPhases')}
      </Text>
      <View className="flex-row flex-wrap gap-2">
        {phases.map((phase) => (
          <View key={phase} className="rounded-full bg-card px-3 py-1">
            <Text className="text-sm capitalize text-text-secondary">
              {phase}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function TemplateStepsPreview({ template }: { template: CommunityTemplate }) {
  // Shows a preview of the first 5 tasks with day, phase, and task type information
  const { t } = useTranslation();
  return (
    <View className="mb-6">
      <Text className="mb-2 text-lg font-semibold text-text-primary">
        {t('playbooks.templates.detail.tasksPreview', {
          total: template.steps.length,
        })}
      </Text>
      <View className="rounded-lg bg-card p-3">
        {template.steps.slice(0, 5).map((step) => (
          <View
            key={step.id}
            className="mb-2 border-b border-border pb-2 last:mb-0 last:border-b-0 last:pb-0"
          >
            <Text className="text-sm font-medium text-text-primary">
              {step.title}
            </Text>
            <Text className="text-xs text-text-secondary">
              Day {step.relativeDay} • {step.phase} • {step.taskType}
            </Text>
          </View>
        ))}
        {template.steps.length > 5 && (
          <Text className="mt-2 text-xs text-text-secondary">
            {t('playbooks.templates.detail.moreTasks', {
              count: template.steps.length - 5,
            })}
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
  // Main component that renders the complete template detail view with all sections
  const { t } = useTranslation();
  return (
    <ScrollView className="flex-1 bg-background">
      <View className="p-4">
        <TemplateHeader template={template} />

        {template.description && (
          <View className="mb-4 rounded-lg bg-card p-3">
            <Text className="text-sm text-text-secondary">
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
          <Text className="font-semibold">
            {t('playbooks.templates.detail.adoptButton')}
          </Text>
        </Button>

        <Text className="mt-2 text-center text-xs text-text-secondary">
          {t('playbooks.templates.detail.adoptDescription')}
        </Text>
      </View>
    </ScrollView>
  );
}
