import { radii, semanticColors, spacing, typography } from '@huddle/design-tokens';
import { HuddleText } from './huddle-text';
import { View, type StyleProp, type ViewStyle } from 'react-native';

export type HuddleBadgeTone = 'host' | 'ready' | 'away' | 'comingSoon' | 'neutral' | 'error';

export type BadgeProps = {
  readonly label: string;
  readonly tone?: HuddleBadgeTone;
  readonly testID?: string;
  readonly style?: StyleProp<ViewStyle>;
};

const toneStyles: Record<HuddleBadgeTone, { backgroundColor: string; color: keyof typeof semanticColors }> = {
  host: { backgroundColor: semanticColors.secondary, color: 'text' },
  ready: { backgroundColor: semanticColors.success, color: 'text' },
  away: { backgroundColor: semanticColors.highlight, color: 'text' },
  comingSoon: { backgroundColor: semanticColors.accent, color: 'text' },
  neutral: { backgroundColor: semanticColors.surfaceRaised, color: 'text' },
  error: { backgroundColor: semanticColors.highlight, color: 'text' },
};

/** Compact status label; tone is always paired with visible copy. */
export function Badge({ label, tone = 'neutral', testID, style }: BadgeProps) {
  const recipe = toneStyles[tone];
  return (
    <View
      testID={testID}
      accessible
      focusable={false}
      accessibilityRole="text"
      accessibilityLabel={label}
      style={[styles.badge, { backgroundColor: recipe.backgroundColor }, style]}
    >
      <HuddleText variant="caption" color={recipe.color} style={styles.label}>{label}</HuddleText>
    </View>
  );
}

const styles = {
  badge: {
    minHeight: 24,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  } satisfies ViewStyle,
  label: {
    ...typography.caption,
  },
} as const;
