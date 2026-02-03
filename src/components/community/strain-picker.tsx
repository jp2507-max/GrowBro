import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, type TextInput, View } from 'react-native';

import type { Strain } from '@/api/strains/types';
import { StrainPickerContent } from '@/components/community/strain-picker-content';
import { useStrainPicker } from '@/components/community/use-strain-picker';
import { SheetHeader, Text } from '@/components/ui';
import { CaretDown } from '@/components/ui/icons';
import { Modal, useModal } from '@/components/ui/modal';

type StrainPickerProps = {
  value?: string;
  /** Callback with just the strain name (for backward compatibility with add-post) */
  onSelect?: (strain: string | undefined) => void;
  /** Callback with the full Strain object (for plant form use cases) */
  onSelectFull?: (
    strain: Strain | undefined,
    source?: 'api' | 'custom'
  ) => void;
  /** Enable custom strain creation when no exact match is found */
  enableCustomStrain?: boolean;
  label?: string;
  placeholder?: string;
  testID?: string;
};

type StrainPickerTriggerProps = {
  value?: string;
  label?: string;
  placeholder?: string;
  onPress: () => void;
  testID: string;
};

function StrainPickerTrigger({
  value,
  label,
  placeholder,
  onPress,
  testID,
}: StrainPickerTriggerProps): React.ReactElement {
  const { t } = useTranslation();
  const displayValue = value || placeholder || t('feed.add_post.select_strain');

  return (
    <View className="mb-4">
      {label && (
        <Text
          testID={`${testID}-label`}
          className="mb-2 ml-1 text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400"
        >
          {label}
        </Text>
      )}
      <Pressable
        className="flex-row items-center justify-between rounded-2xl border-2 border-neutral-200 bg-white px-5 py-4 dark:border-white/10 dark:bg-white/10"
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label || t('feed.add_post.select_strain')}
        accessibilityHint={t('feed.add_post.strain_hint')}
        testID={`${testID}-trigger`}
      >
        <Text
          className={`flex-1 text-base font-medium ${
            value
              ? 'text-charcoal-900 dark:text-neutral-100'
              : 'text-neutral-400 dark:text-neutral-500'
          }`}
        >
          {displayValue}
        </Text>
        <CaretDown
          size={18}
          className="text-primary-700 dark:text-primary-300"
        />
      </Pressable>
    </View>
  );
}

export function StrainPicker({
  value,
  onSelect,
  onSelectFull,
  enableCustomStrain = false,
  label,
  placeholder,
  testID = 'strain-picker',
}: StrainPickerProps): React.ReactElement {
  const modal = useModal();
  const searchInputRef = React.useRef<TextInput>(null);
  const {
    t,
    isOpen,
    searchQuery,
    setSearchQuery,
    strains,
    showCreateCustom,
    isFetching,
    handleOpen,
    handleSearchFocus,
    handleDismiss,
    handleSelect,
    handleClear,
    handleCreateCustom,
    handleEndReached,
  } = useStrainPicker({
    enableCustomStrain,
    onSelect,
    onSelectFull,
    modalDismiss: modal.dismiss,
    modalExpand: () => modal.ref.current?.expand(),
  });

  React.useEffect(() => {
    if (isOpen) {
      modal.present();
    }
  }, [isOpen, modal]);

  return (
    <>
      <StrainPickerTrigger
        value={value}
        label={label}
        placeholder={placeholder}
        onPress={handleOpen}
        testID={testID}
      />
      <Modal
        ref={modal.ref}
        snapPoints={['70%', '100%']}
        enablePanDownToClose
        onDismiss={handleDismiss}
        useGlassSurface
        keyboardBehavior="extend"
        keyboardBlurBehavior="none"
        android_keyboardInputMode="adjustResize"
      >
        <View className="flex-1">
          <SheetHeader
            title={label || t('feed.add_post.select_strain')}
            onCancel={handleDismiss}
          />

          <StrainPickerContent
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            strains={strains}
            value={value}
            isFetching={isFetching}
            showCreateCustom={showCreateCustom}
            onSelect={(strain) => handleSelect(strain, 'api')}
            onClear={handleClear}
            onEndReached={handleEndReached}
            onCreateCustom={enableCustomStrain ? handleCreateCustom : undefined}
            showTitle={false}
            inputComponent={BottomSheetTextInput}
            useBottomSheetList
            onSearchFocus={handleSearchFocus}
            inputRef={searchInputRef}
            testID={testID}
          />
        </View>
      </Modal>
    </>
  );
}
