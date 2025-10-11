/**
 * Quality Section Component
 *
 * Displays quality flags and confidence indicators
 */

import React from 'react';

import { View } from '@/components/ui';

import { ConfidenceIndicator } from './confidence-indicator';
import { QualityBadge } from './quality-badge';

interface QualitySectionProps {
  qualityFlags: string[];
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
          <QualityBadge
            flags={qualityFlags as any}
            testID={`${testID}-quality`}
          />
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
