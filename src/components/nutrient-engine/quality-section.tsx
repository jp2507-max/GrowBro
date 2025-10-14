/**
 * Quality Section Component
 *
 * Displays quality flags and confidence indicators
 */

import React from 'react';

import { View } from '@/components/ui';
import type { QualityFlag } from '@/lib/nutrient-engine/types';

import { ConfidenceIndicator } from './confidence-indicator';
import { QualityBadge } from './quality-badge';

interface QualitySectionProps {
  qualityFlags: QualityFlag[];
  confidence: number;
  testID: string;
}

export function QualitySection({
  qualityFlags,
  confidence,
  testID,
}: QualitySectionProps) {
  return (
    <>
      {qualityFlags.length > 0 && (
        <View className="mb-4">
          <QualityBadge flags={qualityFlags} testID={`${testID}-quality`} />
        </View>
      )}

      <View className="mb-4">
        <ConfidenceIndicator
          confidence={confidence}
          testID={`${testID}-confidence`}
        />
      </View>
    </>
  );
}
