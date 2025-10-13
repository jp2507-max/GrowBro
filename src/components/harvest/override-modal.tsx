/**
 * Override/Skip Stage Modal
 *
 * Modal for skipping to a later stage with mandatory reason
 * Requirements: 9.2 (override with mandatory reason), 16.1 (accessibility)
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

export type OverrideModalRef = {
  present: () => void;
  dismiss: () => void;
};

export const OverrideModal = React.forwardRef<OverrideModalRef, Props>(
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

    // Get available future stages
    const stages = getAllStages();
    const currentIndex = getStageIndex(currentStage);
    const futureStages = stages.slice(currentIndex + 1);

    const handleConfirm = () => {
      if (!selectedStage) {
        setError(t('harvest.modals.override.target_stage_label'));
        return;
      }

      if (!reason.trim()) {
        setError(t('harvest.modals.override.reason_required'));
        return;
      }

      onConfirm(selectedStage, reason.trim());
      closeAfterConfirm();
    };

    const closeAfterConfirm = () => {
      setSelectedStage(null);
      setReason('');
      setError('');
      modal.dismiss();
    };

    const handleClose = () => {
      closeAfterConfirm();
      onCancel();
    };

    return (
      <Modal ref={modal.ref} title={t('harvest.modals.override.title')}>
        <View className="p-6">
          <Text className="mb-2 text-xl font-semibold text-charcoal-900">
            {t('harvest.modals.override.title')}
          </Text>
          <Text className="mb-4 text-sm text-neutral-600">
            {t('harvest.modals.override.subtitle')}
          </Text>

          {/* Stage selection */}
          <View className="mb-4">
            <Text className="mb-2 text-sm font-medium text-charcoal-800">
              {t('harvest.modals.override.target_stage_label')}
            </Text>
            {futureStages.map((stage) => (
              <Button
                key={stage}
                label={t(`harvest.stages.${stage}`)}
                variant={selectedStage === stage ? 'default' : 'outline'}
                onPress={() => setSelectedStage(stage)}
                className="mb-2"
              />
            ))}
          </View>

          {/* Reason input */}
          <Input
            label={t('harvest.modals.override.reason_label')}
            placeholder={t('harvest.modals.override.reason_placeholder')}
            value={reason}
            onChangeText={(text) => {
              setReason(text);
              setError('');
            }}
            multiline
            numberOfLines={4}
            error={error}
          />

          {/* Actions */}
          <View className="mt-6 flex-row gap-3">
            <Button
              label={t('harvest.modals.override.cancel')}
              variant="outline"
              onPress={handleClose}
              className="flex-1"
            />
            <Button
              label={t('harvest.modals.override.confirm')}
              onPress={handleConfirm}
              className="flex-1"
            />
          </View>
        </View>
      </Modal>
    );
  }
);
