import { semanticColors, spacing } from '@huddle/design-tokens';
import type { PropsWithChildren } from 'react';
import { View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';

export type ScreenShellProps = PropsWithChildren<
  Omit<ViewProps, 'style'> & {
    /** Semantic surface role used for the canvas background. */
    readonly tone?: keyof typeof semanticColors;
    /** TV compositions use a slightly roomier default gutter. */
    readonly platform?: 'phone' | 'tv';
    readonly style?: StyleProp<ViewStyle>;
  }
>;

/** Shared canvas that keeps Phone and TV surfaces on the Heartbeat rhythm. */
export function ScreenShell({
  children,
  tone = 'background',
  platform = 'phone',
  style,
  ...viewProps
}: ScreenShellProps) {
  return (
    <View
      {...viewProps}
      style={[
        styles.root,
        platform === 'tv' ? styles.tvGutter : styles.phoneGutter,
        { backgroundColor: semanticColors[tone] },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = {
  root: {
    flex: 1,
  } satisfies ViewStyle,
  phoneGutter: {
    paddingHorizontal: spacing.lg,
  } satisfies ViewStyle,
  tvGutter: {
    paddingHorizontal: spacing['3xl'],
  } satisfies ViewStyle,
} as const;
