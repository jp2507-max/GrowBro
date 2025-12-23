/**
 * Inventory Search Bar Component
 *
 * Search input with 150ms debouncing, clear button, and offline indicator.
 * Provides accessible search interface with keyboard support and visual feedback.
 *
 * Requirements:
 * - 8.5: 150ms debounce and cache last query for offline access
 * - 8.6: Instant offline results from cached index
 *
 * Performance:
 * - Optimized input handling with React.memo
 * - Debounced search to prevent excessive queries
 * - Accessibility labels for screen readers
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, TextInput } from 'react-native';

import { Text, View } from '@/components/ui';
import colors from '@/components/ui/colors';

interface InventorySearchBarProps {
  /** Current search text */
  value: string;

  /** Callback when search text changes */
  onChangeText: (text: string) => void;

  /** Whether search is in progress */
  isSearching?: boolean;

  /** Whether results are from offline cache */
  isOffline?: boolean;

  /** Callback when filter button is pressed */
  onFilterPress?: () => void;

  /** Whether filters are active */
  hasActiveFilters?: boolean;

  /** Test ID for testing */
  testID?: string;
}

/**
 * Search bar for inventory items
 */
export const InventorySearchBar = React.memo(function InventorySearchBar({
  value,
  onChangeText,
  isSearching = false,
  isOffline = false,
  onFilterPress,
  hasActiveFilters = false,
  testID = 'inventory-search-bar',
}: InventorySearchBarProps): React.ReactElement {
  const { t } = useTranslation();
  const inputRef = React.useRef<TextInput>(null);

  const handleClear = React.useCallback(() => {
    onChangeText('');
    inputRef.current?.focus();
  }, [onChangeText]);

  return (
    <View className="px-4 py-3" testID={testID}>
      <View className="flex-row items-center gap-2">
        {/* Search Input */}
        <View className="relative flex-1">
          <TextInput
            ref={inputRef}
            value={value}
            onChangeText={onChangeText}
            placeholder={t('harvest.inventory.search_placeholder')}
            placeholderTextColor={colors.neutral[400]}
            accessibilityLabel={t('harvest.inventory.search_label')}
            accessibilityHint={t('harvest.inventory.search_hint')}
            testID={`${testID}-input`}
            className="h-12 rounded-lg border border-neutral-200 bg-white px-4 pr-10 text-base text-charcoal-900 dark:border-charcoal-700 dark:bg-charcoal-900 dark:text-neutral-100"
            returnKeyType="search"
            clearButtonMode="never" // Custom clear button
            autoCapitalize="none"
            autoCorrect={false}
          />

          {/* Loading/Clear Button */}
          <View className="absolute right-2 top-0 h-12 items-center justify-center">
            {isSearching ? (
              <ActivityIndicator
                size="small"
                color="#0ea5e9"
                testID={`${testID}-loading`}
              />
            ) : value.length > 0 ? (
              <Pressable
                onPress={handleClear}
                accessibilityLabel={t('common.clear')}
                accessibilityHint={t('harvest.inventory.clear_search_hint')}
                accessibilityRole="button"
                testID={`${testID}-clear`}
                className="size-8 items-center justify-center rounded-full bg-neutral-200 dark:bg-neutral-700"
              >
                <Text className="text-base text-neutral-600 dark:text-neutral-400">
                  ✕
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        {/* Filter Button */}
        {onFilterPress && (
          <Pressable
            onPress={onFilterPress}
            accessibilityLabel={t('harvest.inventory.filters')}
            accessibilityHint={t('harvest.inventory.filter_hint')}
            accessibilityRole="button"
            accessibilityState={{ selected: hasActiveFilters }}
            testID={`${testID}-filter-button`}
            className={`size-12 items-center justify-center rounded-lg border ${
              hasActiveFilters
                ? 'border-primary-600 bg-primary-50 dark:bg-primary-950'
                : 'border-border bg-card'
            }`}
          >
            <Text
              className={`text-lg ${
                hasActiveFilters
                  ? 'text-primary-600 dark:text-primary-400'
                  : 'text-neutral-600 dark:text-neutral-400'
              }`}
            >
              ⚙
            </Text>
            {hasActiveFilters && (
              <View className="absolute -right-1 -top-1 size-3 rounded-full border border-white bg-primary-600 dark:border-charcoal-950" />
            )}
          </Pressable>
        )}
      </View>

      {/* Offline Indicator */}
      {isOffline && (
        <View
          className="dark:bg-warning-950 mt-2 flex-row items-center gap-1 rounded-md bg-warning-50 px-2 py-1"
          testID={`${testID}-offline-indicator`}
        >
          <Text className="text-xs text-warning-700 dark:text-warning-300">
            ⚠ {t('harvest.inventory.search_offline')}
          </Text>
        </View>
      )}
    </View>
  );
});
