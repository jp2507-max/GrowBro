import { MotiView } from 'moti';
import React, { useCallback } from 'react';
import {
  I18nManager,
  Pressable,
  type PressableProps,
  StyleSheet,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';

import colors from '@/components/ui/colors';

import { Text } from './text';

const SIZE = 20;
const WIDTH = 50;
const HEIGHT = 28;
const THUMB_HEIGHT = 22;
const THUMB_WIDTH = 22;
const THUMB_OFFSET = 4;

export interface RootProps extends Omit<PressableProps, 'onPress'> {
  onChange: (checked: boolean) => void;
  checked?: boolean;
  className?: string;
  accessibilityLabel: string;
  // for tests: mirror checked state as `value` prop on host element
  value?: boolean;
  // optional RN Switch-compatible prop; forwarded to onChange
  onValueChange?: (checked: boolean) => void;
}

export type IconProps = {
  checked: boolean;
};

export const Root = ({
  checked = false,
  children,
  onChange,
  disabled,
  className = '',
  ...props
}: RootProps) => {
  const handleChange = useCallback(() => {
    const next = !checked;
    onChange(next);
    // If caller passed RN-like onValueChange, call it too
    // @ts-ignore – optional prop for compatibility
    props?.onValueChange?.(next);
  }, [onChange, checked, props]);

  return (
    <Pressable
      onPress={handleChange}
      className={`flex-row items-center ${className} ${disabled ? 'opacity-50' : ''}`}
      accessibilityState={
        props.accessibilityRole === 'radio'
          ? { selected: checked, disabled: !!disabled }
          : { checked, disabled: !!disabled }
      }
      disabled={disabled}
      {...props}
    >
      {children}
    </Pressable>
  );
};

type LabelProps = {
  text: string;
  className?: string;
  testID?: string;
};

const Label = ({ text, testID, className = '' }: LabelProps) => {
  return (
    <Text testID={testID} className={` ${className} pl-2`}>
      {text}
    </Text>
  );
};

export const CheckboxIcon = ({ checked = false }: IconProps) => {
  const color = checked ? colors.primary[300] : colors.charcoal[400];
  return (
    <MotiView
      style={[styles.checkboxIcon, { borderColor: color }]}
      className="items-center justify-center rounded-[5px] border-2"
      from={{ backgroundColor: 'transparent', borderColor: '#CCCFD6' }}
      animate={{
        backgroundColor: checked ? color : 'transparent',
        borderColor: color,
      }}
      transition={{
        backgroundColor: { type: 'timing', duration: 100 },
        borderColor: { type: 'timing', duration: 100 },
      }}
    >
      <MotiView
        from={{ opacity: 0 }}
        animate={{ opacity: checked ? 1 : 0 }}
        transition={{ opacity: { type: 'timing', duration: 100 } }}
      >
        <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <Path
            d="m16.726 7-.64.633c-2.207 2.212-3.878 4.047-5.955 6.158l-2.28-1.928-.69-.584L6 12.66l.683.577 2.928 2.477.633.535.591-.584c2.421-2.426 4.148-4.367 6.532-6.756l.633-.64L16.726 7Z"
            fill="#fff"
          />
        </Svg>
      </MotiView>
    </MotiView>
  );
};

const CheckboxRoot = ({ checked = false, children, ...props }: RootProps) => {
  return (
    <Root checked={checked} accessibilityRole="checkbox" {...props}>
      {children}
    </Root>
  );
};

const CheckboxBase = ({
  checked = false,
  testID,
  label,

  ...props
}: RootProps & { label?: string }) => {
  return (
    <CheckboxRoot checked={checked} testID={testID} {...props}>
      <CheckboxIcon checked={checked} />
      {label ? (
        <Label
          text={label}
          testID={testID ? `${testID}-label` : undefined}
          className="pr-2"
        />
      ) : null}
    </CheckboxRoot>
  );
};

export const Checkbox = Object.assign(CheckboxBase, {
  Icon: CheckboxIcon,
  Root: CheckboxRoot,
  Label,
});

export const RadioIcon = ({ checked = false }: IconProps) => {
  const color = checked ? colors.primary[300] : colors.charcoal[400];
  return (
    <MotiView
      style={[styles.radioIcon, { borderColor: color }]}
      className="items-center justify-center rounded-[20px] border-2 bg-transparent"
      from={{ borderColor: '#CCCFD6' }}
      animate={{
        borderColor: color,
      }}
      transition={{ borderColor: { duration: 100, type: 'timing' } }}
    >
      <MotiView
        className={`size-[10px] rounded-[10px] ${checked && 'bg-primary-300'} `}
        from={{ opacity: 0 }}
        animate={{ opacity: checked ? 1 : 0 }}
        transition={{ opacity: { duration: 50, type: 'timing' } }}
      />
    </MotiView>
  );
};

const RadioRoot = ({ checked = false, children, ...props }: RootProps) => {
  return (
    <Root checked={checked} accessibilityRole="radio" {...props}>
      {children}
    </Root>
  );
};

const RadioBase = ({
  checked = false,
  testID,
  label,
  ...props
}: RootProps & { label?: string }) => {
  return (
    <RadioRoot checked={checked} testID={testID} {...props}>
      <RadioIcon checked={checked} />
      {label ? (
        <Label text={label} testID={testID ? `${testID}-label` : undefined} />
      ) : null}
    </RadioRoot>
  );
};

export const Radio = Object.assign(RadioBase, {
  Icon: RadioIcon,
  Root: RadioRoot,
  Label,
});

export const SwitchIcon = ({ checked = false }: IconProps) => {
  const offDist = WIDTH - THUMB_WIDTH - THUMB_OFFSET;
  // Distance from the right edge; keep right: 0 anchoring
  const dist = I18nManager.isRTL
    ? checked
      ? offDist
      : THUMB_OFFSET // RTL: ON = left
    : checked
      ? THUMB_OFFSET
      : offDist; // LTR: ON = right

  const backgroundColor = checked ? colors.primary[300] : colors.charcoal[400];

  return (
    <View className="w-[50px] justify-center">
      <View className="overflow-hidden rounded-full">
        <View style={[styles.switchTrack, { backgroundColor }]} />
      </View>
      <MotiView
        style={styles.switchThumb}
        animate={{ translateX: -dist }}
        transition={{ translateX: { overshootClamping: true } }}
      />
    </View>
  );
};
const SwitchRoot = ({ checked = false, children, ...props }: RootProps) => {
  return (
    <Root checked={checked} accessibilityRole="switch" {...props}>
      {children}
    </Root>
  );
};

const SwitchBase = ({
  checked = false,
  testID,
  label,
  ...props
}: RootProps & { label?: string }) => {
  return (
    <SwitchRoot checked={checked} testID={testID} {...props}>
      <SwitchIcon checked={checked} />
      {label ? (
        <Label text={label} testID={testID ? `${testID}-label` : undefined} />
      ) : null}
    </SwitchRoot>
  );
};

export const Switch = Object.assign(SwitchBase, {
  Icon: SwitchIcon,
  Root: SwitchRoot,
  Label,
});

const styles = StyleSheet.create({
  checkboxIcon: {
    height: SIZE,
    width: SIZE,
  },
  radioIcon: {
    height: SIZE,
    width: SIZE,
  },
  switchThumb: {
    backgroundColor: colors.white,
    borderRadius: 13,
    height: THUMB_HEIGHT,
    position: 'absolute',
    right: 0,
    width: THUMB_WIDTH,
  },
  switchTrack: {
    height: HEIGHT,
    width: WIDTH,
  },
});
