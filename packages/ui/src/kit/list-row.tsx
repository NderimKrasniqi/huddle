import { Platform, Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { HuddleIcon } from './icon';
import { kitStyles } from './styles';
import { huddleUIKitColors, huddleUIKitRadius, huddleUIKitTypography } from './theme';

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
    <View style={[kitStyles.wrapRow, { gap: 12 }, style]}>
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

export function SectionDivider({
  label,
  style,
}: {
  readonly label: string;
  readonly style?: StyleProp<ViewStyle>;
}) {
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
