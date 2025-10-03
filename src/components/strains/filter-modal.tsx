import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import * as React from 'react';

import type { StrainFilters } from '@/api/strains/types';
import { Button, Checkbox, Modal, Text, useModal, View } from '@/components/ui';
import { translate } from '@/lib/i18n';

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

/* eslint-disable max-lines-per-function */
const FilterModalContent = ({
  localFilters,
  handleRaceToggle,
  handleDifficultyToggle,
  handleEffectToggle,
  handleFlavorToggle,
}: {
  localFilters: StrainFilters;
  handleRaceToggle: (race: StrainFilters['race']) => void;
  handleDifficultyToggle: (difficulty: StrainFilters['difficulty']) => void;
  handleEffectToggle: (effect: string) => void;
  handleFlavorToggle: (flavor: string) => void;
}) => {
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
        <View className="gap-2">
          {COMMON_EFFECTS.map((effect) => (
            <Checkbox.Root
              key={effect}
              checked={localFilters.effects?.includes(effect) || false}
              onChange={() => handleEffectToggle(effect)}
              testID={`filter-effect-${effect}`}
              accessibilityLabel={translate(`strains.effects.${effect}` as any)}
              accessibilityHint={translate(
                'accessibility.strains.toggle_effect_hint'
              )}
            >
              <Checkbox.Icon
                checked={localFilters.effects?.includes(effect) || false}
              />
              <Checkbox.Label
                text={translate(`strains.effects.${effect}` as any)}
              />
            </Checkbox.Root>
          ))}
        </View>
      </View>

      {/* Flavors Section */}
      <View className="mb-6">
        <Text className="mb-3 text-base font-semibold text-neutral-900 dark:text-neutral-50">
          {translate('strains.filters.flavors_label')}
        </Text>
        <View className="gap-2">
          {COMMON_FLAVORS.map((flavor) => (
            <Checkbox.Root
              key={flavor}
              checked={localFilters.flavors?.includes(flavor) || false}
              onChange={() => handleFlavorToggle(flavor)}
              testID={`filter-flavor-${flavor}`}
              accessibilityLabel={translate(`strains.flavors.${flavor}` as any)}
              accessibilityHint={translate(
                'accessibility.strains.toggle_flavor_hint'
              )}
            >
              <Checkbox.Icon
                checked={localFilters.flavors?.includes(flavor) || false}
              />
              <Checkbox.Label
                text={translate(`strains.flavors.${flavor}` as any)}
              />
            </Checkbox.Root>
          ))}
        </View>
      </View>
    </>
  );
};

/* eslint-disable max-lines-per-function */
export const FilterModal = React.forwardRef<any, FilterModalProps>(
  ({ filters, onApply, onClear }, ref) => {
    const [localFilters, setLocalFilters] =
      React.useState<StrainFilters>(filters);

    React.useEffect(() => {
      setLocalFilters(filters);
    }, [filters]);

    const handleRaceToggle = React.useCallback(
      (race: StrainFilters['race']) => {
        setLocalFilters((prev) => ({
          ...prev,
          race: prev.race === race ? undefined : race,
        }));
      },
      []
    );

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
        (localFilters.effects && localFilters.effects.length > 0) ||
        (localFilters.flavors && localFilters.flavors.length > 0)
      );
    }, [localFilters]);

    return (
      <Modal
        ref={ref}
        snapPoints={['85%']}
        title={translate('strains.filters.title')}
      >
        <BottomSheetScrollView contentContainerClassName="px-4 pb-24">
          <FilterModalContent
            localFilters={localFilters}
            handleRaceToggle={handleRaceToggle}
            handleDifficultyToggle={handleDifficultyToggle}
            handleEffectToggle={handleEffectToggle}
            handleFlavorToggle={handleFlavorToggle}
          />
        </BottomSheetScrollView>

        {/* Fixed Bottom Buttons */}
        <View className="absolute inset-x-0 bottom-0 border-t border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
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
      </Modal>
    );
  }
);

FilterModal.displayName = 'FilterModal';
