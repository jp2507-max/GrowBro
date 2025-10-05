/**
 * Trichome Helper Screen
 *
 * Complete interface for trichome assessment with educational content,
 * disclaimers, and macro photography tips
 *
 * Requirements: 5.1, 5.2, 5.3, UI/UX implementation
 */

/* eslint-disable max-lines-per-function */
import React, { useState } from 'react';
import { ScrollView } from 'react-native';

import { TrichomeAssessmentForm } from '@/components/trichome/trichome-assessment-form';
import { TrichomeGuideCard } from '@/components/trichome/trichome-guide-card';
import { Button, Text, View } from '@/components/ui';
import type { TrichomeGuide } from '@/lib/trichome';

type TrichomeHelperScreenProps = {
  guide: TrichomeGuide;
  onSubmitAssessment: (data: {
    clearPercent?: number;
    milkyPercent?: number;
    amberPercent?: number;
    notes?: string;
  }) => Promise<void>;
  onClose?: () => void;
  loading?: boolean;
};

export function TrichomeHelperScreen({
  guide,
  onSubmitAssessment,
  onClose,
  loading = false,
}: TrichomeHelperScreenProps) {
  const [showGuide, setShowGuide] = useState(true);

  return (
    <View className="flex-1 bg-neutral-50 dark:bg-charcoal-950">
      {/* Header */}
      <View className="border-b border-neutral-200 bg-white p-4 dark:border-charcoal-800 dark:bg-charcoal-900">
        <View className="flex-row items-center justify-between">
          <View className="flex-1">
            <Text className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
              Trichome Helper
            </Text>
            <Text className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
              Assess trichome development for harvest timing
            </Text>
          </View>
          {onClose && (
            <Button
              variant="ghost"
              size="sm"
              onPress={onClose}
              label="✕"
              className="ml-2"
              testID="close-trichome-helper"
            />
          )}
        </View>

        {/* Toggle Tabs */}
        <View className="mt-4 flex-row gap-2">
          <Button
            variant={showGuide ? 'default' : 'outline'}
            size="sm"
            onPress={() => setShowGuide(true)}
            label="Guide"
            className="flex-1"
            testID="show-guide-tab"
          />
          <Button
            variant={!showGuide ? 'default' : 'outline'}
            size="sm"
            onPress={() => setShowGuide(false)}
            label="Log Assessment"
            className="flex-1"
            testID="show-assessment-tab"
          />
        </View>
      </View>

      <ScrollView className="flex-1 p-4">
        {showGuide ? (
          <>
            {/* Educational Guide */}
            <TrichomeGuideCard guide={guide} className="mb-4" />

            {/* Macro Photography Tips Section */}
            <View className="mb-4 rounded-lg border border-primary-200 bg-primary-50 p-4 dark:border-primary-800 dark:bg-primary-900/20">
              <Text className="mb-2 text-base font-semibold text-primary-800 dark:text-primary-200">
                📸 Macro Photography Tips
              </Text>
              <View className="gap-2">
                {guide.photographyTips.map((tip, index) => (
                  <View key={index} className="flex-row">
                    <Text className="mr-2 text-sm text-primary-700 dark:text-primary-300">
                      •
                    </Text>
                    <Text className="flex-1 text-sm text-primary-700 dark:text-primary-300">
                      {tip}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Lighting Cautions */}
            <View className="mb-4 rounded-lg border border-warning-200 bg-warning-50 p-4 dark:border-warning-800 dark:bg-warning-900/20">
              <Text className="mb-2 text-base font-semibold text-warning-800 dark:text-warning-200">
                ⚠️ Lighting Cautions
              </Text>
              <View className="gap-2">
                {guide.lightingCautions.map((caution, index) => (
                  <View key={index} className="flex-row">
                    <Text className="mr-2 text-sm text-warning-700 dark:text-warning-300">
                      •
                    </Text>
                    <Text className="flex-1 text-sm text-warning-700 dark:text-warning-300">
                      {caution}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Educational Disclaimer */}
            <View className="rounded-lg border border-neutral-200 bg-neutral-100 p-4 dark:border-charcoal-800 dark:bg-charcoal-800">
              <Text className="text-xs italic text-neutral-600 dark:text-neutral-400">
                ℹ️ {guide.disclaimer}
              </Text>
            </View>
          </>
        ) : (
          <>
            {/* Assessment Form */}
            <TrichomeAssessmentForm
              onSubmit={onSubmitAssessment}
              loading={loading}
              className="mb-4"
            />

            {/* Quick Reference */}
            <View className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-charcoal-800 dark:bg-charcoal-900">
              <Text className="mb-3 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                Quick Reference
              </Text>
              {guide.stages.map((stage, index) => (
                <View
                  key={stage.stage}
                  className={`${index > 0 ? 'mt-2' : ''} rounded-lg bg-neutral-50 p-2 dark:bg-charcoal-800`}
                >
                  <Text className="text-xs font-medium text-neutral-900 dark:text-neutral-100">
                    {stage.title}
                  </Text>
                  <Text className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
                    {stage.effectProfile}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}
