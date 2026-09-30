import {
  playroomColors,
  playroomEasing,
  playroomFonts,
  playroomMotion,
  playroomPhone,
  playroomRadii,
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
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming, ReduceMotion } from 'react-native-reanimated';

import { PlayroomBurst, PlayroomText } from './playroom-text';

/**
 * `primary` orange with ink text, the screen's main action; `secondary`
 * surface with an ink border; `lavender` for a quieter action such as Make
 * host; `destructive` outlined in danger red; `link` for quiet exits such as
 * Leave room.
 */
export type PlayroomButtonVariant = 'primary' | 'secondary' | 'lavender' | 'destructive' | 'link';

export type PlayroomButtonProps = {
  readonly label: string;
  readonly onPress?: PressableProps['onPress'];
  readonly variant?: PlayroomButtonVariant;
  readonly disabled?: boolean;
  /** Loading keeps the button's width and ignores further presses. */
  readonly busy?: boolean;
  /** Burst dashes beside the button, for the screen's main action. */
  readonly bursts?: boolean;
  readonly accessibilityLabel?: string;
  readonly accessibilityHint?: string;
  readonly style?: StyleProp<ViewStyle>;
  readonly testID?: string;
};

/** A phone action with default, pressed, disabled, and loading states. */
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
  const tone = disabled && variant !== 'link' ? TONES.disabled : TONES[variant];
  // Feedback on press-in, commit on press-out.
  const scale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  const pressTo = (value: number) => {
    scale.set(withTiming(value, { duration: playroomMotion.press, reduceMotion: ReduceMotion.System, easing: Easing.bezier(...playroomEasing.out) }));
  };

  const button = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy }}
      disabled={inactive}
      onPress={onPress}
      onPressIn={() => pressTo(playroomMotion.pressScale)}
      onPressOut={() => pressTo(1)}
      pressRetentionOffset={16}
      hitSlop={variant === 'link' ? 8 : undefined}
      testID={testID}
      style={bursts ? null : style}
    >
      <Animated.View style={[variant === 'link' ? styles.link : styles.button, tone.container, pressStyle]}>
        {/* The label keeps its space while loading, so the width never jumps. */}
        <PlayroomText color={tone.text} style={[variant === 'link' ? styles.linkText : styles.label, busy ? styles.hidden : null]}>
          {label}
        </PlayroomText>
        {busy ? <ActivityIndicator color={playroomColors[tone.text]} style={styles.spinner} /> : null}
      </Animated.View>
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

const TONES = {
  primary: { container: { backgroundColor: playroomColors.orange, borderBottomWidth: 3, borderBottomColor: 'rgba(45, 11, 78, 0.18)' }, text: 'ink' as const },
  secondary: {
    container: { backgroundColor: playroomColors.surface, borderWidth: 1, borderColor: playroomColors.border },
    text: 'ink' as const,
  },
  lavender: { container: { backgroundColor: playroomColors.lavender }, text: 'ink' as const },
  destructive: {
    container: { backgroundColor: playroomColors.surface, borderWidth: 2, borderColor: playroomColors.danger },
    text: 'danger' as const,
  },
  link: { container: null, text: 'muted' as const },
  disabled: { container: { backgroundColor: playroomColors.disabled }, text: 'muted' as const },
};

const styles = StyleSheet.create({
  button: {
    minHeight: playroomPhone.buttonHeight,
    borderRadius: playroomRadii.button,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  link: {
    minHeight: playroomPhone.minTarget,
    alignSelf: 'center',
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { ...playroomPhone.type.label, fontFamily: playroomFonts.strong, textAlign: 'center' },
  linkText: { ...playroomPhone.type.label, textAlign: 'center' },
  hidden: { opacity: 0 },
  spinner: { position: 'absolute' },
  burstRow: { flexDirection: 'row', alignItems: 'center' },
  burstButton: { flex: 1, marginHorizontal: 4 },
});
