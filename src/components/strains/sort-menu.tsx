import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import * as React from 'react';

import type { SortBy, SortDirection } from '@/api/strains/types';
import { Button, Modal, Text, useModal, View } from '@/components/ui';
import { translate } from '@/lib/i18n';

export interface SortOptions {
  sortBy?: SortBy;
  sortDirection?: SortDirection;
}

interface SortMenuProps {
  sortOptions: SortOptions;
  onApply: (options: SortOptions) => void;
  onClear: () => void;
}

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: 'name', label: 'strains.sort.name' },
  { value: 'thc', label: 'strains.sort.thc' },
  { value: 'cbd', label: 'strains.sort.cbd' },
  { value: 'popularity', label: 'strains.sort.popularity' },
];

interface SortMenuContentProps {
  localOptions: SortOptions;
  hasSortOptions: boolean;
  onSortBySelect: (sortBy: SortBy) => void;
  onDirectionToggle: () => void;
}

function SortMenuContent({
  localOptions,
  hasSortOptions,
  onSortBySelect,
  onDirectionToggle,
}: SortMenuContentProps) {
  return (
    <>
      <View className="mb-6">
        <Text className="mb-3 text-base font-semibold text-neutral-900 dark:text-neutral-50">
          {translate('strains.sort.sort_by_label')}
        </Text>
        <View className="gap-2">
          {SORT_OPTIONS.map((option) => (
            <Button
              key={option.value}
              label={translate(option.label as any)}
              variant={
                localOptions.sortBy === option.value ? 'default' : 'outline'
              }
              onPress={() => onSortBySelect(option.value)}
              testID={`sort-by-${option.value}`}
            />
          ))}
        </View>
      </View>

      {hasSortOptions && (
        <View className="mb-6">
          <Text className="mb-3 text-base font-semibold text-neutral-900 dark:text-neutral-50">
            {translate('strains.sort.direction_label')}
          </Text>
          <View className="flex-row gap-2">
            <Button
              label={translate('strains.sort.ascending')}
              variant={
                localOptions.sortDirection === 'asc' ? 'default' : 'outline'
              }
              onPress={onDirectionToggle}
              testID="sort-direction-asc"
              className="flex-1"
            />
            <Button
              label={translate('strains.sort.descending')}
              variant={
                localOptions.sortDirection === 'desc' ? 'default' : 'outline'
              }
              onPress={onDirectionToggle}
              testID="sort-direction-desc"
              className="flex-1"
            />
          </View>
        </View>
      )}
    </>
  );
}

interface SortMenuButtonsProps {
  hasSortOptions: boolean;
  onClear: () => void;
  onApply: () => void;
}

function SortMenuButtons({
  hasSortOptions,
  onClear,
  onApply,
}: SortMenuButtonsProps) {
  return (
    <View className="absolute inset-x-0 bottom-0 border-t border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <View className="flex-row gap-3">
        <View className="flex-1">
          <Button
            label={translate('strains.sort.clear')}
            variant="outline"
            onPress={onClear}
            disabled={!hasSortOptions}
            testID="sort-clear-button"
          />
        </View>
        <View className="flex-1">
          <Button
            label={translate('strains.sort.apply')}
            onPress={onApply}
            testID="sort-apply-button"
          />
        </View>
      </View>
    </View>
  );
}

export function useSortMenu() {
  const modal = useModal();

  const openSort = React.useCallback(() => {
    modal.present();
  }, [modal]);

  return {
    ref: modal.ref,
    openSort,
    closeSort: modal.dismiss,
  };
}

export const SortMenu = React.forwardRef<any, SortMenuProps>(
  ({ sortOptions, onApply, onClear }, ref) => {
    const [localOptions, setLocalOptions] =
      React.useState<SortOptions>(sortOptions);

    React.useEffect(() => {
      setLocalOptions(sortOptions);
    }, [sortOptions]);

    const handleSortBySelect = React.useCallback((sortBy: SortBy) => {
      setLocalOptions((prev) => ({
        ...prev,
        sortBy,
      }));
    }, []);

    const handleDirectionToggle = React.useCallback(() => {
      setLocalOptions((prev) => ({
        ...prev,
        sortDirection: prev.sortDirection === 'asc' ? 'desc' : 'asc',
      }));
    }, []);

    const handleClear = React.useCallback(() => {
      setLocalOptions({});
      onClear();
    }, [onClear]);

    const handleApply = React.useCallback(() => {
      onApply(localOptions);
    }, [localOptions, onApply]);

    const hasSortOptions = localOptions.sortBy !== undefined;

    return (
      <Modal
        ref={ref}
        snapPoints={['50%']}
        title={translate('strains.sort.title')}
      >
        <BottomSheetScrollView contentContainerClassName="px-4 pb-24">
          <SortMenuContent
            localOptions={localOptions}
            hasSortOptions={hasSortOptions}
            onSortBySelect={handleSortBySelect}
            onDirectionToggle={handleDirectionToggle}
          />
        </BottomSheetScrollView>

        <SortMenuButtons
          hasSortOptions={hasSortOptions}
          onClear={handleClear}
          onApply={handleApply}
        />
      </Modal>
    );
  }
);

SortMenu.displayName = 'SortMenu';
