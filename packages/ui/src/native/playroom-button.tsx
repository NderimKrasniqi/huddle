import {
  playroomColors,
  playroomPhone,
  playroomShadows,
} from '@huddle/design-tokens';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { PlayroomBurst, PlayroomText } from './playroom-text';

export type PlayroomButtonVariant = 'primary' | 'secondary' | 'soft' | 'danger' | 'link';

export type PlayroomButtonProps = {
  readonly label: string;
  readonly onPress?: PressableProps['onPress'];
  readonly variant?: PlayroomButtonVariant;
  readonly disabled?: boolean;
  readonly busy?: boolean;
  /** Burst dashes beside the button; the concept uses them on the main action. */
  readonly bursts?: boolean;
  readonly accessibilityLabel?: string;
  readonly accessibilityHint?: string;
  readonly style?: StyleProp<ViewStyle>;
  readonly testID?: string;
};

/**
 * Phone action. One orange `primary` per screen; `secondary` (strong lavender)
 * and `soft` (lavender) for the rest, `danger` for removal, `link` for quiet
 * exits such as Leave room.
 */
export function PlayroomButton({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  busy = false,
  bursts = false,
  accessibilityLabel,
  accessibilityHint,
  style,
  testID,
}: PlayroomButtonProps) {
  const inactive = disabled || busy;
  const tone = inactive && variant === 'primary' ? toneFor('disabled') : toneFor(variant);
  const button = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy }}
      disabled={inactive}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        variant === 'link' ? styles.link : styles.button,
        tone.container,
        pressed && !inactive ? styles.pressed : null,
        bursts ? null : style,
      ]}
    >
      {busy ? <ActivityIndicator color={tone.spinner} style={styles.spinner} /> : null}
      <PlayroomText color={tone.text} style={variant === 'link' ? styles.linkText : styles.label}>
        {label}
      </PlayroomText>
    </Pressable>
  );
  if (!bursts) return button;
  return (
    <View style={[styles.burstRow, style]}>
      <PlayroomBurst size={24} side="left" />
      <View style={styles.burstButton}>{button}</View>
      <PlayroomBurst size={24} side="right" />
    </View>
  );
}

function toneFor(variant: PlayroomButtonVariant | 'disabled') {
  switch (variant) {
    case 'primary':
      return { container: [styles.primary, playroomShadows.action], text: 'card' as const, spinner: playroomColors.card };
    case 'secondary':
      return { container: styles.secondary, text: 'ink' as const, spinner: playroomColors.ink };
    case 'soft':
      return { container: styles.soft, text: 'ink' as const, spinner: playroomColors.ink };
    case 'danger':
      return { container: styles.danger, text: 'red' as const, spinner: playroomColors.red };
    case 'link':
      return { container: null, text: 'muted' as const, spinner: playroomColors.muted };
    case 'disabled':
      return { container: styles.disabled, text: 'soonText' as const, spinner: playroomColors.soonText };
  }
}

const styles = StyleSheet.create({
  button: {
    minHeight: playroomPhone.buttonHeight,
    borderRadius: playroomPhone.radius.pill,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  link: {
    minHeight: 44,
    alignSelf: 'center',
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: { backgroundColor: playroomColors.orange },
  secondary: { backgroundColor: playroomColors.lavenderStrong },
  soft: { backgroundColor: playroomColors.lavender },
  danger: { backgroundColor: 'transparent', borderWidth: 2, borderColor: playroomColors.red },
  disabled: { backgroundColor: playroomColors.soonGrey },
  pressed: { transform: [{ scale: 0.97 }] },
  label: { ...playroomPhone.type.button, textAlign: 'center' },
  linkText: { ...playroomPhone.type.body, textAlign: 'center' },
  spinner: { marginRight: 8 },
  burstRow: { flexDirection: 'row', alignItems: 'center' },
  burstButton: { flex: 1, marginHorizontal: 4 },
});
