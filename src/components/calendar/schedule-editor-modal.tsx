import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import type { DateTime } from 'luxon';
import React from 'react';

import { ScheduleForm } from '@/components/calendar/schedule-form';
import { Modal, useModal } from '@/components/ui';
import ModalKeyboardAwareScrollView from '@/components/ui/modal-keyboard-aware-scroll-view';
import { translate } from '@/lib/i18n';
import type { TxKeyPath } from '@/lib/i18n/utils';
import type { Series } from '@/types/calendar';

type ScheduleEditorModalProps = {
  modalRef: React.RefObject<BottomSheetModal>;
  onSave?: () => void;
  editingSeries?: Series;
  selectedDate?: DateTime;
  timezone: string;
};

export function ScheduleEditorModal({
  modalRef,
  onSave,
  editingSeries,
  selectedDate,
  timezone,
}: ScheduleEditorModalProps): React.ReactElement {
  const { dismiss } = useModal();
  const isEditing = Boolean(editingSeries);

  const modalTitle = isEditing
    ? translate('calendar.schedule_editor.edit_title' as TxKeyPath)
    : translate('calendar.schedule_editor.add_title' as TxKeyPath);

  const handleSave = React.useCallback(() => {
    dismiss();
    onSave?.();
  }, [dismiss, onSave]);

  const handleCancel = React.useCallback(() => {
    dismiss();
  }, [dismiss]);

  return (
    <Modal
      ref={modalRef}
      snapPoints={['70%']}
      title={modalTitle}
      testID="schedule-editor-modal"
    >
      <ModalKeyboardAwareScrollView>
        <ScheduleForm
          editingSeries={editingSeries}
          selectedDate={selectedDate}
          timezone={timezone}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      </ModalKeyboardAwareScrollView>
    </Modal>
  );
}

export { useModal as useScheduleEditorModal };
