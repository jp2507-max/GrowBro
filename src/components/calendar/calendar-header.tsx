import { DateTime } from 'luxon';
import React from 'react';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { WeekStrip } from '@/components/calendar/week-strip';
import {
  HeaderSettingsButton,
  ScreenHeaderBase,
} from '@/components/navigation/screen-header-base';
import { Text, View } from '@/components/ui';
import { translate } from '@/lib/i18n';
import type { TxKeyPath } from '@/lib/i18n/utils';

type CalendarHeaderProps = {
  selectedDate: DateTime;
  onDateSelect: (date: DateTime) => void;
  insets: EdgeInsets;
};

function formatHeaderTitle(selectedDate: DateTime): string {
  const today = DateTime.now().startOf('day');

  if (selectedDate.hasSame(today, 'day')) {
    return translate('calendar.header.today' as TxKeyPath);
  }

  return selectedDate.toFormat('ccc, LLL d');
}

function HeaderSubtitle(): React.ReactElement {
  return (
    <Text className="text-lg font-medium text-primary-200 dark:text-primary-300">
      {translate('calendar.header.subtitle' as TxKeyPath)}
    </Text>
  );
}

export function CalendarHeader({
  selectedDate,
  onDateSelect,
  insets,
}: CalendarHeaderProps): React.ReactElement {
  const title = formatHeaderTitle(selectedDate);

  return (
    <ScreenHeaderBase
      insets={insets}
      topRowLeft={<HeaderSubtitle />}
      topRowRight={<HeaderSettingsButton />}
      title={title}
      testID="calendar-header"
    >
      <View className="mt-1">
        <WeekStrip
          selectedDate={selectedDate}
          onDateSelect={onDateSelect}
          testID="calendar-week-strip"
        />
      </View>
    </ScreenHeaderBase>
  );
}
