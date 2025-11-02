import React from 'react';
import Sortable from 'react-native-sortables';

import { View } from '@/components/ui';
import { translate } from '@/lib/i18n';

type Props = {
  /**
   * Optional test ID for testing purposes
   */
  testID?: string;
};

/**
 * DragHandle component for sortable list items.
 * Wraps the Sortable.Handle to provide a visual drag handle with proper accessibility.
 * This component should only be used within items in a Sortable.Grid or Sortable.Flex.
 */
export function DragHandle({
  testID = 'drag-handle',
}: Props): React.ReactElement {
  return (
    <Sortable.Handle>
      <View
        accessible
        accessibilityLabel={translate('calendar.drag_handle_label')}
        accessibilityHint={translate('calendar.drag_handle_hint')}
        accessibilityRole="button"
        testID={testID}
        className="p-2"
      >
        {/* Three horizontal lines representing a drag handle */}
        <View className="gap-1">
          <View className="h-0.5 w-5 rounded-full bg-neutral-400" />
          <View className="h-0.5 w-5 rounded-full bg-neutral-400" />
          <View className="h-0.5 w-5 rounded-full bg-neutral-400" />
        </View>
      </View>
    </Sortable.Handle>
  );
}
