import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { useColorScheme } from 'nativewind';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  type ComponentType,
  FlatList,
  Keyboard,
  Platform,
  Pressable,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import type { Strain } from '@/api/strains/types';
import { RaceBadge } from '@/components/strains/race-badge';
import { OptimizedImage, Text } from '@/components/ui';
import colors from '@/components/ui/colors';
import { Leaf, Plus, Search } from '@/components/ui/icons';
import { haptics } from '@/lib/haptics';
import { translate } from '@/lib/i18n';

export type StrainPickerContentProps = {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  strains: Strain[];
  value?: string;
  isFetching: boolean;
  showCreateCustom: boolean;
  onSelect: (strain: Strain) => void;
  onClear: () => void;
  onEndReached: () => void;
  onCreateCustom?: () => void;
  showTitle?: boolean;
  inputComponent?: ComponentType<TextInputProps>;
  useBottomSheetList?: boolean;
  onSearchFocus?: () => void;
  inputRef?: React.RefObject<TextInput>;
  testID: string;
};

type RgbColor = {
  r: number;
  g: number;
  b: number;
};

const listContentStyle = { gap: 8, paddingBottom: 20 };
const PRIMARY_500 = colors.primary[500];
const PRIMARY_500_RGB = hexToRgb(PRIMARY_500);

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function hexToRgb(hex: string): RgbColor {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

function StrainThumbnail({
  strainId,
  imageUrl,
}: {
  strainId: string;
  imageUrl?: string;
}): React.ReactElement {
  if (imageUrl) {
    return (
      <OptimizedImage
        uri={imageUrl}
        recyclingKey={strainId}
        className="mr-3 size-10 rounded-full bg-neutral-100 dark:bg-charcoal-800"
        contentFit="cover"
      />
    );
  }

  return (
    <View className="mr-3 size-10 items-center justify-center rounded-full bg-primary-50 dark:bg-primary-900/30">
      <Leaf width={18} height={18} color={colors.primary[600]} />
    </View>
  );
}

function StrainOption({
  strain,
  selected,
  onPress,
}: {
  strain: Strain;
  selected: boolean;
  onPress: () => void;
}): React.ReactElement {
  const scale = useSharedValue(1);
  const bgOpacity = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.get() }],
  }));

  const animatedBgStyle = useAnimatedStyle(() => ({
    backgroundColor: `rgba(${PRIMARY_500_RGB.r}, ${PRIMARY_500_RGB.g}, ${PRIMARY_500_RGB.b}, ${bgOpacity.get()})`,
  }));

  React.useEffect(() => {
    scale.set(1);
    bgOpacity.set(0);
  }, [bgOpacity, scale, strain.id]);

  const handlePressIn = React.useCallback((): void => {
    Keyboard.dismiss();
    scale.set(
      withTiming(0.97, {
        duration: 100,
        reduceMotion: ReduceMotion.System,
      })
    );
    bgOpacity.set(
      withTiming(0.08, {
        duration: 100,
        reduceMotion: ReduceMotion.System,
      })
    );
  }, [scale, bgOpacity]);

  const handlePressOut = React.useCallback((): void => {
    scale.set(
      withTiming(1, {
        duration: 150,
        reduceMotion: ReduceMotion.System,
      })
    );
    bgOpacity.set(
      withTiming(0, {
        duration: 150,
        reduceMotion: ReduceMotion.System,
      })
    );
  }, [scale, bgOpacity]);

  const handlePress = React.useCallback((): void => {
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
      <StrainThumbnail strainId={strain.id} imageUrl={strain.imageUrl} />
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

function StrainSearchInput({
  value,
  onChangeText,
  placeholder,
  isFetching,
  inputComponent: InputComponent,
  onFocus,
  inputRef,
  testID,
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  isFetching: boolean;
  inputComponent?: ComponentType<TextInputProps>;
  onFocus?: () => void;
  inputRef?: React.RefObject<TextInput>;
  testID: string;
}): React.ReactElement {
  const [isFocused, setIsFocused] = React.useState(false);
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const containerClassName = 'flex-row items-center rounded-2xl px-4 py-3.5';
  const inputClassName =
    'flex-1 text-base font-medium text-charcoal-900 dark:text-neutral-100';
  const containerStyle = React.useMemo(() => {
    const backgroundColor = isFocused
      ? isDark
        ? colors.charcoal[900]
        : colors.white
      : isDark
        ? colors.darkSurface.inputBg
        : colors.neutral[100];

    const baseStyle = {
      borderWidth: 1,
      borderColor: isFocused ? colors.primary[500] : colors.transparent,
      backgroundColor,
    };

    if (!isFocused) return baseStyle;

    return {
      ...baseStyle,
      shadowColor: colors.black,
      shadowOpacity: 0.08,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    };
  }, [isFocused, isDark]);

  const Input = InputComponent || TextInput;

  return (
    <View className="mb-4">
      <View
        className={containerClassName}
        style={containerStyle}
        onTouchStart={() => inputRef?.current?.focus()}
      >
        <Search size={18} className="mr-3 text-neutral-400" />
        <Input
          accessibilityLabel={translate(
            'accessibility.strains.search_strains_label'
          )}
          accessibilityHint={translate(
            'accessibility.strains.search_strains_hint'
          )}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={
            isDark ? colors.neutral[500] : colors.neutral[400]
          }
          onFocus={() => {
            setIsFocused(true);
            onFocus?.();
          }}
          onBlur={() => setIsFocused(false)}
          testID={testID}
          className={inputClassName}
          ref={inputRef}
        />
        {isFetching && (
          <ActivityIndicator size="small" color={colors.primary[500]} />
        )}
      </View>
    </View>
  );
}

function CreateCustomStrainOption({
  query,
  onPress,
  testID,
}: {
  query: string;
  onPress: () => void;
  testID: string;
}): React.ReactElement {
  const { t } = useTranslation();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.get() }],
  }));

  const handlePressIn = React.useCallback((): void => {
    Keyboard.dismiss();
    scale.set(
      withTiming(0.97, {
        duration: 100,
        reduceMotion: ReduceMotion.System,
      })
    );
  }, [scale]);

  const handlePressOut = React.useCallback((): void => {
    scale.set(
      withTiming(1, {
        duration: 150,
        reduceMotion: ReduceMotion.System,
      })
    );
  }, [scale]);

  const handlePress = React.useCallback((): void => {
    haptics.selection();
    onPress();
  }, [onPress]);

  return (
    <AnimatedPressable
      style={animatedStyle}
      className="mt-2 flex-row items-center rounded-2xl border border-dashed border-primary-300 bg-primary-50 p-4 dark:border-primary-600 dark:bg-primary-900/20"
      accessibilityLabel={t('plants.form.strain_create_custom', {
        name: query,
      })}
      accessibilityHint={t('accessibility.common.select_option_hint', {
        label: t('plants.form.strain_create_custom', { name: query }),
      })}
      accessibilityRole="button"
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      testID={testID}
    >
      <View className="mr-3 size-10 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900/50">
        <Plus width={18} height={18} color={colors.primary[600]} />
      </View>
      <View className="flex-1">
        <Text className="text-base font-semibold text-primary-700 dark:text-primary-300">
          {t('plants.form.strain_create_custom', { name: query })}
        </Text>
        <Text className="text-xs text-neutral-500 dark:text-neutral-400">
          {t('plants.form.strain_create_custom_hint')}
        </Text>
      </View>
    </AnimatedPressable>
  );
}

export function StrainPickerContent({
  searchQuery,
  onSearchChange,
  strains,
  value,
  isFetching,
  showCreateCustom,
  onSelect,
  onClear,
  onEndReached,
  onCreateCustom,
  showTitle = true,
  inputComponent,
  useBottomSheetList = false,
  onSearchFocus,
  inputRef,
  testID,
}: StrainPickerContentProps): React.ReactElement {
  const { t } = useTranslation();
  const ListComponent = useBottomSheetList ? BottomSheetFlatList : FlatList;

  const renderItem = React.useCallback(
    ({ item }: { item: Strain }) => (
      <StrainOption
        strain={item}
        selected={value === item.name}
        onPress={() => onSelect(item)}
      />
    ),
    [value, onSelect]
  );

  const listFooter = React.useMemo(() => {
    if (!showCreateCustom || !onCreateCustom) return null;
    return (
      <CreateCustomStrainOption
        query={searchQuery.trim()}
        onPress={onCreateCustom}
        testID={`${testID}-create-custom`}
      />
    );
  }, [showCreateCustom, onCreateCustom, searchQuery, testID]);

  const listHeader = (
    <View className="px-4 pt-4">
      {showTitle && (
        <Text className="mb-4 text-center text-lg font-semibold text-charcoal-800 dark:text-neutral-100">
          {t('feed.add_post.select_strain')}
        </Text>
      )}

      <StrainSearchInput
        value={searchQuery}
        onChangeText={onSearchChange}
        placeholder={t('strains.search_placeholder')}
        isFetching={isFetching}
        inputComponent={inputComponent}
        onFocus={onSearchFocus}
        inputRef={inputRef}
        testID={`${testID}-search`}
      />

      {value && (
        <Pressable
          accessibilityRole="button"
          onPress={onClear}
          onPressIn={Keyboard.dismiss}
          className="mb-3 self-start rounded-full bg-neutral-100 px-4 py-2 dark:bg-white/10"
          testID={`${testID}-clear`}
        >
          <Text className="text-sm font-medium text-neutral-600 dark:text-neutral-300">
            {t('common.clear')} {value}
          </Text>
        </Pressable>
      )}
    </View>
  );

  return (
    <ListComponent
      data={strains}
      keyExtractor={(item: Strain) => item.id}
      renderItem={renderItem}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.5}
      contentContainerStyle={[listContentStyle, { paddingBottom: 24 }]}
      ListHeaderComponent={listHeader}
      ListFooterComponent={listFooter}
      onTouchStart={Keyboard.dismiss}
      keyboardShouldPersistTaps="always"
      keyboardDismissMode={Platform.OS === 'ios' ? 'none' : 'on-drag'}
      ListEmptyComponent={
        showCreateCustom ? null : (
          <Text className="py-8 text-center text-neutral-500">
            {searchQuery ? t('strains.no_results') : t('strains.empty_state')}
          </Text>
        )
      }
    />
  );
}
