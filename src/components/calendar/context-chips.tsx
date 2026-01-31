import * as React from 'react';
import { ScrollView } from 'react-native';

import { Text, View } from '@/components/ui';
import colors from '@/components/ui/colors';
import { Droplet, Leaf, Lightbulb } from '@/components/ui/icons';
import { cn } from '@/lib/utils';

type ContextChip = {
  id: string;
  icon: 'water' | 'leaf' | 'light';
  label: string;
  color: 'primary' | 'teal' | 'muted';
};

type ContextChipsProps = {
  chips?: ContextChip[];
  testID?: string;
};

const DEFAULT_CHIPS: ContextChip[] = [
  { id: 'water', icon: 'water', label: 'Water Day', color: 'primary' },
  { id: 'veg', icon: 'leaf', label: 'Veg Stage (Wk 4)', color: 'teal' },
  { id: 'light', icon: 'light', label: '18h Light', color: 'muted' },
];

function ChipIcon({
  icon,
  color,
}: {
  icon: ContextChip['icon'];
  color: ContextChip['color'];
}): React.ReactElement {
  const iconSize = 14;
  const iconColor =
    color === 'primary'
      ? colors.neon.lime
      : color === 'teal'
        ? colors.neon.teal
        : colors.neutral[400];

  switch (icon) {
    case 'water':
      return <Droplet width={iconSize} height={iconSize} color={iconColor} />;
    case 'leaf':
      return <Leaf width={iconSize} height={iconSize} color={iconColor} />;
    case 'light':
      return <Lightbulb width={iconSize} height={iconSize} color={iconColor} />;
    default:
      return <Leaf width={iconSize} height={iconSize} color={iconColor} />;
  }
}

function Chip({ chip }: { chip: ContextChip }): React.ReactElement {
  const textColorClass =
    chip.color === 'primary'
      ? 'text-lime-400'
      : chip.color === 'teal'
        ? 'text-emerald-400'
        : 'text-neutral-400';

  return (
    <View
      className="flex-row items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5"
      testID={`context-chip-${chip.id}`}
    >
      <ChipIcon icon={chip.icon} color={chip.color} />
      <Text className={cn('text-xs font-medium', textColorClass)}>
        {chip.label}
      </Text>
    </View>
  );
}

/**
 * Horizontal scrollable context chips showing day context
 * (Water Day, Veg Stage, Light cycle etc.)
 */
export function ContextChips({
  chips = DEFAULT_CHIPS,
  testID = 'context-chips',
}: ContextChipsProps): React.ReactElement {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="gap-2 px-4"
      testID={testID}
    >
      {chips.map((chip) => (
        <Chip key={chip.id} chip={chip} />
      ))}
    </ScrollView>
  );
}
