import React from 'react';

import type { OptionType } from '@/components/ui';
import { Select, Text, View } from '@/components/ui';
import { translate } from '@/lib';

type Reservoir = {
  id: string;
  name: string;
  medium: string;
  volumeL: number;
};

type Props = {
  reservoirs: Reservoir[];
  selectedId?: string;
  onSelect: (id: string) => void;
  testID?: string;
};

export function ReservoirSelector({
  reservoirs,
  selectedId,
  onSelect,
  testID,
}: Props): React.ReactElement {
  const options: OptionType[] = reservoirs.map((r) => ({
    value: r.id,
    label: `${r.name} (${r.volumeL}L ${r.medium})`,
  }));

  if (reservoirs.length === 0) {
    return (
      <View
        className="rounded-lg border border-neutral-200 bg-neutral-50 p-4"
        testID={testID}
      >
        <Text className="text-center text-sm text-neutral-600">
          {translate('nutrient.reservoir.no_reservoirs')}
        </Text>
      </View>
    );
  }

  return (
    <Select
      label={translate('nutrient.reservoir.select_reservoir')}
      options={options}
      value={selectedId}
      onSelect={(v) => onSelect(String(v))}
      testID={testID}
    />
  );
}
