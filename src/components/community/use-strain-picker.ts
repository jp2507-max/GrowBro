import React from 'react';
import { useTranslation } from 'react-i18next';

import type { Strain } from '@/api/strains/types';
import { useStrainsInfiniteWithCache } from '@/api/strains/use-strains-infinite-with-cache';
import { haptics } from '@/lib/haptics';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';
import {
  buildCustomStrain,
  saveCustomStrainToSupabase,
} from '@/lib/strains/custom-strain-cache';

type UseStrainPickerOptions = {
  enableCustomStrain: boolean;
  onSelect?: (strain: string | undefined) => void;
  onSelectFull?: (
    strain: Strain | undefined,
    source?: 'api' | 'custom'
  ) => void;
  modalDismiss: () => void;
  modalExpand: () => void;
};

type StrainPickerActions = {
  handleOpen: () => void;
  handleSearchFocus: () => void;
  handleDismiss: () => void;
  handleSelect: (strain: Strain, source: 'api' | 'custom') => void;
  handleClear: () => void;
  handleCreateCustom: () => void;
  handleEndReached: () => void;
};

function useStrainPickerActions({
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
  modalDismiss,
  modalExpand,
  onSelect,
  onSelectFull,
  trimmedQuery,
  setIsOpen,
  setSearchQuery,
}: {
  fetchNextPage: () => void;
  hasNextPage?: boolean;
  isFetchingNextPage: boolean;
  modalDismiss: () => void;
  modalExpand: () => void;
  onSelect?: (strain: string | undefined) => void;
  onSelectFull?: (
    strain: Strain | undefined,
    source?: 'api' | 'custom'
  ) => void;
  trimmedQuery: string;
  setIsOpen: (open: boolean) => void;
  setSearchQuery: (value: string) => void;
}): StrainPickerActions {
  const handleOpen = React.useCallback((): void => {
    haptics.selection();
    setIsOpen(true);
  }, [setIsOpen]);

  const handleSearchFocus = React.useCallback((): void => {
    modalExpand();
  }, [modalExpand]);

  const handleDismiss = React.useCallback((): void => {
    setIsOpen(false);
    setSearchQuery('');
  }, [setIsOpen, setSearchQuery]);

  const handleSelect = React.useCallback(
    (strain: Strain, source: 'api' | 'custom'): void => {
      onSelect?.(strain.name);
      onSelectFull?.(strain, source);
      modalDismiss();
      setSearchQuery('');
      setIsOpen(false);
    },
    [modalDismiss, onSelect, onSelectFull, setIsOpen, setSearchQuery]
  );

  const handleClear = React.useCallback((): void => {
    onSelect?.(undefined);
    onSelectFull?.(undefined);
    modalDismiss();
    setSearchQuery('');
    setIsOpen(false);
  }, [modalDismiss, onSelect, onSelectFull, setIsOpen, setSearchQuery]);

  const handleCreateCustom = React.useCallback((): void => {
    const name = trimmedQuery;
    if (!name) return;
    const customStrain = buildCustomStrain(name);
    saveCustomStrainToSupabase(customStrain).catch((error) => {
      console.warn('[StrainPicker] Failed to persist custom strain:', error);
    });
    handleSelect(customStrain, 'custom');
  }, [handleSelect, trimmedQuery]);

  const handleEndReached = React.useCallback((): void => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return {
    handleOpen,
    handleSearchFocus,
    handleDismiss,
    handleSelect,
    handleClear,
    handleCreateCustom,
    handleEndReached,
  };
}

export function useStrainPicker({
  enableCustomStrain,
  onSelect,
  onSelectFull,
  modalDismiss,
  modalExpand,
}: UseStrainPickerOptions) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
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

  const {
    handleOpen,
    handleSearchFocus,
    handleDismiss,
    handleSelect,
    handleClear,
    handleCreateCustom,
    handleEndReached,
  } = useStrainPickerActions({
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    modalDismiss,
    modalExpand,
    onSelect,
    onSelectFull,
    trimmedQuery,
    setIsOpen,
    setSearchQuery,
  });

  return {
    t,
    isOpen,
    searchQuery,
    setSearchQuery,
    debouncedSearchQuery,
    strains,
    trimmedQuery,
    hasExactMatch,
    showCreateCustom,
    isFetching,
    handleOpen,
    handleSearchFocus,
    handleDismiss,
    handleSelect,
    handleClear,
    handleCreateCustom,
    handleEndReached,
  };
}
