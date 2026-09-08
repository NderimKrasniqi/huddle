import { radii, semanticColors, shadows, spacing, typography } from '@huddle/design-tokens';
import type { ReactNode } from 'react';
import { HuddleText } from './huddle-text';
import { Pressable, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

export type ChipProps = Omit<PressableProps, 'children' | 'disabled' | 'onPress' | 'style'> & {
  readonly label: string;
  readonly selected?: boolean;
  readonly disabled?: boolean;
  readonly icon?: ReactNode;
  readonly onPress?: PressableProps['onPress'];
  readonly style?: StyleProp<ViewStyle>;
};

/** Filter/mode chip with a visible selected cue and native state semantics. */
export function Chip({
  label,
  selected = false,
  disabled = false,
  icon,
  onPress,
  style,
  testID,
  ...pressableProps
}: ChipProps) {
  const content = (
    <>
      {selected ? <HuddleText variant="caption" color="text">✓</HuddleText> : icon}
      <HuddleText variant="caption" color={selected ? 'primaryText' : 'text'} style={styles.label}>
        {label}
      </HuddleText>
    </>
  );
  const chipStyle = [styles.chip, selected ? styles.selected : styles.unselected, disabled ? styles.disabled : null, style];

  if (onPress === undefined) {
    return <View testID={testID} pointerEvents="none" focusable={false} accessible accessibilityRole="text" accessibilityLabel={label} style={chipStyle}>{content}</View>;
  }

  return (
    <Pressable
      {...pressableProps}
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected }}
      style={({ pressed }) => [chipStyle, pressed && !disabled ? styles.pressed : null]}
    >
      {content}
    </Pressable>
  );
}

const styles = {
  chip: {
    minHeight: 36,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  } satisfies ViewStyle,
  unselected: {
    backgroundColor: semanticColors.surface,
    borderColor: semanticColors.border,
    ...shadows.none,
  } satisfies ViewStyle,
  selected: {
    backgroundColor: semanticColors.primary,
    borderColor: semanticColors.primary,
    ...shadows.card,
  } satisfies ViewStyle,
  disabled: {
    opacity: 0.46,
  } satisfies ViewStyle,
  pressed: {
    opacity: 0.82,
  } satisfies ViewStyle,
  label: {
    ...typography.caption,
  },
} as const;
