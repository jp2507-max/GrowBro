import React from 'react';

import {
  Button,
  Modal,
  Pressable,
  Text,
  useModal,
  View,
} from '@/components/ui';
import { translate } from '@/lib';
import type { TxKeyPath } from '@/lib/i18n';

export type FavoritesSortBy = 'dateAdded' | 'name' | 'thc';
export type FavoritesSortDirection = 'asc' | 'desc';

interface FavoritesSortMenuProps {
  sortBy: FavoritesSortBy;
  sortDirection: FavoritesSortDirection;
  onApply: (sortBy: FavoritesSortBy, direction: FavoritesSortDirection) => void;
}

const sortOptions: { value: FavoritesSortBy; tx: TxKeyPath }[] = [
  { value: 'dateAdded', tx: 'strains.favorites.sort.date_added' },
  { value: 'name', tx: 'strains.favorites.sort.name' },
  { value: 'thc', tx: 'strains.favorites.sort.thc_content' },
];

function SortOption({
  option,
  selected,
  onSelect,
}: {
  option: { value: FavoritesSortBy; tx: TxKeyPath };
  selected: boolean;
  onSelect: (value: FavoritesSortBy) => void;
}) {
  return (
    <Pressable
      onPress={() => onSelect(option.value)}
      className={`rounded-lg border p-3 ${
        selected
          ? 'dark:bg-primary-950 border-primary-600 bg-primary-50'
          : 'border-neutral-300 bg-white dark:border-neutral-700 dark:bg-neutral-900'
      }`}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      testID={`sort-option-${option.value}`}
    >
      <Text
        className={
          selected
            ? 'text-primary-600 dark:text-primary-400'
            : 'text-neutral-900 dark:text-neutral-50'
        }
      >
        {translate(option.tx)}
      </Text>
    </Pressable>
  );
}

function DirectionButton({
  direction,
  selected,
  onSelect,
  tx,
}: {
  direction: FavoritesSortDirection;
  selected: boolean;
  onSelect: (dir: FavoritesSortDirection) => void;
  tx: TxKeyPath;
}) {
  return (
    <Pressable
      onPress={() => onSelect(direction)}
      className={`flex-1 rounded-lg border p-3 ${
        selected
          ? 'dark:bg-primary-950 border-primary-600 bg-primary-50'
          : 'border-neutral-300 bg-white dark:border-neutral-700 dark:bg-neutral-900'
      }`}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      testID={`sort-direction-${direction}`}
    >
      <Text
        className={
          selected
            ? 'text-center text-primary-600 dark:text-primary-400'
            : 'text-center text-neutral-900 dark:text-neutral-50'
        }
      >
        {translate(tx)}
      </Text>
    </Pressable>
  );
}

export function useFavoritesSortMenu() {
  const modal = useModal();
  return {
    ref: modal.ref,
    openSort: modal.present,
    closeSort: modal.dismiss,
  };
}

export const FavoritesSortMenu = React.forwardRef<
  React.ElementRef<typeof Modal>,
  FavoritesSortMenuProps
>(
  (
    { sortBy: initialSortBy, sortDirection: initialDirection, onApply },
    ref
  ) => {
    const [sortBy, setSortBy] = React.useState(initialSortBy);
    const [sortDirection, setSortDirection] = React.useState(initialDirection);

    React.useEffect(() => {
      setSortBy(initialSortBy);
      setSortDirection(initialDirection);
    }, [initialSortBy, initialDirection]);

    const handleApply = React.useCallback(() => {
      onApply(sortBy, sortDirection);
    }, [sortBy, sortDirection, onApply]);

    return (
      <Modal ref={ref} snapPoints={['50%']}>
        <View className="p-4">
          <Text
            className="mb-4 text-xl font-semibold text-neutral-900 dark:text-neutral-50"
            tx="strains.favorites.sort.title"
          />

          <Text className="mb-2 text-sm font-medium text-neutral-700 dark:text-neutral-200">
            {translate('strains.sort.sort_by_label')}
          </Text>
          <View className="mb-4 gap-2">
            {sortOptions.map((option) => (
              <SortOption
                key={option.value}
                option={option}
                selected={sortBy === option.value}
                onSelect={setSortBy}
              />
            ))}
          </View>

          <Text className="mb-2 text-sm font-medium text-neutral-700 dark:text-neutral-200">
            {translate('strains.sort.direction_label')}
          </Text>
          <View className="mb-4 flex-row gap-2">
            <DirectionButton
              direction="asc"
              selected={sortDirection === 'asc'}
              onSelect={setSortDirection}
              tx="strains.sort.ascending"
            />
            <DirectionButton
              direction="desc"
              selected={sortDirection === 'desc'}
              onSelect={setSortDirection}
              tx="strains.sort.descending"
            />
          </View>

          <Button
            onPress={handleApply}
            label={translate('strains.sort.apply')}
            testID="apply-sort-button"
          />
        </View>
      </Modal>
    );
  }
);

FavoritesSortMenu.displayName = 'FavoritesSortMenu';
