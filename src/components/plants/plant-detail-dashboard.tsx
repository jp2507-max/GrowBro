import React from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Plant } from '@/api/plants/types';
import { Text, View } from '@/components/ui';
import colors from '@/components/ui/colors';
import { ArrowLeft, Settings } from '@/components/ui/icons';

import { type ActionHubTask, PlantActionHub } from './plant-action-hub';
import { PlantDetailHeader } from './plant-detail-header';
import { PlantStatsGrid } from './plant-stats-grid';

type PlantDetailDashboardProps = {
  plant: Plant;
  nextFeedHours: number | null;
  tasks: ActionHubTask[];
  onBack: () => void;
  onTaskPress: (taskId: string) => void;
  onHarvestPress: () => void;
  onAdvancedSettings: () => void;
  onEditPhoto?: () => void;
  onCheckInPress?: () => void;
};

export function PlantDetailDashboard({
  plant,
  nextFeedHours,
  tasks,
  onBack,
  onTaskPress,
  onHarvestPress,
  onAdvancedSettings,
  onEditPhoto,
  onCheckInPress,
}: PlantDetailDashboardProps): React.ReactElement {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  // Header height: top inset + 8px padding + 48px button + 12px pb-3
  const headerHeight = insets.top + 68;

  return (
    <View className="flex-1 bg-charcoal-950">
      {/* Sticky Header Bar */}
      <View
        className="absolute inset-x-0 top-0 z-50 flex-row items-center justify-between border-b border-white/5 bg-charcoal-950 px-4 pb-3"
        style={{ paddingTop: insets.top + 8 }}
      >
        {/* Back Button */}
        <Pressable
          onPress={onBack}
          className="size-12 items-center justify-center rounded-full active:bg-white/10"
          accessibilityRole="button"
          accessibilityLabel={t('accessibility.common.go_back')}
          accessibilityHint={t('accessibility.common.back_hint')}
          testID="plant-detail-back-button"
        >
          <ArrowLeft color={colors.white} width={24} height={24} />
        </Pressable>

        {/* Plant Name */}
        <Text className="text-lg font-bold text-white">{plant.name}</Text>

        {/* Settings Button - navigates to plant settings modal */}
        <Pressable
          onPress={onAdvancedSettings}
          className="size-12 items-center justify-center rounded-full active:bg-white/10"
          accessibilityRole="button"
          accessibilityLabel={t('plants.detail.advanced_settings_title')}
          accessibilityHint={t('accessibility.common.opens_screen_hint', {
            label: t('plants.detail.advanced_settings_title'),
          })}
          testID="plant-settings-button"
        >
          <Settings color={colors.white} width={24} height={24} />
        </Pressable>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingTop: headerHeight,
          paddingBottom: insets.bottom + 24,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Image - starts below the header */}
        <PlantDetailHeader plant={plant} onEditPhoto={onEditPhoto} />

        {/* Content Area */}
        <View className="gap-6 py-6">
          {/* Status Row - glassmorphic cards */}
          <PlantStatsGrid plant={plant} nextFeedHours={nextFeedHours} />

          {/* Daily Action Center */}
          <PlantActionHub
            plantId={plant.id}
            plantStage={plant.stage}
            tasks={tasks}
            onTaskPress={onTaskPress}
            onHarvestPress={onHarvestPress}
            onCheckInPress={onCheckInPress}
          />
        </View>
      </ScrollView>
    </View>
  );
}
