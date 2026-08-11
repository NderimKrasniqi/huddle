import type { ReactNode } from 'react';
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

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
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
      accessibilityState={{ selected }}
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

export function OnlineDot({ size = 12 }: { readonly size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: huddleUIKitColors.success,
      }}
    />
  );
}

export function SelectedBadge({ label = 'SELECTED' }: { readonly label?: string }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        borderWidth: 1.5,
        borderColor: huddleUIKitColors.orange,
        borderRadius: huddleUIKitRadius.sm,
        paddingHorizontal: 12,
        paddingVertical: 8,
        backgroundColor: huddleUIKitColors.surface,
      }}
    >
      <View
        style={{
          width: 20,
          height: 20,
          borderRadius: 10,
          backgroundColor: huddleUIKitColors.orange,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <HuddleIcon name="check" size={13} color={huddleUIKitColors.surface} strokeWidth={3} />
      </View>
      <Text
        style={{
          color: huddleUIKitColors.orange,
          fontFamily: huddleUIKitTypography.bold,
          fontSize: 13,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

export type StatusPillVariant = 'active' | 'host' | 'away';

export function StatusPill({ variant }: { readonly variant: StatusPillVariant }) {
  const config = {
    active: {
      text: 'ACTIVE',
      foreground: huddleUIKitColors.success,
      background: huddleUIKitColors.activeBackground,
    },
    host: {
      text: 'HOST',
      foreground: huddleUIKitColors.orange,
      background: huddleUIKitColors.hostBackground,
    },
    away: {
      text: 'AWAY',
      foreground: huddleUIKitColors.away,
      background: huddleUIKitColors.awayBackground,
    },
  }[variant];

  return (
    <View
      style={{
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: huddleUIKitRadius.pill,
        backgroundColor: config.background,
      }}
    >
      <Text
        style={{
          color: config.foreground,
          fontFamily: huddleUIKitTypography.semibold,
          fontSize: 13,
        }}
      >
        {config.text}
      </Text>
    </View>
  );
}

export type StatusStripVariant = 'info' | 'success';

export function StatusStrip({
  variant = 'info',
  children,
  style,
}: {
  readonly variant?: StatusStripVariant;
  readonly children: ReactNode;
  readonly style?: StyleProp<ViewStyle>;
}) {
  const success = variant === 'success';

  return (
    <View
      style={[
        {
          minHeight: 44,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingHorizontal: 16,
          paddingVertical: 11,
          borderRadius: huddleUIKitRadius.sm,
          backgroundColor: success
            ? huddleUIKitColors.successBackground
            : huddleUIKitColors.infoBackground,
          borderWidth: success ? 0 : 1,
          borderColor: huddleUIKitColors.border,
        },
        style,
      ]}
    >
      {success ? <OnlineDot size={13} /> : <HuddleIcon name="info" size={20} />}
      <Text
        style={{
          flex: 1,
          color: huddleUIKitColors.textPrimary,
          fontFamily: huddleUIKitTypography.medium,
          fontSize: 14,
        }}
      >
        {children}
      </Text>
    </View>
  );
}

export function RoomCodeTile({ character }: { readonly character: string }) {
  const size = Platform.isTV ? 76 : 54;

  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: huddleUIKitColors.surface,
        borderWidth: 1,
        borderColor: huddleUIKitColors.border,
        borderRadius: huddleUIKitRadius.sm,
        ...huddleUIKitShadow,
      }}
    >
      <Text
        style={{
          fontSize: Platform.isTV ? 34 : 26,
          color: huddleUIKitColors.navy,
          fontFamily: huddleUIKitTypography.bold,
        }}
      >
        {character.toUpperCase()}
      </Text>
    </View>
  );
}

export function RoomCode({ code }: { readonly code: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: Platform.isTV ? 14 : 8 }}>
      {code.split('').map((character, index) => (
        <RoomCodeTile key={`${character}-${index}`} character={character} />
      ))}
    </View>
  );
}

export function PageDots({
  count = 5,
  activeIndex = 2,
  style,
  dotStyle,
  activeDotStyle,
}: {
  readonly count?: number;
  readonly activeIndex?: number;
  readonly style?: StyleProp<ViewStyle>;
  readonly dotStyle?: StyleProp<ViewStyle>;
  readonly activeDotStyle?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 12 }, style]}>
      {Array.from({ length: count }, (_, index) => {
        const active = index === activeIndex;
        return (
          <View
            key={index}
            style={[
              {
                width: active ? 13 : 11,
                height: active ? 13 : 11,
                borderRadius: huddleUIKitRadius.pill,
                backgroundColor: active ? huddleUIKitColors.orange : huddleUIKitColors.dotInactive,
              },
              active ? activeDotStyle : dotStyle,
            ]}
          />
        );
      })}
    </View>
  );
}

export function InfoChip({
  icon,
  label,
  style,
}: {
  readonly icon: HuddleIconName;
  readonly label: string;
  readonly style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderRadius: huddleUIKitRadius.sm,
          borderWidth: 1,
          borderColor: huddleUIKitColors.border,
          backgroundColor: huddleUIKitColors.surface,
          ...huddleUIKitShadow,
        },
        style,
      ]}
    >
      <HuddleIcon name={icon} size={18} />
      <Text
        style={{
          color: huddleUIKitColors.textPrimary,
          fontFamily: huddleUIKitTypography.medium,
          fontSize: 14,
        }}
      >
        {label}
      </Text>
    </View>
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
            accessibilityState={{ selected }}
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
}: {
  readonly icon: 'plus' | 'minus';
  readonly onPress: () => void;
  readonly disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
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

export function PrimaryButton({ label, onPress, disabled }: ButtonProps) {
  const [focused, setFocused] = useState(false);

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
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

export function SecondaryButton({ label, onPress, disabled }: ButtonProps) {
  const [focused, setFocused] = useState(false);

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
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

export function PhoneBrowsingHelper({ name }: { readonly name: string }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        paddingHorizontal: 18,
        paddingVertical: 14,
        borderRadius: huddleUIKitRadius.sm,
        backgroundColor: huddleUIKitColors.infoBackground,
        borderWidth: 1,
        borderColor: huddleUIKitColors.border,
      }}
    >
      <HuddleIcon name="phone" size={Platform.isTV ? 34 : 24} />
      <Text
        style={{
          color: huddleUIKitColors.textPrimary,
          fontFamily: huddleUIKitTypography.medium,
          fontSize: Platform.isTV ? 20 : 16,
        }}
      >
        {name} is browsing on their phone.
      </Text>
    </View>
  );
}

export function JoinCountRow({
  joined,
  total,
  hostName,
  note,
  style,
}: {
  readonly joined: number;
  readonly total: number;
  readonly hostName?: string;
  readonly note?: string;
  readonly style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' }, style]}>
      <HuddleIcon name="players" size={Platform.isTV ? 34 : 26} />
      <Text
        style={{
          color: huddleUIKitColors.orange,
          fontFamily: huddleUIKitTypography.bold,
          fontSize: Platform.isTV ? 22 : 18,
        }}
      >
        {joined}
      </Text>
      <Text
        style={{
          color: huddleUIKitColors.textPrimary,
          fontFamily: huddleUIKitTypography.medium,
          fontSize: Platform.isTV ? 20 : 16,
        }}
      >
        of {total} joined{note === undefined && hostName === undefined ? '' : ` — ${note ?? `${hostName} can start whenever`}`}
      </Text>
    </View>
  );
}

export function SectionDivider({ label, style }: { readonly label: string; readonly style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 18, width: '100%' }, style]}>
      <View style={{ flex: 1, height: 1, backgroundColor: huddleUIKitColors.borderStrong }} />
      <Text
        style={{
          color: huddleUIKitColors.textMuted,
          fontFamily: huddleUIKitTypography.semibold,
          fontSize: Platform.isTV ? 18 : 14,
        }}
      >
        {label.toUpperCase()}
      </Text>
      <View style={{ flex: 1, height: 1, backgroundColor: huddleUIKitColors.borderStrong }} />
    </View>
  );
}

export function UtilityActionButton({
  action,
  onPress,
}: {
  readonly action: 'check' | 'plus' | 'minus' | 'remove';
  readonly onPress?: () => void;
}) {
  if (action === 'remove') {
    return (
      <Pressable onPress={onPress} hitSlop={8} style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1, padding: 8 })}>
        <HuddleIcon name="remove" size={23} />
      </Pressable>
    );
  }

  const checked = action === 'check';
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        width: 40,
        height: 40,
        borderRadius: huddleUIKitRadius.pill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: huddleUIKitColors.surface,
        borderWidth: 1,
        borderColor: huddleUIKitColors.border,
        opacity: pressed ? 0.75 : 1,
        ...huddleUIKitShadow,
      })}
    >
      {checked ? (
        <View
          pointerEvents="none"
          style={{
            width: 23,
            height: 23,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: huddleUIKitColors.orange,
          }}
        >
          <HuddleIcon name="check" size={15} color={huddleUIKitColors.surface} strokeWidth={3} />
        </View>
      ) : (
        <HuddleIcon name={action} size={21} />
      )}
    </Pressable>
  );
}

export function IconGallery() {
  const primaryUtilityIconNames: HuddleIconName[] = [
    'players',
    'clock',
    'category',
    'questions',
    'difficulty',
    'trophy',
    'phone',
    'host',
    'qr',
  ];

  return (
    <View style={{ gap: 20 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 20 }}>
        {primaryUtilityIconNames.map((name) => (
          <View key={name} style={{ width: 72, alignItems: 'center', gap: 8 }}>
            <HuddleIcon name={name} size={30} />
            <Text
              style={{
                color: huddleUIKitColors.textPrimary,
                fontFamily: huddleUIKitTypography.medium,
                fontSize: 11,
                textAlign: 'center',
              }}
            >
              {name}
            </Text>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 24 }}>
        {(['check', 'plus', 'minus', 'remove'] as const).map((action) => (
          <View key={action} style={{ alignItems: 'center', gap: 7 }}>
            <UtilityActionButton action={action} />
            <Text
              style={{
                color: huddleUIKitColors.textPrimary,
                fontFamily: huddleUIKitTypography.medium,
                fontSize: 11,
              }}
            >
              {action}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
