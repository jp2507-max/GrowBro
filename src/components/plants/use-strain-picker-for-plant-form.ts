import { useCallback } from 'react';
import type { UseFormSetValue } from 'react-hook-form';

import type { Strain } from '@/api/strains/types';
import { derivePlantDefaultsFromStrain } from '@/lib/plants/derive-from-strain';

import type { PlantFormValues } from './plant-form';

type UseStrainPickerForPlantFormOptions = {
  setValue: UseFormSetValue<PlantFormValues>;
};

type UseStrainPickerForPlantFormResult = {
  /** Handler for StrainPicker's onSelectFull callback */
  handleStrainSelect: (
    strain: Strain | undefined,
    source?: 'api' | 'custom'
  ) => void;
};

/**
 * Adapter hook for using StrainPicker in the plant form.
 * Handles strain selection, metadata assignment, and derived value application.
 */
export function useStrainPickerForPlantForm({
  setValue,
}: UseStrainPickerForPlantFormOptions): UseStrainPickerForPlantFormResult {
  const clearStrainMetadata = useCallback(() => {
    setValue('strain', undefined, { shouldDirty: true });
    setValue('strainId', undefined, { shouldDirty: true });
    setValue('strainSlug', undefined, { shouldDirty: true });
    setValue('strainSource', undefined, { shouldDirty: true });
    setValue('strainRace', undefined, { shouldDirty: true });
  }, [setValue]);

  const applyDerivedValues = useCallback(
    (strain: Strain, source: 'api' | 'custom') => {
      const derived = derivePlantDefaultsFromStrain(strain, { source });

      // Set strain name and metadata
      setValue('strain', strain.name, { shouldDirty: true });
      setValue('strainId', derived.meta.strainId, { shouldDirty: true });
      setValue('strainSlug', derived.meta.strainSlug, { shouldDirty: true });
      setValue('strainSource', derived.meta.strainSource, {
        shouldDirty: true,
      });
      setValue('strainRace', derived.meta.strainRace, { shouldDirty: true });

      // Apply derived photoperiod type (or default for custom strains)
      const photoperiodValue =
        derived.photoperiodType ??
        (source === 'custom' ? 'photoperiod' : undefined);
      if (photoperiodValue) {
        setValue('photoperiodType', photoperiodValue, { shouldDirty: true });
      }

      // Apply derived genetic lean (or default for custom strains)
      const geneticValue =
        derived.geneticLean ?? (source === 'custom' ? 'balanced' : undefined);
      if (geneticValue) {
        setValue('geneticLean', geneticValue, { shouldDirty: true });
      }

      // Apply derived environment if available
      if (derived.environment) {
        setValue('environment', derived.environment, { shouldDirty: true });
      }
    },
    [setValue]
  );

  const handleStrainSelect = useCallback(
    (strain: Strain | undefined, source?: 'api' | 'custom') => {
      if (strain) {
        applyDerivedValues(strain, source ?? 'api');
      } else {
        clearStrainMetadata();
      }
    },
    [applyDerivedValues, clearStrainMetadata]
  );

  return { handleStrainSelect };
}
