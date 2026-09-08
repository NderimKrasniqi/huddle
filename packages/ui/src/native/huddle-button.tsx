import {
  radii,
  semanticColors,
  shadows,
  spacing,
  typography,
} from '@huddle/design-tokens';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  View,
  type PressableProps,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { HuddleText } from './huddle-text';

export type HuddleButtonVariant = 'primary' | 'secondary' | 'destructive' | 'ghost';

export type HuddleButtonProps = Omit<
  PressableProps,
  'accessibilityLabel' | 'children' | 'disabled' | 'onPress' | 'style'
> & {
  readonly title?: string;
  readonly children?: ReactNode;
  readonly variant?: HuddleButtonVariant;
  readonly busy?: boolean;
  readonly disabled?: boolean;
  /** Set false for passive TV renderers; no focus or press target is emitted. */
  readonly interactive?: boolean;
  readonly accessibilityLabel?: string;
  readonly onPress?: PressableProps['onPress'];
  readonly style?: StyleProp<ViewStyle>;
};

const variantStyles = {
  primary: {
    backgroundColor: semanticColors.primary,
    borderColor: semanticColors.primary,
    color: 'primaryText' as const,
    shadow: shadows.card,
  },
  secondary: {
    backgroundColor: semanticColors.surface,
    borderColor: semanticColors.border,
    color: 'text' as const,
    shadow: shadows.card,
  },
  destructive: {
    backgroundColor: semanticColors.highlight,
    borderColor: semanticColors.highlight,
    color: 'textOnBrand' as const,
    shadow: shadows.card,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderColor: semanticColors.border,
    color: 'text' as const,
    shadow: shadows.none,
  },
} as const;

/** Accessible, token-backed button with explicit passive-TV support. */
export function HuddleButton({
  title,
  children,
  variant = 'primary',
  busy = false,
  disabled = false,
  interactive = true,
  accessibilityLabel,
  accessibilityHint,
  accessibilityState,
  onPress,
  style,
  testID,
  ...pressableProps
}: HuddleButtonProps) {
  const buttonDisabled = disabled || busy;
  const recipe = variantStyles[variant];
  const content = (
    <>
      {busy ? <ActivityIndicator color={semanticColors[recipe.color]} size="small" accessible={false} /> : null}
      {title !== undefined ? (
        <HuddleText variant="body" color={recipe.color} style={styles.label}>
          {title}
        </HuddleText>
      ) : (
        children
      )}
    </>
  );

  if (!interactive) {
    return (
      <View pointerEvents="none" focusable={false} accessible={false} testID={testID} style={[styles.button, styles.passive, { backgroundColor: recipe.backgroundColor, borderColor: recipe.borderColor }, style]}>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      {...pressableProps}
      testID={testID}
      onPress={onPress}
      disabled={buttonDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{
        ...accessibilityState,
        disabled: buttonDisabled,
        busy,
      }}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: recipe.backgroundColor,
          borderColor: recipe.borderColor,
          ...recipe.shadow,
        },
        pressed && !buttonDisabled ? styles.pressed : null,
        buttonDisabled ? styles.disabled : null,
        style,
      ]}
    >
      {content}
    </Pressable>
  );
}

const styles = {
  button: {
    minHeight: 44,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  } satisfies ViewStyle,
  label: {
    ...typography.body,
    fontWeight: typography.caption.fontWeight,
    textAlign: 'center',
  } satisfies TextStyle,
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.98 }],
  } satisfies ViewStyle,
  disabled: {
    opacity: 0.48,
    shadowOpacity: 0,
    elevation: 0,
  } satisfies ViewStyle,
  passive: {
    opacity: 1,
  } satisfies ViewStyle,
} as const;
