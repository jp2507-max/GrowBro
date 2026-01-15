import * as React from 'react';
import { Keyboard } from 'react-native';

import { Input, Pressable, Text, View } from '@/components/ui';
import { translate } from '@/lib/i18n';
import type { SearchHistoryItem } from '@/lib/storage/search-history';
import {
  addToSearchHistory,
  clearSearchHistory,
  getSearchHistory,
  removeFromSearchHistory,
} from '@/lib/storage/search-history';

interface SearchInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onClear?: () => void;
  placeholder?: string;
  testID?: string;
}

interface SearchHistoryListProps {
  history: SearchHistoryItem[];
  testID: string;
  onSelect: (query: string) => void;
  onRemove: (query: string) => void;
  onClearAll: () => void;
}

interface HistoryItemProps {
  item: SearchHistoryItem;
  testID: string;
  onSelect: (query: string) => void;
  onRemove: (query: string) => void;
}

function HistoryItem({ item, testID, onSelect, onRemove }: HistoryItemProps) {
  return (
    <View
      key={item.query}
      className="flex-row items-center justify-between py-2"
    >
      <Pressable
        onPress={() => onSelect(item.query)}
        className="flex-1"
        testID={`${testID}-history-item-${item.query}`}
        accessibilityRole="button"
        accessibilityLabel={translate(
          'accessibility.strains.search_for_query_label',
          { query: item.query }
        )}
        accessibilityHint={translate(
          'accessibility.strains.select_search_query_hint'
        )}
      >
        <View className="flex-row items-center">
          <Text className="mr-2 text-neutral-400">🕐</Text>
          <Text className="text-neutral-900 dark:text-neutral-100">
            {item.query}
          </Text>
        </View>
      </Pressable>
      <Pressable
        onPress={() => onRemove(item.query)}
        testID={`${testID}-remove-history-${item.query}`}
        accessibilityRole="button"
        accessibilityLabel={translate(
          'accessibility.strains.remove_query_from_history_label',
          { query: item.query }
        )}
        accessibilityHint={translate(
          'accessibility.strains.remove_query_from_history_hint'
        )}
      >
        <Text className="text-neutral-400">✕</Text>
      </Pressable>
    </View>
  );
}

function SearchHistoryList({
  history,
  testID,
  onSelect,
  onRemove,
  onClearAll,
}: SearchHistoryListProps) {
  return (
    <View
      className="mt-2 rounded-lg border border-neutral-200 bg-white p-2 dark:border-neutral-800 dark:bg-neutral-900"
      testID={`${testID}-history`}
    >
      <View className="mb-2 flex-row items-center justify-between">
        <Text className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
          {translate('strains.search.recent_searches')}
        </Text>
        <Pressable
          onPress={onClearAll}
          testID={`${testID}-clear-history`}
          accessibilityRole="button"
          accessibilityLabel={translate(
            'accessibility.strains.clear_search_history_label'
          )}
          accessibilityHint={translate(
            'accessibility.strains.clear_search_history_hint'
          )}
        >
          <Text className="text-sm text-primary-600 dark:text-primary-400">
            {translate('strains.search.clear_all')}
          </Text>
        </Pressable>
      </View>

      {history.map((item) => (
        <HistoryItem
          key={item.query}
          item={item}
          testID={testID}
          onSelect={onSelect}
          onRemove={onRemove}
        />
      ))}
    </View>
  );
}

function useSearchHistory(onChangeText: (text: string) => void) {
  const [showHistory, setShowHistory] = React.useState(false);
  const [history, setHistory] = React.useState<SearchHistoryItem[]>([]);
  const blurTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const handleFocus = React.useCallback(() => {
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }
    setShowHistory(true);
    setHistory(getSearchHistory());
  }, []);

  const handleBlur = React.useCallback(() => {
    if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
    blurTimeoutRef.current = setTimeout(() => setShowHistory(false), 150);
  }, []);

  const handleHistorySelect = React.useCallback(
    (query: string) => {
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
        blurTimeoutRef.current = null;
      }
      onChangeText(query);
      setShowHistory(false);
      Keyboard.dismiss();
      addToSearchHistory(query);
    },
    [onChangeText]
  );

  const handleRemoveHistoryItem = React.useCallback((query: string) => {
    removeFromSearchHistory(query);
    setHistory(getSearchHistory());
  }, []);

  const handleClearHistory = React.useCallback(() => {
    clearSearchHistory();
    setHistory([]);
  }, []);

  React.useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
        blurTimeoutRef.current = null;
      }
    };
  }, []);

  return {
    showHistory,
    setShowHistory,
    history,
    handleFocus,
    handleBlur,
    handleHistorySelect,
    handleRemoveHistoryItem,
    handleClearHistory,
  };
}

export function SearchInput({
  value,
  onChangeText,
  onClear,
  placeholder,
  testID = 'strains-search-input',
}: SearchInputProps) {
  const searchHistory = useSearchHistory(onChangeText);

  const handleClear = React.useCallback(() => {
    onChangeText('');
    onClear?.();
    searchHistory.setShowHistory(false);
  }, [onChangeText, onClear, searchHistory]);

  const hasValue = value.length > 0;
  const showHistoryList =
    searchHistory.showHistory && !hasValue && searchHistory.history.length > 0;

  return (
    <View>
      <View className="relative">
        <Input
          value={value}
          onChangeText={onChangeText}
          onFocus={searchHistory.handleFocus}
          onBlur={searchHistory.handleBlur}
          placeholder={placeholder || translate('strains.search_placeholder')}
          testID={testID}
          className="pr-10"
          accessibilityLabel={translate('strains.search_placeholder')}
          accessibilityHint={translate('accessibility.strains.search_hint')}
        />
        {hasValue && (
          <Pressable
            onPress={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-neutral-200 px-2 py-1 dark:bg-neutral-700"
            testID={`${testID}-clear`}
            accessibilityLabel={translate(
              'accessibility.strains.clear_search_label'
            )}
            accessibilityHint={translate(
              'accessibility.strains.clear_search_hint'
            )}
            accessibilityRole="button"
          >
            <Text className="text-xs text-neutral-600 dark:text-neutral-300">
              ✕
            </Text>
          </Pressable>
        )}
      </View>

      {showHistoryList && (
        <SearchHistoryList
          history={searchHistory.history}
          testID={testID}
          onSelect={searchHistory.handleHistorySelect}
          onRemove={searchHistory.handleRemoveHistoryItem}
          onClearAll={searchHistory.handleClearHistory}
        />
      )}
    </View>
  );
}
