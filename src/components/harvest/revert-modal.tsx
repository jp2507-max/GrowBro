/**
 * Revert Stage Modal
 *
 * Modal for reverting to a previous stage with mandatory reason
 * Requirements: 9.6 (revert with audit note), 16.1 (accessibility)
 */

import React, { useImperativeHandle, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button, Input, Modal, Text, useModal } from '@/components/ui';
import { getAllStages, getStageIndex } from '@/lib/harvest/stage-config';
import { type HarvestStage } from '@/types/harvest';

type Props = {
  currentStage: HarvestStage;
  onConfirm: (toStage: HarvestStage, reason: string) => void;
  onCancel: () => void;
};

export type RevertModalRef = {
  present: () => void;
  dismiss: () => void;
};

export const RevertModal = React.forwardRef<RevertModalRef, Props>(
  ({ currentStage, onConfirm, onCancel }, ref) => {
    const { t } = useTranslation();
    const modal = useModal();
    const [selectedStage, setSelectedStage] = useState<HarvestStage | null>(
      null
    );
    const [reason, setReason] = useState('');
    const [error, setError] = useState('');

    useImperativeHandle(ref, () => ({
      present: modal.present,
      dismiss: modal.dismiss,
    }));

    // Get available previous stages
    const stages = getAllStages();
    const currentIndex = getStageIndex(currentStage);
    const previousStages = stages.slice(0, currentIndex);

    const handleConfirm = () => {
      if (!selectedStage) {
        setError(t('harvest.modals.revert.target_stage_label'));
        return;
      }
      if (!reason.trim()) {
        setError(t('harvest.modals.revert.reason_required'));
        return;
      }
      onConfirm(selectedStage, reason.trim());
      setSelectedStage(null);
      setReason('');
      setError('');
      modal.dismiss();
    };

    const handleCancel = () => {
      setSelectedStage(null);
      setReason('');
      setError('');
      modal.dismiss();
      onCancel();
    };

    return (
      <Modal ref={modal.ref} title={t('harvest.modals.revert.title')}>
        <View className="p-6">
          <Text className="mb-4 text-sm text-neutral-600">
            {t('harvest.modals.revert.subtitle')}
          </Text>

          <View className="mb-4">
            <Text className="mb-2 text-sm font-medium text-charcoal-800">
              {t('harvest.modals.revert.target_stage_label')}
            </Text>
            {previousStages.map((stage) => (
              <Button
                key={stage}
                label={t(`harvest.stages.${stage}`)}
                variant={selectedStage === stage ? 'default' : 'outline'}
                onPress={() => setSelectedStage(stage)}
                className="mb-2"
              />
            ))}
          </View>

          <Input
            label={t('harvest.modals.revert.reason_label')}
            placeholder={t('harvest.modals.revert.reason_placeholder')}
            value={reason}
            onChangeText={(text) => {
              setReason(text);
              setError('');
            }}
            multiline
            numberOfLines={4}
            error={error}
          />

          <View className="mt-6 flex-row gap-3">
            <Button
              label={t('harvest.modals.revert.cancel')}
              variant="outline"
              onPress={handleCancel}
              className="flex-1"
            />
            <Button
              label={t('harvest.modals.revert.confirm')}
              onPress={handleConfirm}
              className="flex-1"
            />
          </View>
        </View>
      </Modal>
    );
  }
);
