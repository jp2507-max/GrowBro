import * as React from 'react';
import { ActivityIndicator, Pressable, TextInput } from 'react-native';

import { Text, View } from '@/components/ui';
import colors from '@/components/ui/colors';
import { translate } from '@/lib/i18n';

type CommunitySearchBarProps = {
  value: string;
  onChangeText: (text: string) => void;
  isSearching?: boolean;
  onFilterPress?: () => void;
  hasActiveFilters?: boolean;
  testID?: string;
};

export function CommunitySearchBar({
  value,
  onChangeText,
  isSearching = false,
  onFilterPress,
  hasActiveFilters = false,
  testID = 'community-search-bar',
}: CommunitySearchBarProps): React.ReactElement {
  const inputRef = React.useRef<TextInput>(null);

  const handleClear = React.useCallback((): void => {
    onChangeText('');
    inputRef.current?.focus();
  }, [onChangeText]);

  return (
    <View className="px-4 pb-2 pt-4" testID={testID}>
      <View className="flex-row items-center gap-2">
        <View className="relative flex-1">
          <TextInput
            ref={inputRef}
            value={value}
            onChangeText={onChangeText}
            placeholder={translate('community.search_placeholder')}
            placeholderTextColor={colors.neutral[400]}
            accessibilityLabel={translate('community.search_label')}
            accessibilityHint={translate('community.search_hint')}
            testID={`${testID}-input`}
            className="h-12 rounded-2xl border-0 bg-white/90 px-4 pr-10 text-base font-medium text-charcoal-900 shadow-sm dark:bg-neutral-900/90 dark:text-neutral-100"
            returnKeyType="search"
            clearButtonMode="never"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <View className="absolute right-2 top-0 h-12 items-center justify-center">
            {isSearching ? (
              <ActivityIndicator
                size="small"
                color={colors.primary[600]}
                testID={`${testID}-loading`}
              />
            ) : value.length > 0 ? (
              <Pressable
                onPress={handleClear}
                accessibilityLabel={translate('common.clear')}
                accessibilityHint={translate('community.search_clear_hint')}
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

        {onFilterPress && (
          <Pressable
            onPress={onFilterPress}
            accessibilityLabel={translate('community.filters_label')}
            accessibilityHint={translate('community.filters_hint')}
            accessibilityRole="button"
            accessibilityState={{ selected: hasActiveFilters }}
            testID={`${testID}-filter-button`}
            className={`size-12 items-center justify-center rounded-lg border ${
              hasActiveFilters
                ? 'border-primary-600 bg-primary-50 dark:bg-primary-950'
                : 'border-neutral-200 bg-white dark:border-white/10 dark:bg-charcoal-900'
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
    </View>
  );
}
