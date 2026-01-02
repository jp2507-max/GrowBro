/**
 * Hook to manage list UI components (header, footer, empty state)
 */

import { useCallback, useMemo } from 'react';

import { StrainsCacheIndicator } from '@/components/strains/strains-cache-indicator';
import { StrainsEmptyState } from '@/components/strains/strains-empty-state';
import { StrainsErrorCard } from '@/components/strains/strains-error-card';
import { StrainsFooterLoader } from '@/components/strains/strains-footer-loader';
import { StrainsSkeletonList } from '@/components/strains/strains-skeleton-list';

interface UseListComponentsOptions {
  isLoading: boolean;
  isError: boolean;
  isOffline: boolean;
  isUsingCache: boolean;
  isFetchingNextPage: boolean;
  strainsLength: number;
  searchQuery?: string;
  onRetry: () => void;
}

interface UseListComponentsReturn {
  listEmpty: React.ReactElement;
  listHeader: React.ReactElement;
  listFooter: () => React.ReactElement;
}

/**
 * Manages list UI components based on current state
 */
export function useListComponents({
  isLoading,
  isError,
  isOffline,
  isUsingCache,
  isFetchingNextPage,
  strainsLength,
  searchQuery = '',
  onRetry,
}: UseListComponentsOptions): UseListComponentsReturn {
  const listEmpty = useMemo(() => {
    if (isLoading && strainsLength === 0) {
      return <StrainsSkeletonList />;
    }

    if (isError && !isOffline) {
      return <StrainsErrorCard onRetry={onRetry} />;
    }

    return (
      <StrainsEmptyState
        query={searchQuery}
        showOfflineNotice={isOffline && strainsLength === 0}
      />
    );
  }, [isLoading, isError, isOffline, strainsLength, searchQuery, onRetry]);

  const listHeader = useMemo(() => {
    return <StrainsCacheIndicator isUsingCache={isUsingCache} />;
  }, [isUsingCache]);

  const listFooter = useCallback(
    () => <StrainsFooterLoader isVisible={isFetchingNextPage} />,
    [isFetchingNextPage]
  );

  return {
    listEmpty,
    listHeader,
    listFooter,
  };
}
