import {
  BottomSheetFlatList,
  useBottomSheetTimingConfigs,
} from '@gorhom/bottom-sheet';
import { useColorScheme } from 'nativewind';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import type { Strain } from '@/api/strains/types';
import { useStrainsInfiniteWithCache } from '@/api/strains/use-strains-infinite-with-cache';
import { RaceBadge } from '@/components/strains/race-badge';
import { Image, Text } from '@/components/ui';
import colors from '@/components/ui/colors';
import { CaretDown, Leaf, Search } from '@/components/ui/icons';
import { Modal, useModal } from '@/components/ui/modal';
import { haptics } from '@/lib/haptics';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';
import { translate } from '@/lib/i18n';

type RgbColor = {
  r: number;
  g: number;
  b: number;
};

function hexToRgb(hex: string): RgbColor {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

function rgbaFromRgb(rgb: RgbColor, alpha: number): string {
  'worklet';
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

const listContentStyle = { gap: 8, paddingBottom: 20 };
const PRIMARY_500 = colors.primary[500];
const PRIMARY_500_RGB = hexToRgb(PRIMARY_500);

type StrainPickerProps = {
  value?: string;
  onSelect: (strain: string | undefined) => void;
  label?: string;
  placeholder?: string;
  testID?: string;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// ---------------------------------------------------------------------------
// StrainThumbnail - Contact-list style thumbnail with fallback
// ---------------------------------------------------------------------------
function StrainThumbnail({ imageUrl }: { imageUrl?: string }) {
  if (imageUrl) {
    return (
      <Image
        source={{ uri: imageUrl }}
        className="mr-3 size-10 rounded-full bg-neutral-100 dark:bg-charcoal-800"
        contentFit="cover"
      />
    );
  }

  // Fallback: soft circle with Leaf icon
  return (
    <View className="mr-3 size-10 items-center justify-center rounded-full bg-primary-50 dark:bg-primary-900/30">
      <Leaf width={18} height={18} color={colors.primary[600]} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// StrainOption - Premium list item with thumbnail
// ---------------------------------------------------------------------------
function StrainOption({
  strain,
  selected,
  onPress,
}: {
  strain: Strain;
  selected: boolean;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const bgOpacity = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const animatedBgStyle = useAnimatedStyle(() => ({
    backgroundColor: rgbaFromRgb(PRIMARY_500_RGB, bgOpacity.value),
  }));

  const handlePressIn = React.useCallback((): void => {
    scale.value = withTiming(0.97, {
      duration: 100,
      reduceMotion: ReduceMotion.System,
    });
    bgOpacity.value = withTiming(0.08, {
      duration: 100,
      reduceMotion: ReduceMotion.System,
    });
  }, [scale, bgOpacity]);

  const handlePressOut = React.useCallback((): void => {
    scale.value = withTiming(1, {
      duration: 150,
      reduceMotion: ReduceMotion.System,
    });
    bgOpacity.value = withTiming(0, {
      duration: 150,
      reduceMotion: ReduceMotion.System,
    });
  }, [scale, bgOpacity]);

  const handlePress = React.useCallback(() => {
    haptics.selection();
    onPress();
  }, [onPress]);

  return (
    <AnimatedPressable
      style={[animatedStyle, !selected && animatedBgStyle]}
      className={`flex-row items-center rounded-2xl p-4 ${
        selected
          ? 'border border-primary-600 bg-primary-100 dark:border-primary-400 dark:bg-primary-900/30'
          : 'bg-neutral-50 dark:bg-white/5'
      }`}
      accessibilityLabel={strain.name}
      accessibilityHint={translate('accessibility.common.select_option_hint', {
        label: strain.name,
      })}
      accessibilityRole="menuitem"
      accessibilityState={{ selected }}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
    >
      <StrainThumbnail imageUrl={strain.imageUrl} />
      <View className="flex-1 flex-row items-center gap-3">
        <Text
          className={`text-base ${
            selected
              ? 'font-bold text-primary-900 dark:text-primary-100'
              : 'font-semibold text-neutral-800 dark:text-neutral-100'
          }`}
        >
          {strain.name}
        </Text>
        <RaceBadge race={strain.race} />
      </View>
    </AnimatedPressable>
  );
}

// ---------------------------------------------------------------------------
// StrainSearchInput - Polished search bar matching Create Post inputs
// ---------------------------------------------------------------------------
type StrainSearchInputProps = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  isFetching: boolean;
  testID: string;
};

function StrainSearchInput({
  value,
  onChangeText,
  placeholder,
  isFetching,
  testID,
}: StrainSearchInputProps) {
  const [isFocused, setIsFocused] = React.useState(false);
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <View className="mb-4">
      <View
        className={`flex-row items-center rounded-2xl px-4 py-3.5 ${
          isFocused
            ? 'border border-primary-500 bg-white shadow-sm dark:bg-charcoal-900'
            : 'border border-transparent bg-neutral-100 dark:bg-white/5'
        }`}
      >
        <Search size={18} className="mr-3 text-neutral-400" />
        <TextInput
          accessibilityLabel="Search strains"
          accessibilityHint="Enter text to search for strains"
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={
            isDark ? colors.neutral[500] : colors.neutral[400]
          }
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          testID={testID}
          className="flex-1 text-base font-medium text-charcoal-900 dark:text-neutral-100"
        />
        {isFetching && (
          <ActivityIndicator size="small" color={colors.primary[500]} />
        )}
      </View>
    </View>
  );
}

type StrainPickerModalProps = {
  modal: ReturnType<typeof useModal>;
  searchQuery: string;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  strains: Strain[];
  value?: string;
  isFetching: boolean;
  onSelect: (strain: Strain) => void;
  onClear: () => void;
  onEndReached: () => void;
  renderItem: ({ item }: { item: Strain }) => React.ReactElement;
  backgroundStyle: {
    backgroundColor: string;
    borderTopLeftRadius: number;
    borderTopRightRadius: number;
  };
  handleStyle: {
    backgroundColor: string;
    width: number;
    height: number;
    borderRadius: number;
  };
  testID: string;
};

function StrainPickerModal({
  modal,
  searchQuery,
  setSearchQuery,
  strains,
  value,
  isFetching,
  onClear,
  onEndReached,
  renderItem,
  backgroundStyle,
  handleStyle,
  testID,
}: StrainPickerModalProps) {
  const { t } = useTranslation();

  const animationConfigs = useBottomSheetTimingConfigs({
    duration: 150,
  });

  return (
    <Modal
      ref={modal.ref}
      index={0}
      snapPoints={['70%']}
      backgroundStyle={backgroundStyle}
      handleIndicatorStyle={handleStyle}
      animationConfigs={animationConfigs}
      enablePanDownToClose
    >
      <View className="flex-1 px-4 pb-6">
        <Text className="mb-4 text-center text-lg font-semibold text-charcoal-800 dark:text-neutral-100">
          {t('feed.addPost.selectStrain')}
        </Text>

        {/* Polished Search Bar - soft look matching Create Post inputs */}
        <StrainSearchInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={t('strains.search_placeholder')}
          isFetching={isFetching}
          testID={`${testID}-search`}
        />

        {value && (
          <Pressable
            accessibilityRole="button"
            onPress={onClear}
            className="mb-3 self-start rounded-full bg-neutral-100 px-4 py-2 dark:bg-white/10"
            testID={`${testID}-clear`}
          >
            <Text className="text-sm font-medium text-neutral-600 dark:text-neutral-300">
              {t('common.clear')} {value}
            </Text>
          </Pressable>
        )}

        <BottomSheetFlatList
          data={strains}
          keyExtractor={(item: Strain) => item.id}
          renderItem={renderItem}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.5}
          contentContainerStyle={listContentStyle}
          ListEmptyComponent={
            <Text className="py-8 text-center text-neutral-500">
              {searchQuery ? t('strains.no_results') : t('strains.empty_state')}
            </Text>
          }
        />
      </View>
    </Modal>
  );
}

type StrainPickerTriggerProps = {
  value?: string;
  label?: string;
  placeholder?: string;
  onPress: () => void;
  testID: string;
};

function StrainPickerTrigger({
  value,
  label,
  placeholder,
  onPress,
  testID,
}: StrainPickerTriggerProps) {
  const { t } = useTranslation();
  const displayValue = value || placeholder || t('feed.addPost.selectStrain');

  return (
    <View className="mb-4">
      {label && (
        <Text
          testID={`${testID}-label`}
          className="mb-2 ml-1 text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400"
        >
          {label}
        </Text>
      )}
      <Pressable
        className="flex-row items-center justify-between rounded-2xl border-2 border-neutral-200 bg-white px-5 py-4 dark:border-white/10 dark:bg-white/10"
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label || t('feed.addPost.selectStrain')}
        accessibilityHint={t('feed.addPost.strainHint')}
        testID={`${testID}-trigger`}
      >
        <Text
          className={`flex-1 text-base font-medium ${
            value
              ? 'text-charcoal-900 dark:text-neutral-100'
              : 'text-neutral-400 dark:text-neutral-500'
          }`}
        >
          {displayValue}
        </Text>
        <CaretDown
          size={18}
          className="text-primary-700 dark:text-primary-300"
        />
      </Pressable>
    </View>
  );
}

function useStrainPickerStyles(isDark: boolean) {
  const backgroundStyle = React.useMemo(
    () => ({
      backgroundColor: isDark ? colors.darkSurface.card : colors.white,
      borderTopLeftRadius: 35,
      borderTopRightRadius: 35,
    }),
    [isDark]
  );

  const handleStyle = React.useMemo(
    () => ({
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.2)' : '#D4D4D4',
      width: 48,
      height: 6,
      borderRadius: 3,
    }),
    [isDark]
  );

  return { backgroundStyle, handleStyle };
}

export function StrainPicker({
  value,
  onSelect,
  label,
  placeholder,
  testID = 'strain-picker',
}: StrainPickerProps) {
  const modal = useModal();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [isOpen, setIsOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const debouncedSearchQuery = useDebouncedValue(searchQuery.trim(), 250);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isFetching } =
    useStrainsInfiniteWithCache({
      variables: {
        searchQuery: debouncedSearchQuery || undefined,
        pageSize: 20,
      },
      enabled: isOpen,
    });

  const strains = React.useMemo(
    () => data?.pages.flatMap((page) => page.data) ?? [],
    [data]
  );
  const { backgroundStyle, handleStyle } = useStrainPickerStyles(isDark);

  const handleOpen = React.useCallback(() => {
    setIsOpen(true);
    modal.present();
  }, [modal]);

  const handleSelect = React.useCallback(
    (strain: Strain) => {
      onSelect(strain.name);
      modal.dismiss();
      setSearchQuery('');
      setIsOpen(false);
    },
    [onSelect, modal]
  );

  const handleClear = React.useCallback(() => {
    onSelect(undefined);
    modal.dismiss();
    setSearchQuery('');
    setIsOpen(false);
  }, [onSelect, modal]);

  const handleEndReached = React.useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const renderItem = React.useCallback(
    ({ item }: { item: Strain }) => (
      <StrainOption
        strain={item}
        selected={value === item.name}
        onPress={() => handleSelect(item)}
      />
    ),
    [value, handleSelect]
  );

  return (
    <>
      <StrainPickerTrigger
        value={value}
        label={label}
        placeholder={placeholder}
        onPress={handleOpen}
        testID={testID}
      />
      <StrainPickerModal
        modal={modal}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        strains={strains}
        value={value}
        isFetching={isFetching}
        onSelect={handleSelect}
        onClear={handleClear}
        onEndReached={handleEndReached}
        renderItem={renderItem}
        backgroundStyle={backgroundStyle}
        handleStyle={handleStyle}
        testID={testID}
      />
    </>
  );
}
