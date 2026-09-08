import { radii, semanticColors, shadows, spacing } from '@huddle/design-tokens';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { HuddleButton, type HuddleButtonVariant } from './huddle-button';
import { HuddleText } from './huddle-text';
import { LoadingMark } from './loading-mark';
import { ScreenShell } from './screen-shell';

export type StatusSurfaceVariant =
  | 'loading'
  | 'error'
  | 'paused'
  | 'unavailable'
  | 'finished'
  | 'seatLost'
  | 'success'
  | 'info';

export type StatusSurfaceAction = {
  readonly label: string;
  readonly onPress: () => void;
  readonly variant?: HuddleButtonVariant;
  readonly busy?: boolean;
  readonly disabled?: boolean;
};

export type StatusSurfaceProps = {
  readonly title: string;
  readonly message?: string;
  readonly variant?: StatusSurfaceVariant;
  readonly platform?: 'phone' | 'tv';
  readonly systemFont?: boolean;
  readonly action?: StatusSurfaceAction;
  readonly testID?: string;
  readonly style?: StyleProp<ViewStyle>;
};

const statusRecipes: Record<StatusSurfaceVariant, { accent: keyof typeof semanticColors; symbol: string }> = {
  loading: { accent: 'accent', symbol: '' },
  error: { accent: 'highlight', symbol: '!' },
  paused: { accent: 'secondary', symbol: 'Ⅱ' },
  unavailable: { accent: 'highlight', symbol: '!' },
  finished: { accent: 'success', symbol: '✓' },
  seatLost: { accent: 'highlight', symbol: '!' },
  success: { accent: 'success', symbol: '✓' },
  info: { accent: 'info', symbol: 'i' },
};

/** Branded recovery/status surface for loading and authoritative runtime states. */
export function StatusSurface({
  title,
  message,
  variant = 'info',
  platform = 'phone',
  systemFont = false,
  action,
  testID,
  style,
}: StatusSurfaceProps) {
  const recipe = statusRecipes[variant];
  const isLoading = variant === 'loading';
  return (
    <ScreenShell platform={platform} testID={testID} focusable={false} style={[styles.shell, style]}>
      <View
        accessible={false}
        focusable={false}
        pointerEvents="box-none"
        style={styles.content}
      >
        <View
          testID={testID ? `${testID}-announcement` : undefined}
          accessible
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          accessibilityLabel={[title, message].filter(Boolean).join('. ')}
          focusable={false}
          style={styles.announcement}
        >
          {isLoading ? (
            <LoadingMark testID={testID ? `${testID}-mark` : undefined} />
          ) : (
            <View focusable={false} style={[styles.symbol, { backgroundColor: semanticColors[recipe.accent] }]}>
              <HuddleText variant="title" color="text" systemFont={systemFont} accessibilityLabel={`${variant} status`}>{recipe.symbol}</HuddleText>
            </View>
          )}
          <HuddleText variant={platform === 'tv' ? 'tvDisplay' : 'display'} color="text" systemFont={systemFont} align="center">
            {title}
          </HuddleText>
          {message ? <HuddleText variant="bodyLarge" color="text" systemFont={systemFont} align="center">{message}</HuddleText> : null}
        </View>
        {platform === 'phone' && action ? (
          <HuddleButton
            title={action.label}
            variant={action.variant ?? 'primary'}
            onPress={action.onPress}
            busy={action.busy}
            disabled={action.disabled}
            accessibilityLabel={action.label}
            style={styles.action}
          />
        ) : null}
      </View>
    </ScreenShell>
  );
}

const styles = {
  shell: {
    alignItems: 'center',
    justifyContent: 'center',
  } satisfies ViewStyle,
  content: {
    width: '100%',
    maxWidth: 520,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    padding: spacing.xl,
    borderRadius: radii.xl,
    backgroundColor: semanticColors.surfaceRaised,
    ...shadows.card,
  } satisfies ViewStyle,
  announcement: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  } satisfies ViewStyle,
  symbol: {
    width: 56,
    height: 56,
    borderRadius: radii.round,
    alignItems: 'center',
    justifyContent: 'center',
  } satisfies ViewStyle,
  action: {
    minWidth: 180,
  } satisfies ViewStyle,
} as const;
