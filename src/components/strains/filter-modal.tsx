import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import * as React from 'react';

import type { StrainFilters } from '@/api/strains/types';
import { Button, Checkbox, Modal, Text, useModal, View } from '@/components/ui';
import type { TxKeyPath } from '@/lib/i18n';
import { translate, translateDynamic } from '@/lib/i18n';

import { DifficultyBadge } from './difficulty-badge';
import { RaceBadge } from './race-badge';

type FilterModalProps = {
  filters: StrainFilters;
  onApply: (filters: StrainFilters) => void;
  onClear: () => void;
};

const RACE_OPTIONS: { value: StrainFilters['race']; label: string }[] = [
  { value: 'indica', label: 'strains.race.indica' },
  { value: 'sativa', label: 'strains.race.sativa' },
  { value: 'hybrid', label: 'strains.race.hybrid' },
];

const DIFFICULTY_OPTIONS: {
  value: StrainFilters['difficulty'];
  label: string;
}[] = [
  { value: 'beginner', label: 'strains.difficulty.beginner' },
  { value: 'intermediate', label: 'strains.difficulty.intermediate' },
  { value: 'advanced', label: 'strains.difficulty.advanced' },
];

// THC level options with corresponding filter values
type ThcLevel = 'any' | 'low' | 'medium' | 'high';
const THC_OPTIONS: {
  value: ThcLevel;
  label: string;
  thcMin?: number;
  thcMax?: number;
}[] = [
  { value: 'any', label: 'strains.filters.thc_any' },
  { value: 'low', label: 'strains.filters.thc_low', thcMax: 10 },
  {
    value: 'medium',
    label: 'strains.filters.thc_medium',
    thcMin: 10,
    thcMax: 20,
  },
  { value: 'high', label: 'strains.filters.thc_high', thcMin: 20 },
];

// CBD level options with corresponding filter values
type CbdLevel = 'any' | 'low' | 'medium' | 'high';
const CBD_OPTIONS: {
  value: CbdLevel;
  label: string;
  cbdMin?: number;
  cbdMax?: number;
}[] = [
  { value: 'any', label: 'strains.filters.cbd_any' },
  { value: 'low', label: 'strains.filters.cbd_low', cbdMax: 5 },
  {
    value: 'medium',
    label: 'strains.filters.cbd_medium',
    cbdMin: 5,
    cbdMax: 15,
  },
  { value: 'high', label: 'strains.filters.cbd_high', cbdMin: 15 },
];

// Helper to determine current THC level from filter values
function getThcLevelFromFilters(filters: StrainFilters): ThcLevel {
  if (filters.thcMin === undefined && filters.thcMax === undefined)
    return 'any';
  if (filters.thcMax === 10 && filters.thcMin === undefined) return 'low';
  if (filters.thcMin === 10 && filters.thcMax === 20) return 'medium';
  if (filters.thcMin === 20 && filters.thcMax === undefined) return 'high';
  return 'any';
}

// Helper to determine current CBD level from filter values
function getCbdLevelFromFilters(filters: StrainFilters): CbdLevel {
  if (filters.cbdMin === undefined && filters.cbdMax === undefined)
    return 'any';
  if (filters.cbdMax === 5 && filters.cbdMin === undefined) return 'low';
  if (filters.cbdMin === 5 && filters.cbdMax === 15) return 'medium';
  if (filters.cbdMin === 15 && filters.cbdMax === undefined) return 'high';
  return 'any';
}

const COMMON_EFFECTS = [
  'happy',
  'relaxed',
  'euphoric',
  'uplifted',
  'creative',
  'energetic',
  'focused',
  'giggly',
  'sleepy',
  'hungry',
];

const COMMON_FLAVORS = [
  'earthy',
  'sweet',
  'citrus',
  'pine',
  'diesel',
  'berry',
  'fruity',
  'sour',
  'spicy',
  'woody',
];

export function useStrainFilters() {
  const modal = useModal();

  const openFilters = React.useCallback(() => {
    modal.present();
  }, [modal]);

  return {
    ref: modal.ref,
    openFilters,
    closeFilters: modal.dismiss,
  };
}

/** Checkbox list for effects/flavors */
type CheckboxListProps = {
  items: readonly string[];
  selected: string[] | undefined;
  onToggle: (item: string) => void;
  labelKey: string;
  hintKey: TxKeyPath;
  testIdPrefix: string;
};

function CheckboxList({
  items,
  selected,
  onToggle,
  labelKey,
  hintKey,
  testIdPrefix,
}: CheckboxListProps) {
  return (
    <View className="gap-2">
      {items.map((item) => (
        <Checkbox.Root
          key={item}
          checked={selected?.includes(item) || false}
          onChange={() => onToggle(item)}
          testID={`${testIdPrefix}-${item}`}
          accessibilityLabel={translateDynamic(`${labelKey}.${item}`)}
          accessibilityHint={translate(hintKey)}
        >
          <Checkbox.Icon checked={selected?.includes(item) || false} />
          <Checkbox.Label text={translateDynamic(`${labelKey}.${item}`)} />
        </Checkbox.Root>
      ))}
    </View>
  );
}

/** Hook to manage local filter state and handlers */
function useFilterHandlers(
  filters: StrainFilters,
  onApply: (filters: StrainFilters) => void,
  onClear: () => void
) {
  const [localFilters, setLocalFilters] =
    React.useState<StrainFilters>(filters);

  React.useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  const handleRaceToggle = React.useCallback((race: StrainFilters['race']) => {
    setLocalFilters((prev) => ({
      ...prev,
      race: prev.race === race ? undefined : race,
    }));
  }, []);

  const handleDifficultyToggle = React.useCallback(
    (difficulty: StrainFilters['difficulty']) => {
      setLocalFilters((prev) => ({
        ...prev,
        difficulty: prev.difficulty === difficulty ? undefined : difficulty,
      }));
    },
    []
  );

  const handleEffectToggle = React.useCallback((effect: string) => {
    setLocalFilters((prev) => {
      const currentEffects = prev.effects || [];
      const hasEffect = currentEffects.includes(effect);
      return {
        ...prev,
        effects: hasEffect
          ? currentEffects.filter((e) => e !== effect)
          : [...currentEffects, effect],
      };
    });
  }, []);

  const handleFlavorToggle = React.useCallback((flavor: string) => {
    setLocalFilters((prev) => {
      const currentFlavors = prev.flavors || [];
      const hasFlavor = currentFlavors.includes(flavor);
      return {
        ...prev,
        flavors: hasFlavor
          ? currentFlavors.filter((f) => f !== flavor)
          : [...currentFlavors, flavor],
      };
    });
  }, []);

  const handleThcLevelToggle = React.useCallback((level: ThcLevel) => {
    setLocalFilters((prev) => {
      const option = THC_OPTIONS.find((o) => o.value === level);
      if (!option || level === 'any') {
        return { ...prev, thcMin: undefined, thcMax: undefined };
      }
      return { ...prev, thcMin: option.thcMin, thcMax: option.thcMax };
    });
  }, []);

  const handleCbdLevelToggle = React.useCallback((level: CbdLevel) => {
    setLocalFilters((prev) => {
      const option = CBD_OPTIONS.find((o) => o.value === level);
      if (!option || level === 'any') {
        return { ...prev, cbdMin: undefined, cbdMax: undefined };
      }
      return { ...prev, cbdMin: option.cbdMin, cbdMax: option.cbdMax };
    });
  }, []);

  const handleClear = React.useCallback(() => {
    setLocalFilters({});
    onClear();
  }, [onClear]);

  const handleApply = React.useCallback(() => {
    onApply(localFilters);
  }, [localFilters, onApply]);

  const hasActiveFilters = React.useMemo(() => {
    return (
      localFilters.race !== undefined ||
      localFilters.difficulty !== undefined ||
      localFilters.thcMin !== undefined ||
      localFilters.thcMax !== undefined ||
      localFilters.cbdMin !== undefined ||
      localFilters.cbdMax !== undefined ||
      (localFilters.effects && localFilters.effects.length > 0) ||
      (localFilters.flavors && localFilters.flavors.length > 0)
    );
  }, [localFilters]);

  return {
    localFilters,
    handleRaceToggle,
    handleDifficultyToggle,
    handleEffectToggle,
    handleFlavorToggle,
    handleThcLevelToggle,
    handleCbdLevelToggle,
    handleClear,
    handleApply,
    hasActiveFilters,
  };
}

const FilterModalContent = ({
  localFilters,
  handleRaceToggle,
  handleDifficultyToggle,
  handleThcLevelToggle,
  handleCbdLevelToggle,
  handleEffectToggle,
  handleFlavorToggle,
}: {
  localFilters: StrainFilters;
  handleRaceToggle: (race: StrainFilters['race']) => void;
  handleDifficultyToggle: (difficulty: StrainFilters['difficulty']) => void;
  handleThcLevelToggle: (level: ThcLevel) => void;
  handleCbdLevelToggle: (level: CbdLevel) => void;
  handleEffectToggle: (effect: string) => void;
  handleFlavorToggle: (flavor: string) => void;
}) => {
  const currentThcLevel = getThcLevelFromFilters(localFilters);
  const currentCbdLevel = getCbdLevelFromFilters(localFilters);

  return (
    <>
      {/* Race Section */}
      <View className="mb-6">
        <Text className="mb-3 text-base font-semibold text-neutral-900 dark:text-neutral-50">
          {translate('strains.filters.race_label')}
        </Text>
        <View className="flex-row flex-wrap gap-2">
          {RACE_OPTIONS.map((option) => (
            <Button
              key={option.value}
              label=""
              variant={
                localFilters.race === option.value ? 'default' : 'outline'
              }
              onPress={() => handleRaceToggle(option.value)}
              className="h-auto px-3 py-2"
              testID={`filter-race-${option.value}`}
            >
              <RaceBadge race={option.value!} />
            </Button>
          ))}
        </View>
      </View>

      {/* THC Level Section */}
      <View className="mb-6">
        <Text className="mb-3 text-base font-semibold text-neutral-900 dark:text-neutral-50">
          {translate('strains.filters.thc_label')}
        </Text>
        <View className="flex-row flex-wrap gap-2">
          {THC_OPTIONS.map((option) => (
            <Button
              key={option.value}
              label={translateDynamic(option.label)}
              variant={currentThcLevel === option.value ? 'default' : 'outline'}
              onPress={() => handleThcLevelToggle(option.value)}
              className="h-auto min-w-[70px] px-3 py-2"
              testID={`filter-thc-${option.value}`}
            />
          ))}
        </View>
      </View>

      {/* CBD Level Section */}
      <View className="mb-6">
        <Text className="mb-3 text-base font-semibold text-neutral-900 dark:text-neutral-50">
          {translate('strains.filters.cbd_label')}
        </Text>
        <View className="flex-row flex-wrap gap-2">
          {CBD_OPTIONS.map((option) => (
            <Button
              key={option.value}
              label={translateDynamic(option.label)}
              variant={currentCbdLevel === option.value ? 'default' : 'outline'}
              onPress={() => handleCbdLevelToggle(option.value)}
              className="h-auto min-w-[70px] px-3 py-2"
              testID={`filter-cbd-${option.value}`}
            />
          ))}
        </View>
      </View>

      {/* Difficulty Section */}
      <View className="mb-6">
        <Text className="mb-3 text-base font-semibold text-neutral-900 dark:text-neutral-50">
          {translate('strains.filters.difficulty_label')}
        </Text>
        <View className="flex-row flex-wrap gap-2">
          {DIFFICULTY_OPTIONS.map((option) => (
            <Button
              key={option.value}
              label=""
              variant={
                localFilters.difficulty === option.value ? 'default' : 'outline'
              }
              onPress={() => handleDifficultyToggle(option.value)}
              className="h-auto px-3 py-2"
              testID={`filter-difficulty-${option.value}`}
            >
              <DifficultyBadge difficulty={option.value!} />
            </Button>
          ))}
        </View>
      </View>

      {/* Effects Section */}
      <View className="mb-6">
        <Text className="mb-3 text-base font-semibold text-neutral-900 dark:text-neutral-50">
          {translate('strains.filters.effects_label')}
        </Text>
        <CheckboxList
          items={COMMON_EFFECTS}
          selected={localFilters.effects}
          onToggle={handleEffectToggle}
          labelKey="strains.effects"
          hintKey="accessibility.strains.toggle_effect_hint"
          testIdPrefix="filter-effect"
        />
      </View>

      {/* Flavors Section */}
      <View className="mb-6">
        <Text className="mb-3 text-base font-semibold text-neutral-900 dark:text-neutral-50">
          {translate('strains.filters.flavors_label')}
        </Text>
        <CheckboxList
          items={COMMON_FLAVORS}
          selected={localFilters.flavors}
          onToggle={handleFlavorToggle}
          labelKey="strains.flavors"
          hintKey="accessibility.strains.toggle_flavor_hint"
          testIdPrefix="filter-flavor"
        />
      </View>
    </>
  );
};

export const FilterModal = React.forwardRef<
  React.ElementRef<typeof Modal>,
  FilterModalProps
>(({ filters, onApply, onClear }, ref) => {
  const {
    localFilters,
    handleRaceToggle,
    handleDifficultyToggle,
    handleEffectToggle,
    handleFlavorToggle,
    handleThcLevelToggle,
    handleCbdLevelToggle,
    handleClear,
    handleApply,
    hasActiveFilters,
  } = useFilterHandlers(filters, onApply, onClear);

  return (
    <Modal
      ref={ref}
      snapPoints={['85%']}
      title={translate('strains.filters.title')}
    >
      <View className="flex-1">
        <BottomSheetScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }}
        >
          <FilterModalContent
            localFilters={localFilters}
            handleRaceToggle={handleRaceToggle}
            handleDifficultyToggle={handleDifficultyToggle}
            handleThcLevelToggle={handleThcLevelToggle}
            handleCbdLevelToggle={handleCbdLevelToggle}
            handleEffectToggle={handleEffectToggle}
            handleFlavorToggle={handleFlavorToggle}
          />
        </BottomSheetScrollView>

        {/* Footer Buttons - flex layout, not absolute */}
        <View className="border-t border-charcoal-100 bg-white p-4 dark:border-charcoal-800 dark:bg-charcoal-950">
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Button
                label={translate('strains.filters.clear_all')}
                variant="outline"
                onPress={handleClear}
                disabled={!hasActiveFilters}
                testID="filter-clear-button"
              />
            </View>
            <View className="flex-1">
              <Button
                label={translate('strains.filters.apply')}
                onPress={handleApply}
                testID="filter-apply-button"
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
});

FilterModal.displayName = 'FilterModal';
