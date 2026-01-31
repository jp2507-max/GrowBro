import { zodResolver } from '@hookform/resolvers/zod';
import React from 'react';
import {
  type Control,
  Controller,
  type SubmitErrorHandler,
  type SubmitHandler,
  useForm,
  type UseFormSetValue,
  useWatch,
} from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { z } from 'zod';

import type {
  GeneticLean,
  GrowSpaceSize,
  PhotoperiodType,
  PlantEnvironment,
  PlantMetadata,
  PlantStage,
  PlantStartType,
  Race,
  TrainingPreference,
} from '@/api/plants/types';
import { StrainPicker } from '@/components/community/strain-picker';
import {
  calculateCompletion,
  CompletionProgress,
} from '@/components/plants/completion-progress';
import { FormSection } from '@/components/plants/form-section';
import {
  Checkbox,
  ControlledDatePicker,
  ControlledInput,
  type OptionType,
  Pressable,
  Select,
  Switch,
  Text,
  View,
} from '@/components/ui';
import type { PlantPhotoStoreResult } from '@/lib/media/plant-photo-storage';

import { HeroPhotoSection } from './hero-photo-section';
import { useStrainPickerForPlantForm } from './use-strain-picker-for-plant-form';

const STAGE_OPTIONS: { value: PlantStage; i18nKey: string; icon: string }[] = [
  {
    value: 'germination',
    i18nKey: 'plants.lifecycle.stage.germination',
    icon: '🌰',
  },
  {
    value: 'seedling',
    i18nKey: 'plants.lifecycle.stage.seedling',
    icon: '🌱',
  },
  {
    value: 'vegetative',
    i18nKey: 'plants.lifecycle.stage.vegetative',
    icon: '🌿',
  },
  {
    value: 'flowering',
    i18nKey: 'plants.lifecycle.stage.flowering',
    icon: '🌸',
  },
  {
    value: 'harvesting',
    i18nKey: 'plants.lifecycle.stage.drying',
    icon: '✂️',
  },
  { value: 'curing', i18nKey: 'plants.lifecycle.stage.curing', icon: '🫙' },
  { value: 'ready', i18nKey: 'plants.lifecycle.stage.completed', icon: '✅' },
];

const START_TYPE_OPTIONS: {
  value: PlantStartType;
  i18nKey: string;
  icon: string;
}[] = [
  { value: 'seed', i18nKey: 'plants.form.start_type.seed', icon: '🌰' },
  { value: 'clone', i18nKey: 'plants.form.start_type.clone', icon: '🧬' },
];

const PHOTOPERIOD_OPTIONS: {
  value: PhotoperiodType;
  i18nKey: string;
  icon: string;
}[] = [
  {
    value: 'photoperiod',
    i18nKey: 'plants.form.genetics.photoperiod',
    icon: '☀️',
  },
  {
    value: 'autoflower',
    i18nKey: 'plants.form.genetics.autoflower',
    icon: '⏱️',
  },
];

const ENVIRONMENT_OPTIONS_BASE: {
  value: PlantEnvironment;
  i18nKey: string;
  icon: string;
}[] = [
  { value: 'indoor', i18nKey: 'plants.form.environment.indoor', icon: '🏠' },
  { value: 'outdoor', i18nKey: 'plants.form.environment.outdoor', icon: '🌳' },
];

const ENVIRONMENT_OPTIONS_ADVANCED: {
  value: PlantEnvironment;
  i18nKey: string;
  icon: string;
}[] = [
  ...ENVIRONMENT_OPTIONS_BASE,
  {
    value: 'greenhouse',
    i18nKey: 'plants.form.environment.greenhouse',
    icon: '🏡',
  },
];

const GENETIC_OPTIONS: {
  value: GeneticLean;
  i18nKey: string;
  icon: string;
}[] = [
  {
    value: 'indica_dominant',
    i18nKey: 'plants.form.genetic.indica',
    icon: '🟣',
  },
  {
    value: 'sativa_dominant',
    i18nKey: 'plants.form.genetic.sativa',
    icon: '🟢',
  },
  { value: 'balanced', i18nKey: 'plants.form.genetic.balanced', icon: '⚖️' },
  { value: 'unknown', i18nKey: 'plants.form.genetic.unknown', icon: '❓' },
];

const MEDIUM_OPTIONS_BASE: {
  value: NonNullable<PlantMetadata['medium']>;
  i18nKey: string;
  icon: string;
}[] = [
  { value: 'soil', i18nKey: 'plants.form.medium.soil', icon: '🪴' },
  { value: 'coco', i18nKey: 'plants.form.medium.coco', icon: '🥥' },
  { value: 'hydro', i18nKey: 'plants.form.medium.hydro', icon: '💧' },
];

const MEDIUM_OPTIONS_ADVANCED: {
  value: NonNullable<PlantMetadata['medium']>;
  i18nKey: string;
  icon: string;
}[] = [
  ...MEDIUM_OPTIONS_BASE,
  {
    value: 'living_soil',
    i18nKey: 'plants.form.medium.living_soil',
    icon: '🐛',
  },
  { value: 'other', i18nKey: 'plants.form.medium.other', icon: '📦' },
];

const SPACE_SIZE_OPTIONS: {
  value: GrowSpaceSize;
  i18nKey: string;
  icon: string;
}[] = [
  { value: 'small', i18nKey: 'plants.form.space_size.small', icon: '📏' },
  { value: 'medium', i18nKey: 'plants.form.space_size.medium', icon: '📐' },
  { value: 'large', i18nKey: 'plants.form.space_size.large', icon: '🏠' },
];

const TRAINING_PREF_OPTIONS: {
  value: TrainingPreference;
  i18nKey: string;
}[] = [
  { value: 'lst', i18nKey: 'plants.form.training_prefs.lst' },
  { value: 'topping', i18nKey: 'plants.form.training_prefs.topping' },
  { value: 'scrog', i18nKey: 'plants.form.training_prefs.scrog' },
  { value: 'defoliation', i18nKey: 'plants.form.training_prefs.defoliation' },
];

export type PlantFormValues = {
  name: string;
  strain?: string;
  strainId?: string;
  strainSlug?: string;
  strainSource?: 'api' | 'custom';
  strainRace?: Race;
  stage?: PlantStage;
  startType?: PlantStartType;
  photoperiodType?: PhotoperiodType;
  environment?: PlantEnvironment;
  geneticLean?: GeneticLean;
  plantedAt?: string;
  medium?: PlantMetadata['medium'];
  potSize?: string;
  spaceSize?: GrowSpaceSize;
  advancedMode?: boolean;
  trainingPrefs?: TrainingPreference[];
  lightSchedule?: string;
  lightHours?: number;
  height?: number;
  notes?: string;
  imageUrl?: string;
};

/** Info for parent components to render HeroPhotoSection when using renderAsFragment */
export type PlantPhotoInfo = {
  imageUrl?: string;
  onPhotoCaptured: (photo: PlantPhotoStoreResult) => void;
};

type PlantFormProps = {
  defaultValues?: Partial<PlantFormValues>;
  onSubmit: SubmitHandler<PlantFormValues>;
  onError?: SubmitErrorHandler<PlantFormValues>;
  isSubmitting?: boolean;
  /** Callback to receive the form submit handler (for header button) */
  onSubmitReady?: (submit: () => void) => void;
  /** Callback to report form completion progress (0-100) */
  onProgressChange?: (progress: number) => void;
  onDelete?: () => void;
  /**
   * When true, renders form sections without the outer ScrollView wrapper.
   * Use when embedding PlantForm inside an existing scroll container.
   * Parent must render HeroPhotoSection using info from onPhotoInfo callback.
   */
  renderAsFragment?: boolean;
  /**
   * Called with photo info (imageUrl, onPhotoCaptured) for parent to render
   * HeroPhotoSection when using renderAsFragment mode.
   */
  onPhotoInfo?: (info: PlantPhotoInfo) => void;
  /** Plant ID for auto-saving photo changes (only for existing plants) */
  plantId?: string;
};

type SelectFieldProps = {
  control: Control<PlantFormValues>;
  name: keyof PlantFormValues;
  label: string;
  placeholder: string;
  options: OptionType[];
  testID: string;
  chunky?: boolean;
};

function toOptions(
  items: { value: string; i18nKey: string; icon?: string }[],
  t: (key: string) => string
): OptionType[] {
  return items.map((item) => ({
    value: item.value,
    label: t(item.i18nKey),
    icon: item.icon,
  }));
}

function SelectField({
  control,
  name,
  label,
  placeholder,
  options,
  testID,
  chunky,
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
          chunky={chunky}
        />
      )}
    />
  );
}

function IdentitySection({
  control,
  startTypeOptions,
  setValue,
  strainValue,
  t,
}: {
  control: Control<PlantFormValues>;
  startTypeOptions: OptionType[];
  setValue: UseFormSetValue<PlantFormValues>;
  strainValue?: string;
  t: (key: string) => string;
}) {
  const { handleStrainSelect } = useStrainPickerForPlantForm({ setValue });

  return (
    <FormSection
      icon="🌱"
      title={t('plants.form.section.identity')}
      delay={100}
      testID="identity-section"
    >
      <View className="gap-3 rounded-2xl bg-white p-4 dark:bg-charcoal-900">
        <ControlledInput
          control={control}
          name="name"
          placeholder={t('plants.form.name_placeholder')}
          label={t('plants.form.name_label')}
          testID="plant-name-input"
          chunky
        />
        <StrainPicker
          value={strainValue}
          onSelectFull={handleStrainSelect}
          enableCustomStrain
          label={t('plants.form.strain_label')}
          placeholder={t('plants.form.strain_placeholder')}
          testID="plant-strain-picker"
        />
        <SelectField
          control={control}
          name="startType"
          label={t('plants.form.start_type_label')}
          placeholder={t('plants.form.start_type_placeholder')}
          options={startTypeOptions}
          testID="plant-startType-select"
          chunky
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
      <View className="gap-3 rounded-2xl bg-white p-4 dark:bg-charcoal-900">
        <SelectField
          control={control}
          name="environment"
          label={t('plants.form.environment_label')}
          placeholder={t('plants.form.environment_placeholder')}
          options={environmentOptions}
          testID="plant-environment-select"
          chunky
        />
        <SelectField
          control={control}
          name="photoperiodType"
          label={t('plants.form.genetics_label')}
          placeholder={t('plants.form.genetics_placeholder')}
          options={photoperiodOptions}
          testID="plant-photoperiod-select"
          chunky
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
      <View className="gap-3 rounded-2xl bg-white p-4 dark:bg-charcoal-900">
        <SelectField
          control={control}
          name="medium"
          label={t('plants.form.medium_label')}
          placeholder={t('plants.form.medium_placeholder')}
          options={mediumOptions}
          testID="plant-medium-select"
          chunky
        />
        <ControlledInput
          control={control}
          name="potSize"
          placeholder={t('plants.form.pot_size_placeholder')}
          label={t('plants.form.pot_size_label')}
          testID="plant-potSize-input"
          chunky
        />
      </View>
    </FormSection>
  );
}

function AdvancedSection({
  control,
  stageOptions,
  geneticOptions,
  spaceSizeOptions,
  setValue,
  t,
}: {
  control: Control<PlantFormValues>;
  stageOptions: OptionType[];
  geneticOptions: OptionType[];
  spaceSizeOptions: OptionType[];
  setValue: UseFormSetValue<PlantFormValues>;
  t: (key: string) => string;
}) {
  const advancedMode = useWatch({ control, name: 'advancedMode' }) ?? false;
  const trainingPrefs = useWatch({ control, name: 'trainingPrefs' }) ?? [];

  const toggleTrainingPref = React.useCallback(
    (pref: TrainingPreference) => {
      const updated = trainingPrefs.includes(pref)
        ? trainingPrefs.filter((item) => item !== pref)
        : [...trainingPrefs, pref];

      setValue('trainingPrefs', updated, { shouldDirty: true });
    },
    [setValue, trainingPrefs]
  );

  return (
    <FormSection
      icon="🧪"
      title={t('plants.form.section.advanced')}
      delay={400}
      testID="advanced-section"
    >
      <View className="gap-3 rounded-2xl bg-white p-4 dark:bg-charcoal-900">
        <View className="flex-row items-center justify-between">
          <View className="flex-1 pr-3">
            <Text className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
              {t('plants.form.advanced_mode_label')}
            </Text>
            <Text className="text-xs text-neutral-500 dark:text-neutral-400">
              {t('plants.form.advanced_mode_hint')}
            </Text>
          </View>
          <Controller
            control={control}
            name="advancedMode"
            render={({ field: { value, onChange } }) => (
              <Switch
                value={Boolean(value)}
                onValueChange={(val) => onChange(val)}
                testID="plant-advanced-mode-switch"
              />
            )}
          />
        </View>

        {advancedMode ? (
          <View className="gap-3">
            <SelectField
              control={control}
              name="stage"
              label={t('plants.form.stage_label')}
              placeholder={t('plants.form.stage_placeholder')}
              options={stageOptions}
              testID="plant-stage-select"
              chunky
            />
            <SelectField
              control={control}
              name="geneticLean"
              label={t('plants.form.genetic_label')}
              placeholder={t('plants.form.genetic_placeholder')}
              options={geneticOptions}
              testID="plant-genetic-select"
              chunky
            />
            <SelectField
              control={control}
              name="spaceSize"
              label={t('plants.form.space_size_label')}
              placeholder={t('plants.form.space_size_placeholder')}
              options={spaceSizeOptions}
              testID="plant-spaceSize-select"
              chunky
            />
            <ControlledInput
              control={control}
              name="height"
              placeholder={t('plants.form.height_placeholder')}
              label={t('plants.form.height_label')}
              keyboardType="numeric"
              // Expected in cm, stored as unitless number
              testID="plant-height-input"
              chunky
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
              chunky
            />
            <View className="gap-2">
              <Text className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                {t('plants.form.training_prefs_label')}
              </Text>
              <Text className="text-xs text-neutral-500 dark:text-neutral-400">
                {t('plants.form.training_prefs_hint')}
              </Text>
              <View className="gap-2">
                {TRAINING_PREF_OPTIONS.map((pref) => (
                  <Checkbox
                    key={pref.value}
                    checked={trainingPrefs.includes(pref.value)}
                    onChange={() => toggleTrainingPref(pref.value)}
                    label={t(pref.i18nKey)}
                    testID={`training-pref-${pref.value}`}
                    accessibilityLabel={t(pref.i18nKey)}
                  />
                ))}
              </View>
            </View>
          </View>
        ) : null}
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
      .max(120, t('plants.form.errors.strain_length'))
      .optional(),
    strainId: z.string().trim().max(200).optional(),
    strainSlug: z.string().trim().max(200).optional(),
    strainSource: z.enum(['api', 'custom']).optional(),
    strainRace: z.enum(['indica', 'sativa', 'hybrid']).optional(),
    stage: z
      .enum(STAGE_OPTIONS.map((s) => s.value) as [PlantStage, ...PlantStage[]])
      .optional(),
    startType: z.enum(
      START_TYPE_OPTIONS.map((s) => s.value) as [
        PlantStartType,
        ...PlantStartType[],
      ]
    ),
    photoperiodType: z.enum(
      PHOTOPERIOD_OPTIONS.map((s) => s.value) as [
        PhotoperiodType,
        ...PhotoperiodType[],
      ]
    ),
    environment: z.enum(
      ENVIRONMENT_OPTIONS_ADVANCED.map((s) => s.value) as [
        PlantEnvironment,
        ...PlantEnvironment[],
      ]
    ),
    geneticLean: z
      .enum(
        GENETIC_OPTIONS.map((s) => s.value) as [GeneticLean, ...GeneticLean[]]
      )
      .optional(),
    plantedAt: z.string().trim().max(50).optional(),
    medium: z.enum(
      MEDIUM_OPTIONS_ADVANCED.map((s) => s.value) as [
        NonNullable<PlantMetadata['medium']>,
        ...NonNullable<PlantMetadata['medium']>[],
      ]
    ),
    potSize: z.string().trim().max(50).optional(),
    spaceSize: z
      .enum(
        SPACE_SIZE_OPTIONS.map((s) => s.value) as [
          GrowSpaceSize,
          ...GrowSpaceSize[],
        ]
      )
      .optional(),
    advancedMode: z.boolean().optional(),
    trainingPrefs: z
      .array(
        z.enum(
          TRAINING_PREF_OPTIONS.map((s) => s.value) as [
            TrainingPreference,
            ...TrainingPreference[],
          ]
        )
      )
      .optional(),
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
    height: z.preprocess(
      (val) => (val === '' || val == null ? undefined : String(val)),
      z
        .string()
        .optional()
        .transform((value) => (value ? Number(value) : undefined))
        // Allow 0 for seedlings; otherwise expect positive number (cm)
        .refine(
          (value) =>
            value === undefined || (!Number.isNaN(value) && value >= 0),
          {
            message: t('plants.form.errors.height_invalid'),
          }
        )
    ),
    notes: z.string().max(500).optional(),
    imageUrl: z.string().optional(),
  });
}

type UsePlantFormControllerResult = {
  control: Control<PlantFormValues>;
  imageUrl: string | undefined;
  strainValue: string | undefined;
  onPhotoCaptured: (photo: PlantPhotoStoreResult) => void;
  isSubmitting: boolean;
  handleFormSubmit: () => void;
  completion: number;
  setValue: UseFormSetValue<PlantFormValues>;
};

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
}): UsePlantFormControllerResult {
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
      stage: 'seedling',
      startType: 'seed',
      photoperiodType: 'photoperiod',
      environment: 'indoor',
      medium: 'soil',
      advancedMode: false,
      // Default to today so TaskEngine has a stable anchor date for schedules.
      plantedAt: new Date().toISOString(),
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
    (photo: PlantPhotoStoreResult) => {
      setValue('imageUrl', photo.localUri, {
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
    strainValue: watchedValues.strain,
    onPhotoCaptured,
    isSubmitting,
    handleFormSubmit,
    completion,
    setValue,
  };
}

type DeletePlantButtonProps = {
  onDelete: () => void;
  t: (key: string) => string;
};

function DeletePlantButton({ onDelete, t }: DeletePlantButtonProps) {
  return (
    <View className="mb-4 mt-10 px-4 pb-24">
      <Pressable
        onPress={onDelete}
        accessibilityRole="button"
        accessibilityLabel={t('plants.form.delete_button')}
        accessibilityHint={t('plants.form.delete_confirm_body')}
        testID="delete-plant-button"
        className="items-center justify-center rounded-xl border border-red-500/30 bg-red-500/10 p-4 active:bg-red-500/20 dark:border-red-400/40 dark:bg-red-500/20"
      >
        <Text className="font-medium text-red-600 dark:text-red-400">
          {t('plants.form.delete_button')}
        </Text>
      </Pressable>
    </View>
  );
}

type FormSectionsProps = {
  control: Control<PlantFormValues>;
  options: {
    stage: OptionType[];
    startType: OptionType[];
    photoperiod: OptionType[];
    environment: OptionType[];
    genetic: OptionType[];
    medium: OptionType[];
    spaceSize: OptionType[];
  };
  setValue: UseFormSetValue<PlantFormValues>;
  strainValue?: string;
  t: (key: string) => string;
  onDelete?: () => void;
};

function FormSections({
  control,
  options,
  setValue,
  strainValue,
  t,
  onDelete,
}: FormSectionsProps): React.ReactElement {
  return (
    <View className="gap-6 px-4">
      <IdentitySection
        control={control}
        startTypeOptions={options.startType}
        setValue={setValue}
        strainValue={strainValue}
        t={t}
      />
      <EnvironmentSection
        control={control}
        environmentOptions={options.environment}
        photoperiodOptions={options.photoperiod}
        t={t}
      />
      <CareSection control={control} mediumOptions={options.medium} t={t} />
      <AdvancedSection
        control={control}
        stageOptions={options.stage}
        geneticOptions={options.genetic}
        spaceSizeOptions={options.spaceSize}
        setValue={setValue}
        t={t}
      />
      {onDelete && <DeletePlantButton onDelete={onDelete} t={t} />}
    </View>
  );
}

export function PlantForm({
  defaultValues,
  onSubmit,
  onError,
  isSubmitting,
  onSubmitReady,
  onProgressChange,
  onDelete,
  renderAsFragment = false,
  onPhotoInfo,
  plantId,
}: PlantFormProps): React.ReactElement {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const {
    control,
    imageUrl,
    strainValue,
    onPhotoCaptured,
    isSubmitting: formSubmitting,
    handleFormSubmit,
    completion,
    setValue,
  } = usePlantFormController({ defaultValues, t, onSubmit, onError });

  const advancedMode = useWatch({ control, name: 'advancedMode' }) ?? false;
  const selectedEnvironment = useWatch({ control, name: 'environment' });
  const selectedMedium = useWatch({ control, name: 'medium' });

  const showAdvancedEnvironment =
    advancedMode || selectedEnvironment === 'greenhouse';
  const showAdvancedMedium =
    advancedMode ||
    selectedMedium === 'living_soil' ||
    selectedMedium === 'other';

  const submitRef = React.useRef(handleFormSubmit);
  submitRef.current = handleFormSubmit;
  const stableSubmit = React.useCallback(() => submitRef.current(), []);

  // Stabilize parent-provided callback to avoid effect re-running when parent
  // passes an inline function. Caller may still pass a memoized callback, but
  // using a ref here avoids unnecessary effect triggers.
  const onPhotoInfoRef = React.useRef(onPhotoInfo);
  onPhotoInfoRef.current = onPhotoInfo;

  React.useEffect(
    () => onSubmitReady?.(stableSubmit),
    [onSubmitReady, stableSubmit]
  );
  React.useEffect(
    () => onProgressChange?.(completion),
    [completion, onProgressChange]
  );
  React.useEffect(
    () => onPhotoInfoRef.current?.({ imageUrl, onPhotoCaptured }),
    [imageUrl, onPhotoCaptured]
  );

  const options = React.useMemo(
    () => ({
      stage: toOptions(STAGE_OPTIONS, t),
      startType: toOptions(START_TYPE_OPTIONS, t),
      photoperiod: toOptions(PHOTOPERIOD_OPTIONS, t),
      environment: toOptions(
        showAdvancedEnvironment
          ? ENVIRONMENT_OPTIONS_ADVANCED
          : ENVIRONMENT_OPTIONS_BASE,
        t
      ),
      genetic: toOptions(GENETIC_OPTIONS, t),
      medium: toOptions(
        showAdvancedMedium ? MEDIUM_OPTIONS_ADVANCED : MEDIUM_OPTIONS_BASE,
        t
      ),
      spaceSize: toOptions(SPACE_SIZE_OPTIONS, t),
    }),
    [showAdvancedEnvironment, showAdvancedMedium, t]
  );

  const scrollContentStyle = React.useMemo(
    () => ({
      paddingTop: insets.top + 8,
      paddingBottom: Math.max(insets.bottom + 56, 80),
    }),
    [insets.top, insets.bottom]
  );

  const isDisabled = isSubmitting || formSubmitting;

  if (renderAsFragment) {
    return (
      <FormSections
        control={control}
        options={options}
        setValue={setValue}
        strainValue={strainValue}
        t={t}
        onDelete={onDelete}
      />
    );
  }

  return (
    <View className="flex-1 bg-neutral-50 dark:bg-charcoal-950">
      <ScrollView
        className="flex-1"
        contentContainerStyle={scrollContentStyle}
        showsVerticalScrollIndicator={false}
      >
        <HeroPhotoSection
          imageUrl={imageUrl}
          onPhotoCaptured={onPhotoCaptured}
          disabled={isDisabled}
          plantId={plantId}
        />
        <CompletionProgress
          progress={completion}
          label={t('plants.form.completion', { percent: completion })}
        />
        <FormSections
          control={control}
          options={options}
          setValue={setValue}
          strainValue={strainValue}
          t={t}
          onDelete={onDelete}
        />
      </ScrollView>
    </View>
  );
}
