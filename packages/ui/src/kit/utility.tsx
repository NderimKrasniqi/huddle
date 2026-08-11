import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { HuddleIcon, type HuddleIconName } from './icon';
import { huddleUIKitColors, huddleUIKitRadius, huddleUIKitShadow, huddleUIKitTypography } from './theme';

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

export function UtilityActionButton({
  action,
  onPress,
}: {
  readonly action: 'check' | 'plus' | 'minus' | 'remove';
  readonly onPress?: () => void;
}) {
  const accessibilityLabel = {
    check: 'Confirm',
    plus: 'Increase value',
    minus: 'Decrease value',
    remove: 'Remove',
  }[action];

  if (action === 'remove') {
    return (
      <Pressable
        onPress={onPress}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled: onPress === undefined }}
        focusable={onPress !== undefined}
        style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1, padding: 8 })}
      >
        <HuddleIcon name="remove" size={23} />
      </Pressable>
    );
  }

  const checked = action === 'check';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: checked, disabled: onPress === undefined }}
      focusable={onPress !== undefined}
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
