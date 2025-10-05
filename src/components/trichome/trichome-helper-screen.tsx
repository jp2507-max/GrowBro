/**
 * Trichome Helper Screen
 *
 * Complete interface for trichome assessment with educational content,
 * disclaimers, and macro photography tips
 *
 * Requirements: 5.1, 5.2, 5.3, UI/UX implementation
 */

import React, { useState } from 'react';
import { ScrollView } from 'react-native';

import { TrichomeAssessmentForm } from '@/components/trichome/trichome-assessment-form';
import { TrichomeGuideContent } from '@/components/trichome/trichome-guide-content';
import { TrichomeHelperHeader } from '@/components/trichome/trichome-helper-header';
import { TrichomeHelperTabs } from '@/components/trichome/trichome-helper-tabs';
import { TrichomeQuickReference } from '@/components/trichome/trichome-quick-reference';
import { View } from '@/components/ui';
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
}: TrichomeHelperScreenProps): JSX.Element {
  const [showGuide, setShowGuide] = useState(true);

  return (
    <View className="flex-1 bg-neutral-50 dark:bg-charcoal-950">
      {/* Header */}
      <TrichomeHelperHeader onClose={onClose} />

      {/* Toggle Tabs */}
      <View className="px-4">
        <TrichomeHelperTabs
          showGuide={showGuide}
          onToggleGuide={setShowGuide}
        />
      </View>

      <ScrollView className="flex-1 p-4">
        {showGuide ? (
          <TrichomeGuideContent guide={guide} />
        ) : (
          <>
            {/* Assessment Form */}
            <TrichomeAssessmentForm
              onSubmit={onSubmitAssessment}
              loading={loading}
              className="mb-4"
            />

            {/* Quick Reference */}
            <TrichomeQuickReference guide={guide} />
          </>
        )}
      </ScrollView>
    </View>
  );
}
