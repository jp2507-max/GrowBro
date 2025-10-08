/**
 * Stage Tracker Component
 *
 * Main component combining stage progression, timing, and actions
 * Requirements: 2.1-2.3 (visual progress, timing), 9.5-9.6 (undo/revert)
 */

import React, { useRef } from 'react';
import { View } from 'react-native';

import type { Harvest, HarvestStage } from '@/types/harvest';

import type { OverrideModalRef } from './override-modal';
import { OverrideModal } from './override-modal';
import type { RevertModalRef } from './revert-modal';
import { RevertModal } from './revert-modal';
import { StageActions } from './stage-actions';
import { StageProgress } from './stage-progress';
import { StageTimer } from './stage-timer';

type Props = {
  harvest: Harvest;
  onAdvance: () => void;
  onUndo: () => void;
  onRevert: (toStage: HarvestStage, reason: string) => void;
  onOverride: (toStage: HarvestStage, reason: string) => void;
  className?: string;
};

export function StageTracker({
  harvest,
  onAdvance,
  onUndo,
  onRevert,
  onOverride,
  className,
}: Props) {
  const revertModalRef = useRef<RevertModalRef>(null);
  const overrideModalRef = useRef<OverrideModalRef>(null);

  const handleRevertPress = () => {
    revertModalRef.current?.present();
  };

  const handleOverridePress = () => {
    overrideModalRef.current?.present();
  };

  const handleRevertConfirm = (toStage: HarvestStage, reason: string) => {
    onRevert(toStage, reason);
    revertModalRef.current?.dismiss();
  };

  const handleOverrideConfirm = (toStage: HarvestStage, reason: string) => {
    onOverride(toStage, reason);
    overrideModalRef.current?.dismiss();
  };

  return (
    <View className={className}>
      {/* Visual stage progression */}
      <StageProgress currentStage={harvest.stage} className="mb-6" />

      {/* Timing display */}
      <StageTimer
        stage={harvest.stage}
        stageStartedAt={harvest.stage_started_at}
        className="mb-6"
      />

      {/* Action buttons */}
      <StageActions
        currentStage={harvest.stage}
        stageCompletedAt={harvest.stage_completed_at}
        canAdvance={true}
        onAdvance={onAdvance}
        onUndo={onUndo}
        onRevert={handleRevertPress}
        onOverride={handleOverridePress}
      />

      {/* Modals */}
      <RevertModal
        ref={revertModalRef}
        currentStage={harvest.stage}
        onConfirm={handleRevertConfirm}
        onCancel={() => {}}
      />

      <OverrideModal
        ref={overrideModalRef}
        currentStage={harvest.stage}
        onConfirm={handleOverrideConfirm}
        onCancel={() => {}}
      />
    </View>
  );
}
