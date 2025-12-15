import { zodResolver } from '@hookform/resolvers/zod';
import React from 'react';
import {
  type Control,
  Controller,
  type SubmitErrorHandler,
  type SubmitHandler,
  useController,
  useForm,
  type UseFormSetValue,
  useWatch,
} from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { z } from 'zod';

import { useStrainsInfinite } from '@/api';
import type {
  GeneticLean,
  PhotoperiodType,
  PlantEnvironment,
  PlantMetadata,
  PlantStage,
  Race,
} from '@/api/plants/types';
import type { Strain } from '@/api/strains/types';
import {
  calculateCompletion,
  CompletionProgress,
} from '@/components/plants/completion-progress';
import { FormSection } from '@/components/plants/form-section';
import {
  ActivityIndicator,
  Button,
  ControlledDatePicker,
  ControlledInput,
  Input,
  type OptionType,
  Pressable,
  Select,
  Text,
  View,
} from '@/components/ui';
import { derivePlantDefaultsFromStrain } from '@/lib/plants/derive-from-strain';
import {
  buildCustomStrain,
  saveCustomStrainToSupabase,
  saveStrainToSupabase,
} from '@/lib/strains/custom-strain-cache';
import type { PhotoVariants } from '@/types/photo-storage';

import { HeroPhotoSection } from './hero-photo-section';

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = React.useState(value);

  React.useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(handle);
  }, [value, delayMs]);

  return debounced;
}

type StrainSuggestion = Strain;

function useStrainSuggestions(query: string) {
  const trimmedQuery = query.trim();
  const debouncedQuery = useDebouncedValue(trimmedQuery, 250);
  const { data, isFetching, isLoading } = useStrainsInfinite({
    variables: {
      searchQuery: debouncedQuery,
      pageSize: 12,
    },
  });

  const suggestions = React.useMemo<StrainSuggestion[]>(() => {
    if (!data?.pages?.length) return [];
    const flattened = data.pages.flatMap((page) => page.data || []);
    return flattened.slice(0, 8);
  }, [data?.pages]);

  const hasExactMatch = React.useMemo(() => {
    const lower = trimmedQuery.toLowerCase();
    return suggestions.some((s) => s.name.toLowerCase() === lower);
  }, [suggestions, trimmedQuery]);

  return {
    suggestions,
    isFetching,
    isLoading,
    hasExactMatch,
    trimmedQuery,
  };
}

type PlantStrainFieldProps = {
  control: Control<PlantFormValues>;
  setValue: UseFormSetValue<PlantFormValues>;
  t: (key: string, options?: Record<string, string | number>) => string;
};

type StrainSuggestionsDropdownProps = {
  isFetching: boolean;
  isLoading: boolean;
  onCreateCustom: () => void;
  onSelect: (strain: StrainSuggestion) => void;
  query: string;
  showCreateCustom: boolean;
  suggestions: StrainSuggestion[];
  t: (key: string, options?: Record<string, string | number>) => string;
  visible: boolean;
};

function StrainSuggestionsDropdown({
  isFetching,
  isLoading,
  onCreateCustom,
  onSelect,
  query,
  showCreateCustom,
  suggestions,
  t,
  visible,
}: StrainSuggestionsDropdownProps) {
  if (!visible) return null;

  if (isLoading || isFetching) {
    return (
      <View className="absolute inset-x-0 top-16 z-10 mt-2 rounded-2xl border border-border bg-card shadow-lg">
        <View className="flex-row items-center gap-2 px-4 py-3">
          <ActivityIndicator size="small" />
          <Text className="text-sm text-text-secondary">
            {t('plants.form.strain_searching')}
          </Text>
        </View>
      </View>
    );
  }

  const showEmpty = suggestions.length === 0 && !showCreateCustom;

  return (
    <View className="absolute inset-x-0 top-16 z-10 mt-2 rounded-2xl border border-neutral-200 bg-white shadow-lg dark:border-neutral-800 dark:bg-neutral-900">
      {showEmpty && (
        <View className="px-4 py-3">
          <Text className="text-sm text-text-secondary">
            {t('plants.form.strain_no_results', { query })}
          </Text>
        </View>
      )}

      {suggestions.map((strain) => {
        const derived = derivePlantDefaultsFromStrain(strain);
        const isAutoflower = derived.photoperiodType === 'autoflower';

        return (
          <Pressable
            key={strain.id}
            onPress={() => onSelect(strain)}
            className="flex-row items-center justify-between px-4 py-3 active:bg-neutral-100 dark:active:bg-neutral-800"
            accessibilityRole="button"
            accessibilityLabel={strain.name}
            accessibilityHint={t('accessibility.common.select_option_hint', {
              label: strain.name,
            })}
            testID={`strain-suggestion-${strain.id}`}
          >
            <View className="flex-1">
              <Text className="text-base font-medium text-text-primary">
                {strain.name}
              </Text>
              <Text className="text-xs text-text-secondary">
                {t('plants.form.strain_race_label', { race: strain.race })}
              </Text>
            </View>
            {isAutoflower && (
              <Text className="rounded-full bg-primary-100 px-3 py-1 text-xs font-semibold text-primary-700 dark:bg-primary-900 dark:text-primary-200">
                {t('plants.form.autoflower_badge')}
              </Text>
            )}
          </Pressable>
        );
      })}

      {showCreateCustom && (
        <Pressable
          onPress={onCreateCustom}
          className="flex-row items-center justify-between border-t border-neutral-200 px-4 py-3 active:bg-neutral-100 dark:border-neutral-800 dark:active:bg-neutral-800"
          accessibilityRole="button"
          accessibilityLabel={t('plants.form.strain_create_custom', {
            name: query,
          })}
          accessibilityHint={t('accessibility.common.select_option_hint', {
            label: t('plants.form.strain_create_custom', { name: query }),
          })}
          testID="strain-suggestion-custom"
        >
          <View className="flex-1">
            <Text className="text-base font-medium text-primary-700 dark:text-primary-300">
              {t('plants.form.strain_create_custom', { name: query })}
            </Text>
            <Text className="text-xs text-neutral-500 dark:text-neutral-400">
              {t('plants.form.strain_create_custom_hint')}
            </Text>
          </View>
        </Pressable>
      )}
    </View>
  );
}

// eslint-disable-next-line max-lines-per-function
function PlantStrainField({ control, setValue, t }: PlantStrainFieldProps) {
  const { field, fieldState } = useController({
    control,
    name: 'strain',
  });
  const [inputValue, setInputValue] = React.useState(field.value ?? '');
  const [isFocused, setIsFocused] = React.useState(false);

  const { hasExactMatch, isFetching, isLoading, suggestions, trimmedQuery } =
    useStrainSuggestions(inputValue);

  React.useEffect(() => {
    if (field.value && field.value !== inputValue) {
      setInputValue(field.value);
    }
  }, [field.value, inputValue]);

  const clearStrainMetadata = React.useCallback(() => {
    setValue('strainId', undefined, { shouldDirty: true });
    setValue('strainSlug', undefined, { shouldDirty: true });
    setValue('strainSource', undefined, { shouldDirty: true });
    setValue('strainRace', undefined, { shouldDirty: true });
  }, [setValue]);

  const applyDerived = React.useCallback(
    (strain: StrainSuggestion, source: 'api' | 'custom') => {
      const derived = derivePlantDefaultsFromStrain(strain, { source });

      setValue('strainId', derived.meta.strainId, { shouldDirty: true });
      setValue('strainSlug', derived.meta.strainSlug, { shouldDirty: true });
      setValue('strainSource', derived.meta.strainSource, {
        shouldDirty: true,
      });
      setValue('strainRace', derived.meta.strainRace, { shouldDirty: true });

      const photoperiodValue =
        derived.photoperiodType ??
        (source === 'custom' ? 'photoperiod' : undefined);
      if (photoperiodValue) {
        setValue('photoperiodType', photoperiodValue, { shouldDirty: true });
      }

      const geneticValue =
        derived.geneticLean ?? (source === 'custom' ? 'balanced' : undefined);
      if (geneticValue) {
        setValue('geneticLean', geneticValue, { shouldDirty: true });
      }

      if (derived.environment) {
        setValue('environment', derived.environment, { shouldDirty: true });
      }
    },
    [setValue]
  );

  const handleSelect = React.useCallback(
    (strain: StrainSuggestion) => {
      field.onChange(strain.name);
      setInputValue(strain.name);
      applyDerived(strain, 'api');
      void saveStrainToSupabase(strain);
      setIsFocused(false);
    },
    [applyDerived, field]
  );

  const handleCreateCustom = React.useCallback(() => {
    const name = trimmedQuery || inputValue;
    if (!name) return;

    const customStrain = buildCustomStrain(name);
    field.onChange(customStrain.name);
    setInputValue(customStrain.name);
    applyDerived(customStrain, 'custom');
    void saveCustomStrainToSupabase(customStrain);
    setIsFocused(false);
  }, [applyDerived, field, inputValue, trimmedQuery]);

  const showCreateCustom =
    trimmedQuery.length > 0 && !hasExactMatch && !isLoading && !isFetching;
  const showDropdown =
    isFocused &&
    (trimmedQuery.length > 0 || suggestions.length > 0 || showCreateCustom);

  return (
    <View className="relative">
      <Input
        value={inputValue}
        onChangeText={(text) => {
          setInputValue(text);
          field.onChange(text);
          clearStrainMetadata();
        }}
        onFocus={() => setIsFocused(true)}
        onBlur={() => {
          // keep dropdown visible during tap; it closes after selection
        }}
        placeholder={t('plants.form.strain_placeholder')}
        label={t('plants.form.strain_label')}
        testID="plant-strain-input"
        error={fieldState.error?.message}
      />

      <StrainSuggestionsDropdown
        isFetching={isFetching}
        isLoading={isLoading}
        onCreateCustom={handleCreateCustom}
        onSelect={handleSelect}
        query={inputValue || trimmedQuery}
        showCreateCustom={showCreateCustom}
        suggestions={suggestions}
        t={t}
        visible={showDropdown}
      />
    </View>
  );
}

const STAGE_OPTIONS: { value: PlantStage; i18nKey: string }[] = [
  { value: 'seedling', i18nKey: 'plants.form.stage.seedling' },
  { value: 'vegetative', i18nKey: 'plants.form.stage.vegetative' },
  { value: 'flowering', i18nKey: 'plants.form.stage.flowering' },
  { value: 'harvesting', i18nKey: 'plants.form.stage.harvesting' },
  { value: 'curing', i18nKey: 'plants.form.stage.curing' },
  { value: 'ready', i18nKey: 'plants.form.stage.ready' },
];

const PHOTOPERIOD_OPTIONS: { value: PhotoperiodType; i18nKey: string }[] = [
  { value: 'photoperiod', i18nKey: 'plants.form.photoperiod.photoperiod' },
  { value: 'autoflower', i18nKey: 'plants.form.photoperiod.autoflower' },
];

const ENVIRONMENT_OPTIONS: { value: PlantEnvironment; i18nKey: string }[] = [
  { value: 'indoor', i18nKey: 'plants.form.environment.indoor' },
  { value: 'outdoor', i18nKey: 'plants.form.environment.outdoor' },
  { value: 'greenhouse', i18nKey: 'plants.form.environment.greenhouse' },
];

const GENETIC_OPTIONS: { value: GeneticLean; i18nKey: string }[] = [
  { value: 'indica_dominant', i18nKey: 'plants.form.genetic.indica' },
  { value: 'sativa_dominant', i18nKey: 'plants.form.genetic.sativa' },
  { value: 'balanced', i18nKey: 'plants.form.genetic.balanced' },
  { value: 'unknown', i18nKey: 'plants.form.genetic.unknown' },
];

const MEDIUM_OPTIONS: {
  value: NonNullable<PlantMetadata['medium']>;
  i18nKey: string;
}[] = [
  { value: 'soil', i18nKey: 'plants.form.medium.soil' },
  { value: 'coco', i18nKey: 'plants.form.medium.coco' },
  { value: 'hydro', i18nKey: 'plants.form.medium.hydro' },
  { value: 'living_soil', i18nKey: 'plants.form.medium.living_soil' },
  { value: 'other', i18nKey: 'plants.form.medium.other' },
];

export type PlantFormValues = {
  name: string;
  strain?: string;
  strainId?: string;
  strainSlug?: string;
  strainSource?: 'api' | 'custom';
  strainRace?: Race;
  stage?: PlantStage;
  photoperiodType?: PhotoperiodType;
  environment?: PlantEnvironment;
  geneticLean?: GeneticLean;
  plantedAt?: string;
  medium?: PlantMetadata['medium'];
  potSize?: string;
  lightSchedule?: string;
  lightHours?: number;
  notes?: string;
  imageUrl?: string;
};

type PlantFormProps = {
  defaultValues?: Partial<PlantFormValues>;
  onSubmit: SubmitHandler<PlantFormValues>;
  onError?: SubmitErrorHandler<PlantFormValues>;
  isSubmitting?: boolean;
  /** Callback to receive the form submit handler (for header button) */
  onSubmitReady?: (submit: () => void) => void;
  onDelete?: () => void;
};

type SelectFieldProps = {
  control: Control<PlantFormValues>;
  name: keyof PlantFormValues;
  label: string;
  placeholder: string;
  options: OptionType[];
  testID: string;
};

function toOptions(
  items: { value: string; i18nKey: string }[],
  t: (key: string) => string
): OptionType[] {
  return items.map((item) => ({
    value: item.value,
    label: t(item.i18nKey),
  }));
}

function SelectField({
  control,
  name,
  label,
  placeholder,
  options,
  testID,
}: SelectFieldProps) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { value, onChange } }) => (
        <Select
          label={label}
          value={value as string | number | undefined}
          onSelect={(val) => onChange(val)}
          options={options}
          placeholder={placeholder}
          testID={testID}
        />
      )}
    />
  );
}

function IdentitySection({
  control,
  stageOptions,
  geneticOptions,
  setValue,
  t,
}: {
  control: Control<PlantFormValues>;
  stageOptions: OptionType[];
  geneticOptions: OptionType[];
  setValue: UseFormSetValue<PlantFormValues>;
  t: (key: string) => string;
}) {
  return (
    <FormSection
      icon="🌱"
      title={t('plants.form.section.identity')}
      delay={100}
      testID="identity-section"
    >
      <View className="gap-3 bg-white p-4 dark:bg-neutral-900">
        <ControlledInput
          control={control}
          name="name"
          placeholder={t('plants.form.name_placeholder')}
          label={t('plants.form.name_label')}
          testID="plant-name-input"
        />
        <PlantStrainField control={control} setValue={setValue} t={t} />
        <SelectField
          control={control}
          name="stage"
          label={t('plants.form.stage_label')}
          placeholder={t('plants.form.stage_placeholder')}
          options={stageOptions}
          testID="plant-stage-select"
        />
        <SelectField
          control={control}
          name="geneticLean"
          label={t('plants.form.genetic_label')}
          placeholder={t('plants.form.genetic_placeholder')}
          options={geneticOptions}
          testID="plant-genetic-select"
        />
      </View>
    </FormSection>
  );
}

function EnvironmentSection({
  control,
  environmentOptions,
  photoperiodOptions,
  t,
}: {
  control: Control<PlantFormValues>;
  environmentOptions: OptionType[];
  photoperiodOptions: OptionType[];
  t: (key: string) => string;
}) {
  return (
    <FormSection
      icon="☀️"
      title={t('plants.form.section.environment')}
      delay={200}
      testID="environment-section"
    >
      <View className="gap-3 bg-white p-4 dark:bg-neutral-900">
        <SelectField
          control={control}
          name="environment"
          label={t('plants.form.environment_label')}
          placeholder={t('plants.form.environment_placeholder')}
          options={environmentOptions}
          testID="plant-environment-select"
        />
        <SelectField
          control={control}
          name="photoperiodType"
          label={t('plants.form.photoperiod_label')}
          placeholder={t('plants.form.photoperiod_placeholder')}
          options={photoperiodOptions}
          testID="plant-photoperiod-select"
        />
        <ControlledDatePicker
          control={control}
          name="plantedAt"
          placeholder={t('plants.form.planted_at_placeholder')}
          label={t('plants.form.planted_at_label')}
          testID="plant-plantedAt-picker"
          maximumDate={new Date()}
        />
      </View>
    </FormSection>
  );
}

function CareSection({
  control,
  mediumOptions,
  t,
}: {
  control: Control<PlantFormValues>;
  mediumOptions: OptionType[];
  t: (key: string) => string;
}) {
  return (
    <FormSection
      icon="💧"
      title={t('plants.form.section.care')}
      delay={300}
      testID="care-section"
    >
      <View className="gap-3 bg-white p-4 dark:bg-neutral-900">
        <SelectField
          control={control}
          name="medium"
          label={t('plants.form.medium_label')}
          placeholder={t('plants.form.medium_placeholder')}
          options={mediumOptions}
          testID="plant-medium-select"
        />
        <ControlledInput
          control={control}
          name="potSize"
          placeholder={t('plants.form.pot_size_placeholder')}
          label={t('plants.form.pot_size_label')}
          testID="plant-potSize-input"
        />
        <ControlledInput
          control={control}
          name="lightSchedule"
          placeholder={t('plants.form.light_schedule_placeholder')}
          label={t('plants.form.light_schedule_label')}
          testID="plant-lightSchedule-input"
        />
        <ControlledInput
          control={control}
          name="lightHours"
          placeholder={t('plants.form.light_hours_placeholder')}
          label={t('plants.form.light_hours_label')}
          keyboardType="numeric"
          testID="plant-lightHours-input"
        />
        <ControlledInput
          control={control}
          name="notes"
          placeholder={t('plants.form.notes_placeholder')}
          label={t('plants.form.notes_label')}
          multiline
          numberOfLines={3}
          testID="plant-notes-input"
        />
      </View>
    </FormSection>
  );
}

function buildSchema(t: (key: string) => string) {
  return z.object({
    name: z
      .string()
      .trim()
      .min(1, t('plants.form.errors.name_required'))
      .max(120, t('plants.form.errors.name_length')),
    strain: z
      .string()
      .trim()
      .min(1, t('plants.form.errors.strain_required'))
      .max(120, t('plants.form.errors.strain_length')),
    strainId: z.string().trim().max(200).optional(),
    strainSlug: z.string().trim().max(200).optional(),
    strainSource: z.enum(['api', 'custom']).optional(),
    strainRace: z.enum(['indica', 'sativa', 'hybrid']).optional(),
    stage: z
      .enum(STAGE_OPTIONS.map((s) => s.value) as [PlantStage, ...PlantStage[]])
      .optional(),
    photoperiodType: z
      .enum(
        PHOTOPERIOD_OPTIONS.map((s) => s.value) as [
          PhotoperiodType,
          ...PhotoperiodType[],
        ]
      )
      .optional(),
    environment: z
      .enum(
        ENVIRONMENT_OPTIONS.map((s) => s.value) as [
          PlantEnvironment,
          ...PlantEnvironment[],
        ]
      )
      .optional(),
    geneticLean: z
      .enum(
        GENETIC_OPTIONS.map((s) => s.value) as [GeneticLean, ...GeneticLean[]]
      )
      .optional(),
    plantedAt: z.string().trim().max(50).optional(),
    medium: z
      .enum(
        MEDIUM_OPTIONS.map((s) => s.value) as [
          NonNullable<PlantMetadata['medium']>,
          ...NonNullable<PlantMetadata['medium']>[],
        ]
      )
      .optional(),
    potSize: z.string().trim().max(50).optional(),
    lightSchedule: z.string().trim().max(50).optional(),
    lightHours: z
      .string()
      .optional()
      .transform((value) => (value ? Number(value) : undefined))
      .refine(
        (value) =>
          value === undefined ||
          (!Number.isNaN(value) && value >= 0 && value <= 24),
        { message: t('plants.form.errors.light_hours') }
      ),
    notes: z.string().max(500).optional(),
    imageUrl: z.string().optional(),
  });
}

function usePlantFormController({
  defaultValues,
  t,
  onSubmit,
  onError,
}: {
  defaultValues?: Partial<PlantFormValues>;
  t: (key: string) => string;
  onSubmit: SubmitHandler<PlantFormValues>;
  onError?: SubmitErrorHandler<PlantFormValues>;
}) {
  const schema = React.useMemo(() => buildSchema(t), [t]);
  const {
    control,
    handleSubmit,
    setValue,
    formState: { isSubmitting },
  } = useForm<PlantFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      photoperiodType: 'photoperiod',
      environment: 'indoor',
      ...defaultValues,
    },
  });

  // Watch all values for progress calculation
  const watchedValues = useWatch({ control });

  const completion = React.useMemo(
    () => calculateCompletion(watchedValues as Record<string, unknown>),
    [watchedValues]
  );

  const onPhotoCaptured = React.useCallback(
    (photo: PhotoVariants) => {
      setValue('imageUrl', photo.resized || photo.original, {
        shouldDirty: true,
      });
    },
    [setValue]
  );

  const handleFormSubmit = React.useCallback(
    () => handleSubmit(onSubmit, onError)(),
    [handleSubmit, onError, onSubmit]
  );

  return {
    control,
    imageUrl: watchedValues.imageUrl,
    onPhotoCaptured,
    isSubmitting,
    handleFormSubmit,
    completion,
    setValue,
  };
}

export function PlantForm({
  defaultValues,
  onSubmit,
  onError,
  isSubmitting,
  onSubmitReady,
  onDelete,
}: PlantFormProps): React.ReactElement {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const {
    control,
    imageUrl,
    onPhotoCaptured,
    isSubmitting: formSubmitting,
    handleFormSubmit,
    completion,
    setValue,
  } = usePlantFormController({ defaultValues, t, onSubmit, onError });

  // Expose submit handler to parent via callback (for header button)
  React.useEffect(() => {
    onSubmitReady?.(handleFormSubmit);
  }, [onSubmitReady, handleFormSubmit]);

  const stageOptions = React.useMemo(() => toOptions(STAGE_OPTIONS, t), [t]);
  const photoperiodOptions = React.useMemo(
    () => toOptions(PHOTOPERIOD_OPTIONS, t),
    [t]
  );
  const environmentOptions = React.useMemo(
    () => toOptions(ENVIRONMENT_OPTIONS, t),
    [t]
  );
  const geneticOptions = React.useMemo(
    () => toOptions(GENETIC_OPTIONS, t),
    [t]
  );
  const mediumOptions = React.useMemo(() => toOptions(MEDIUM_OPTIONS, t), [t]);

  // Calculate content padding: top for safe area, bottom for tab bar
  const scrollContentStyle = React.useMemo(
    () => ({
      paddingTop: insets.top + 8,
      paddingBottom: Math.max(insets.bottom + 56, 80),
    }),
    [insets.top, insets.bottom]
  );

  const isDisabled = isSubmitting || formSubmitting;

  return (
    <View className="flex-1 bg-neutral-50 dark:bg-charcoal-950">
      <ScrollView
        className="flex-1"
        contentContainerStyle={scrollContentStyle}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Photo Section */}
        <HeroPhotoSection
          imageUrl={imageUrl}
          onPhotoCaptured={onPhotoCaptured}
          disabled={isDisabled}
        />

        {/* Completion Progress */}
        <CompletionProgress
          progress={completion}
          label={t('plants.form.completion', { percent: completion })}
        />

        {/* Form Sections */}
        <View className="gap-6 px-4">
          <IdentitySection
            control={control}
            stageOptions={stageOptions}
            geneticOptions={geneticOptions}
            setValue={setValue}
            t={t}
          />
          <EnvironmentSection
            control={control}
            environmentOptions={environmentOptions}
            photoperiodOptions={photoperiodOptions}
            t={t}
          />
          <CareSection control={control} mediumOptions={mediumOptions} t={t} />

          {onDelete ? (
            <View className="mt-8 px-4 pb-8">
              <Button
                variant="destructive"
                onPress={onDelete}
                label={t('plants.form.delete_button')}
                className="rounded-xl bg-red-50 dark:bg-red-950/30"
                textClassName="text-red-600 dark:text-red-400"
                accessibilityHint={t('plants.form.delete_confirm_body')}
                testID="delete-plant-button"
              />
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}
