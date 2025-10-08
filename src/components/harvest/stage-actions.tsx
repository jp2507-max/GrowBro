/**
 * Stage Action Buttons
 *
 * Action buttons for stage progression (advance, undo, revert, override)
 * Requirements: 9.5 (undo), 9.6 (revert), 16.1 (accessibility, 44pt targets)
 */

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button } from '@/components/ui';
import {
  canUndoStageChange,
  getStageMetadata,
} from '@/lib/harvest/state-machine';
import { HarvestStage } from '@/types/harvest';

type Props = {
  currentStage: HarvestStage;
  stageCompletedAt: Date | null;
  canAdvance: boolean;
  onAdvance: () => void;
  onUndo: () => void;
  onRevert: () => void;
  onOverride: () => void;
  className?: string;
};

function getNextStageKey(current: HarvestStage): string {
  const order = [
    HarvestStage.HARVEST,
    HarvestStage.DRYING,
    HarvestStage.CURING,
    HarvestStage.INVENTORY,
  ];
  const index = order.indexOf(current);
  return order[index + 1] || current;
}

function useUndoTimer(stageCompletedAt: Date | null) {
  const [canUndo, setCanUndo] = useState(false);
  const [undoSeconds, setUndoSeconds] = useState(0);

  useEffect(() => {
    if (!stageCompletedAt) {
      setCanUndo(false);
      return;
    }

    const checkUndo = () => {
      const now = new Date();
      const eligible = canUndoStageChange(stageCompletedAt, now);
      setCanUndo(eligible);

      if (eligible) {
        const elapsed = now.getTime() - stageCompletedAt.getTime();
        const remaining = Math.max(0, Math.ceil((15000 - elapsed) / 1000));
        setUndoSeconds(remaining);
      }
    };

    checkUndo();
    const interval = setInterval(checkUndo, 1000);
    return () => clearInterval(interval);
  }, [stageCompletedAt]);

  return { canUndo, undoSeconds };
}

export function StageActions({
  currentStage,
  stageCompletedAt,
  canAdvance,
  onAdvance,
  onUndo,
  onRevert,
  onOverride,
  className,
}: Props) {
  const { t } = useTranslation();
  const metadata = getStageMetadata(currentStage);
  const { canUndo, undoSeconds } = useUndoTimer(stageCompletedAt);
  const nextStage = metadata.canAdvance
    ? t(`harvest.stages.${getNextStageKey(currentStage)}`)
    : '';

  return (
    <View className={className}>
      {canAdvance && metadata.canAdvance && (
        <Button
          label={t('harvest.actions.advance', { stage: nextStage })}
          onPress={onAdvance}
          accessibilityHint={t('harvest.actions.advance_hint', {
            stage: nextStage,
          })}
          className="mb-3"
        />
      )}

      {canUndo && (
        <Button
          label={`${t('harvest.actions.undo')} (${undoSeconds}s)`}
          onPress={onUndo}
          variant="outline"
          accessibilityHint={t('harvest.actions.undo_hint')}
          className="mb-3"
        />
      )}

      {!canUndo && metadata.canRevert && (
        <Button
          label={t('harvest.actions.revert')}
          onPress={onRevert}
          variant="outline"
          accessibilityHint={t('harvest.actions.revert_hint')}
          className="mb-3"
        />
      )}

      {metadata.canAdvance && (
        <Button
          label={t('harvest.actions.override')}
          onPress={onOverride}
          variant="ghost"
          accessibilityHint={t('harvest.actions.override_hint')}
        />
      )}
    </View>
  );
}
