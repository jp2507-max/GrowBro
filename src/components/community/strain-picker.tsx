import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, type TextInput, View } from 'react-native';

import type { Strain } from '@/api/strains/types';
import { useStrainsInfiniteWithCache } from '@/api/strains/use-strains-infinite-with-cache';
import { StrainPickerContent } from '@/components/community/strain-picker-content';
import { Text } from '@/components/ui';
import { CaretDown } from '@/components/ui/icons';
import { Modal, useModal } from '@/components/ui/modal';
import { haptics } from '@/lib/haptics';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';
import {
  buildCustomStrain,
  saveCustomStrainToSupabase,
} from '@/lib/strains/custom-strain-cache';

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
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const searchInputRef = React.useRef<TextInput>(null);
  const debouncedSearchQuery = useDebouncedValue(searchQuery.trim(), 250);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isFetching } =
    useStrainsInfiniteWithCache({
      variables: {
        searchQuery: debouncedSearchQuery || undefined,
        pageSize: 20,
      },
      enabled: isOpen,
    });

  const strains = React.useMemo(
    () => data?.pages.flatMap((page) => page.data) ?? [],
    [data]
  );

  const trimmedQuery = searchQuery.trim();
  const hasExactMatch = React.useMemo(() => {
    const lower = trimmedQuery.toLowerCase();
    return strains.some((s) => s.name.toLowerCase() === lower);
  }, [strains, trimmedQuery]);

  const showCreateCustom =
    enableCustomStrain &&
    trimmedQuery.length > 0 &&
    !hasExactMatch &&
    !isFetching;

  const handleOpen = React.useCallback((): void => {
    haptics.selection();
    setIsOpen(true);
    modal.present();
  }, [modal]);

  const handleSearchFocus = React.useCallback((): void => {
    modal.ref.current?.expand();
  }, [modal.ref]);

  const handleDismiss = React.useCallback((): void => {
    setIsOpen(false);
    setSearchQuery('');
  }, []);

  const handleSelect = React.useCallback(
    (strain: Strain, source: 'api' | 'custom'): void => {
      onSelect?.(strain.name);
      onSelectFull?.(strain, source);
      modal.dismiss();
      setSearchQuery('');
      setIsOpen(false);
    },
    [modal, onSelect, onSelectFull]
  );

  const handleClear = React.useCallback((): void => {
    onSelect?.(undefined);
    onSelectFull?.(undefined);
    modal.dismiss();
    setSearchQuery('');
    setIsOpen(false);
  }, [modal, onSelect, onSelectFull]);

  const handleCreateCustom = React.useCallback((): void => {
    const name = trimmedQuery;
    if (!name) return;
    const customStrain = buildCustomStrain(name);
    void saveCustomStrainToSupabase(customStrain);
    handleSelect(customStrain, 'custom');
  }, [trimmedQuery, handleSelect]);

  const handleEndReached = React.useCallback((): void => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

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
          <View className="mb-4 flex-row items-center justify-between px-4">
            <Pressable
              onPress={handleDismiss}
              accessibilityRole="button"
              accessibilityLabel={t('common.cancel')}
              accessibilityHint={t('accessibility.modal.close_hint')}
              hitSlop={20}
            >
              <Text className="text-base font-medium text-primary-600 dark:text-primary-400">
                {t('common.cancel')}
              </Text>
            </Pressable>

            <Text className="text-base font-semibold text-charcoal-800 dark:text-neutral-100">
              {label || t('feed.add_post.select_strain')}
            </Text>

            <View className="w-[64px]" />
          </View>

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
