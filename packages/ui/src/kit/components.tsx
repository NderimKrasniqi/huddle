import { useState } from 'react';
import { Platform, Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { HuddleIcon, type HuddleIconName } from './icon';
import {
  huddleUIKitColors,
  huddleUIKitRadius,
  huddleUIKitShadow,
  huddleUIKitTypography,
} from './theme';

type ButtonProps = {
  readonly label: string;
  readonly onPress?: () => void;
  readonly disabled?: boolean;
  readonly busy?: boolean;
  readonly accessibilityLabel?: string;
};

export interface NavigationIconButtonProps {
  readonly icon: Extract<HuddleIconName, 'back' | 'carousel-left' | 'carousel-right' | 'chevron-right' | 'close'>;
  readonly onPress?: () => void;
  readonly disabled?: boolean;
  readonly size?: number;
  readonly style?: StyleProp<ViewStyle>;
  readonly accessibilityLabel?: string;
}

export function NavigationIconButton({
  icon,
  onPress,
  disabled = false,
  size = Platform.isTV ? 60 : 48,
  style,
  accessibilityLabel,
}: NavigationIconButtonProps) {
  const [focused, setFocused] = useState(false);
  const defaultLabel = {
    back: 'Back',
    'carousel-left': 'Previous game',
    'carousel-right': 'Next game',
    'chevron-right': 'Open',
    close: 'Close',
  }[icon];

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? defaultLabel}
      accessibilityState={{ disabled }}
      focusable={!disabled}
      style={({ pressed }) => [
        {
          width: size,
          height: size,
          borderRadius: huddleUIKitRadius.pill,
          backgroundColor: huddleUIKitColors.surface,
          borderWidth: focused ? 2 : 1,
          borderColor: focused ? huddleUIKitColors.orange : huddleUIKitColors.border,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.4 : pressed ? 0.8 : 1,
          transform: [{ scale: focused && Platform.isTV ? 1.06 : 1 }],
          ...huddleUIKitShadow,
        },
        style,
      ]}
    >
      <HuddleIcon name={icon} size={size * 0.46} />
    </Pressable>
  );
}

export type HuddleMode = 'quick' | 'standard' | 'custom';

export function ModeCard({
  mode,
  selected = false,
  onPress,
  style,
}: {
  readonly mode: HuddleMode;
  readonly selected?: boolean;
  readonly onPress?: () => void;
  readonly style?: StyleProp<ViewStyle>;
}) {
  const [focused, setFocused] = useState(false);
  const label = mode.charAt(0).toUpperCase() + mode.slice(1);

  return (
    <Pressable
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      focusable
      style={({ pressed }) => [
        {
          minWidth: Platform.isTV ? 150 : 96,
          minHeight: Platform.isTV ? 128 : 104,
          paddingHorizontal: 16,
          paddingVertical: 16,
          borderRadius: huddleUIKitRadius.md,
          backgroundColor: huddleUIKitColors.surface,
          borderWidth: selected || focused ? 2 : 1,
          borderColor: selected || focused ? huddleUIKitColors.orange : huddleUIKitColors.border,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          opacity: pressed ? 0.85 : 1,
          transform: [{ scale: focused && Platform.isTV ? 1.04 : 1 }],
          ...huddleUIKitShadow,
        },
        style,
      ]}
    >
      <HuddleIcon name={mode} size={Platform.isTV ? 42 : 34} />
      <Text
        style={{
          color: huddleUIKitColors.textPrimary,
          fontFamily: huddleUIKitTypography.semibold,
          fontSize: Platform.isTV ? 18 : 14,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  readonly options: readonly T[];
  readonly value: T;
  readonly onChange: (value: T) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {options.map((option) => {
        const selected = option === value;
        return (
          <Pressable
            key={option}
            onPress={() => onChange(option)}
            accessibilityRole="button"
            accessibilityLabel={option}
            accessibilityState={{ selected }}
            focusable
            style={({ pressed }) => ({
              minWidth: 72,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderRadius: huddleUIKitRadius.sm,
              backgroundColor: huddleUIKitColors.surface,
              borderWidth: selected ? 1.5 : 1,
              borderColor: selected ? huddleUIKitColors.orange : huddleUIKitColors.border,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Text
              style={{
                color: selected ? huddleUIKitColors.orange : huddleUIKitColors.textPrimary,
                fontFamily: selected
                  ? huddleUIKitTypography.semibold
                  : huddleUIKitTypography.medium,
                fontSize: 14,
              }}
            >
              {option}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function StepButton({
  icon,
  onPress,
  disabled,
  accessibilityLabel,
}: {
  readonly icon: 'plus' | 'minus';
  readonly onPress: () => void;
  readonly disabled?: boolean;
  readonly accessibilityLabel: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      focusable={!disabled}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: huddleUIKitRadius.pill,
        backgroundColor: huddleUIKitColors.surface,
        borderWidth: 1,
        borderColor: huddleUIKitColors.border,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.4 : pressed ? 0.75 : 1,
        ...huddleUIKitShadow,
      })}
    >
      <HuddleIcon name={icon} size={20} />
    </Pressable>
  );
}

export function QuestionStepper({
  value,
  onChange,
  min = 1,
  max = 99,
  step = 1,
}: {
  readonly value: number;
  readonly onChange: (value: number) => void;
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
      <StepButton
        icon="minus"
        disabled={value <= min}
        accessibilityLabel="Decrease value"
        onPress={() => onChange(Math.max(min, value - step))}
      />
      <Text
        style={{
          minWidth: 28,
          textAlign: 'center',
          color: huddleUIKitColors.textPrimary,
          fontFamily: huddleUIKitTypography.semibold,
          fontSize: 20,
        }}
      >
        {value}
      </Text>
      <StepButton
        icon="plus"
        disabled={value >= max}
        accessibilityLabel="Increase value"
        onPress={() => onChange(Math.min(max, value + step))}
      />
    </View>
  );
}

export function CategoryListRow({
  label,
  onPress,
  style,
}: {
  readonly label: string;
  readonly onPress?: () => void;
  readonly style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: onPress === undefined }}
      focusable={onPress !== undefined}
      style={({ pressed }) => [
        {
          minHeight: 46,
          minWidth: 180,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 20,
          paddingHorizontal: 14,
          borderRadius: huddleUIKitRadius.sm,
          borderWidth: 1,
          borderColor: huddleUIKitColors.border,
          backgroundColor: huddleUIKitColors.surface,
          opacity: pressed ? 0.8 : 1,
        },
        style,
      ]}
    >
      <Text
        style={{
          color: huddleUIKitColors.textPrimary,
          fontFamily: huddleUIKitTypography.medium,
          fontSize: 14,
        }}
      >
        {label}
      </Text>
      <HuddleIcon name="chevron-right" size={18} />
    </Pressable>
  );
}

export function BottomSheetOptionRow({
  label,
  selected = false,
  onPress,
  style,
}: {
  readonly label: string;
  readonly selected?: boolean;
  readonly onPress?: () => void;
  readonly style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled: onPress === undefined }}
      focusable={onPress !== undefined}
      style={({ pressed }) => [
        {
          minHeight: 46,
          minWidth: 200,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 14,
          borderRadius: huddleUIKitRadius.sm,
          borderWidth: 1,
          borderColor: huddleUIKitColors.border,
          backgroundColor: huddleUIKitColors.surface,
          opacity: pressed ? 0.8 : 1,
        },
        style,
      ]}
    >
      <Text
        style={{
          color: huddleUIKitColors.textPrimary,
          fontFamily: huddleUIKitTypography.medium,
          fontSize: 14,
        }}
      >
        {label}
      </Text>
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 11,
          borderWidth: 1.5,
          borderColor: selected ? huddleUIKitColors.orange : huddleUIKitColors.navy,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {selected ? (
          <View
            style={{
              width: 12,
              height: 12,
              borderRadius: 6,
              backgroundColor: huddleUIKitColors.orange,
            }}
          />
        ) : null}
      </View>
    </Pressable>
  );
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
  busy = false,
  accessibilityLabel,
}: ButtonProps) {
  const [focused, setFocused] = useState(false);

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled, busy }}
      focusable={!disabled}
      style={({ pressed }) => ({
        minWidth: Platform.isTV ? 260 : 180,
        minHeight: Platform.isTV ? 64 : 48,
        paddingHorizontal: 24,
        borderRadius: huddleUIKitRadius.sm,
        backgroundColor: huddleUIKitColors.orange,
        borderWidth: focused ? 3 : 0,
        borderColor: huddleUIKitColors.surface,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.45 : pressed ? 0.86 : 1,
        transform: [{ scale: focused && Platform.isTV ? 1.035 : 1 }],
      })}
    >
      <Text
        style={{
          color: huddleUIKitColors.surface,
          fontFamily: huddleUIKitTypography.semibold,
          fontSize: Platform.isTV ? 20 : 16,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function SecondaryButton({
  label,
  onPress,
  disabled,
  busy = false,
  accessibilityLabel,
}: ButtonProps) {
  const [focused, setFocused] = useState(false);

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled, busy }}
      focusable={!disabled}
      style={({ pressed }) => ({
        minWidth: Platform.isTV ? 260 : 200,
        minHeight: Platform.isTV ? 64 : 48,
        paddingHorizontal: 24,
        borderRadius: huddleUIKitRadius.sm,
        backgroundColor: huddleUIKitColors.surface,
        borderWidth: focused ? 2.5 : 1.5,
        borderColor: huddleUIKitColors.orange,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.45 : pressed ? 0.86 : 1,
        transform: [{ scale: focused && Platform.isTV ? 1.035 : 1 }],
      })}
    >
      <Text
        style={{
          color: huddleUIKitColors.orange,
          fontFamily: huddleUIKitTypography.semibold,
          fontSize: Platform.isTV ? 20 : 16,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function SelectableCard({
  icon = 'quick',
  label,
  selected = false,
  onPress,
}: {
  readonly icon?: HuddleIconName;
  readonly label: string;
  readonly selected?: boolean;
  readonly onPress?: () => void;
}) {
  const [focused, setFocused] = useState(false);

  return (
    <Pressable
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      focusable
      style={({ pressed }) => ({
        position: 'relative',
        minWidth: 130,
        minHeight: 60,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 18,
        borderRadius: huddleUIKitRadius.sm,
        backgroundColor: huddleUIKitColors.surface,
        borderWidth: selected || focused ? 1.5 : 1,
        borderColor: selected || focused ? huddleUIKitColors.orange : huddleUIKitColors.border,
        opacity: pressed ? 0.82 : 1,
        transform: [{ scale: focused && Platform.isTV ? 1.035 : 1 }],
      })}
    >
      <HuddleIcon name={icon} size={22} />
      <Text
        style={{
          color: huddleUIKitColors.textPrimary,
          fontFamily: huddleUIKitTypography.semibold,
          fontSize: 14,
        }}
      >
        {label}
      </Text>
      {selected ? (
        <View
          style={{
            position: 'absolute',
            top: -9,
            right: -9,
            width: 24,
            height: 24,
            borderRadius: 12,
            backgroundColor: huddleUIKitColors.orange,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <HuddleIcon name="check" size={15} color={huddleUIKitColors.surface} strokeWidth={3} />
        </View>
      ) : null}
    </Pressable>
  );
}
