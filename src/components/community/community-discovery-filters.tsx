import * as React from 'react';

import { type CommunityPostSort } from '@/api/community';
import { Button, Text, View } from '@/components/ui';
import { Radio } from '@/components/ui/checkbox';
import { BottomSheetScrollView } from '@/components/ui/modal';
import { Switch } from '@/components/ui/switch';
import { translate } from '@/lib/i18n';

type CommunityDiscoveryFiltersProps = {
  sort: CommunityPostSort;
  photosOnly: boolean;
  mineOnly: boolean;
  onSortChange: (sort: CommunityPostSort) => void;
  onPhotosOnlyChange: (next: boolean) => void;
  onMineOnlyChange: (next: boolean) => void;
  onClearAll: () => void;
  testID?: string;
};

export function CommunityDiscoveryFilters({
  sort,
  photosOnly,
  mineOnly,
  onSortChange,
  onPhotosOnlyChange,
  onMineOnlyChange,
  onClearAll,
  testID = 'community-discovery-filters',
}: CommunityDiscoveryFiltersProps): React.ReactElement {
  return (
    <BottomSheetScrollView contentContainerClassName="px-4 pb-6">
      <View testID={testID}>
        <Text className="mb-2 text-sm font-semibold text-neutral-700 dark:text-neutral-200">
          {translate('community.sort_label')}
        </Text>
        <View className="gap-3">
          <Radio
            checked={sort === 'new'}
            onChange={() => onSortChange('new')}
            accessibilityLabel={translate('community.sort_newest')}
            accessibilityHint={translate('accessibility.common.toggle_hint')}
            label={translate('community.sort_newest')}
            testID={`${testID}-sort-new`}
          />
          <Radio
            checked={sort === 'top_7d'}
            onChange={() => onSortChange('top_7d')}
            accessibilityLabel={translate('community.sort_top_7d')}
            accessibilityHint={translate('accessibility.common.toggle_hint')}
            label={translate('community.sort_top_7d')}
            testID={`${testID}-sort-top`}
          />
        </View>

        <Text className="mb-2 mt-6 text-sm font-semibold text-neutral-700 dark:text-neutral-200">
          {translate('community.filters_label')}
        </Text>
        <View className="gap-4">
          <View className="flex-row items-center justify-between">
            <Text className="text-base text-neutral-900 dark:text-neutral-50">
              {translate('community.filter_photos_only')}
            </Text>
            <Switch
              value={photosOnly}
              onValueChange={onPhotosOnlyChange}
              accessibilityLabel={translate('community.filter_photos_only')}
              accessibilityHint={translate('accessibility.common.toggle_hint')}
              testID={`${testID}-photos-only`}
            />
          </View>
          <View className="flex-row items-center justify-between">
            <Text className="text-base text-neutral-900 dark:text-neutral-50">
              {translate('community.filter_my_posts')}
            </Text>
            <Switch
              value={mineOnly}
              onValueChange={onMineOnlyChange}
              accessibilityLabel={translate('community.filter_my_posts')}
              accessibilityHint={translate('accessibility.common.toggle_hint')}
              testID={`${testID}-mine-only`}
            />
          </View>
        </View>

        <View className="mt-6">
          <Button
            variant="outline"
            label={translate('community.clear_filters')}
            onPress={onClearAll}
            testID={`${testID}-clear`}
          />
        </View>
      </View>
    </BottomSheetScrollView>
  );
}
