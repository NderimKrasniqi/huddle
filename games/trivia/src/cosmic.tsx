import { useEffect, useState, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  Text,
  View,
  type StyleProp,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { MASCOT_ASPECT, TRIVIA_ART } from './art';

/**
 * Cosmic Quiz: Trivia's own look. The colours and type live here, inside the
 * game, so Trivia never depends on the platform's design tokens; only the
 * Nunito faces are shared, because both apps already load them.
 *
 * Everything is drawn natively — panels, answer tiles, badges and pills are
 * views with real text — so labels scale, read aloud and never pixelate. Only
 * the logo, mascot and starfield are images.
 */
export const cosmic = {
  navy: '#041B39',
  navyDeep: '#021226',
  cream: '#FFF8EB',
  turquoise: '#79E1DE',
  butter: '#FFDB74',
  coral: '#FFA095',
  periwinkle: '#B9AAFB',
  muted: '#5B6B82',
  correct: '#1E7A55',
  missed: '#6B7891',
} as const;

/** A, B, C and D always wear the same colour on both screens. */
export const ANSWER_TONES = [cosmic.turquoise, cosmic.butter, cosmic.coral, cosmic.periwinkle] as const;

export function answerTone(optionIndex: number): string {
  return ANSWER_TONES[optionIndex % ANSWER_TONES.length] ?? cosmic.turquoise;
}

export function answerLetter(optionIndex: number): string {
  return String.fromCharCode(65 + optionIndex);
}

export const cosmicFont = {
  regular: 'Nunito_400Regular',
  bold: 'Nunito_700Bold',
  extraBold: 'Nunito_800ExtraBold',
  black: 'Nunito_900Black',
} as const;

type Weight = keyof typeof cosmicFont;

/** Text in a Nunito weight, sized and coloured by the caller. */
export function CosmicText({
  weight = 'bold',
  size,
  color = cosmic.navy,
  align,
  tracking,
  style,
  children,
  ...props
}: TextProps & {
  readonly weight?: Weight;
  readonly size: number;
  readonly color?: string;
  readonly align?: TextStyle['textAlign'];
  /** Letter spacing for the small caps labels ("QUESTION 3 OF 10"). */
  readonly tracking?: number;
  readonly style?: StyleProp<TextStyle>;
  readonly children?: ReactNode;
}) {
  return (
    <Text
      {...props}
      style={[
        {
          fontFamily: cosmicFont[weight],
          fontSize: size,
          lineHeight: Math.round(size * 1.18),
          color,
          textAlign: align,
          letterSpacing: tracking,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

/** A rounded pill: "10 QUESTIONS", "12s", "Next question in 30s". */
export function Pill({
  children,
  color = cosmic.butter,
  style,
  testID,
}: {
  readonly children: ReactNode;
  readonly color?: string;
  readonly style?: StyleProp<ViewStyle>;
  readonly testID?: string;
}) {
  return (
    <View style={[{ backgroundColor: color, borderRadius: 999, alignItems: 'center', justifyContent: 'center' }, style]} testID={testID}>
      {children}
    </View>
  );
}

/** The navy disc carrying an answer's letter. */
export function LetterBadge({ optionIndex, size }: { readonly optionIndex: number; readonly size: number }) {
  return (
    <View
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: cosmic.navy, alignItems: 'center', justifyContent: 'center' }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <CosmicText weight="black" size={Math.round(size * 0.48)} color={cosmic.cream} style={{ lineHeight: Math.round(size * 0.6) }}>
        {answerLetter(optionIndex)}
      </CosmicText>
    </View>
  );
}

/** A tick in a circle: the reveal's "this one" and a round result's "Correct". */
export function CheckBadge({ size, color = cosmic.correct }: { readonly size: number; readonly color?: string }) {
  return (
    <View
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View
        style={{
          width: size * 0.46,
          height: size * 0.24,
          borderLeftWidth: Math.max(2, size * 0.1),
          borderBottomWidth: Math.max(2, size * 0.1),
          borderColor: cosmic.cream,
          transform: [{ translateY: -size * 0.05 }, { rotate: '-45deg' }],
        }}
      />
    </View>
  );
}

/** A cross in a circle: a round result's "Missed". */
export function MissBadge({ size }: { readonly size: number }) {
  const bar = { position: 'absolute' as const, width: size * 0.5, height: Math.max(2, size * 0.1), borderRadius: 2, backgroundColor: cosmic.cream };
  return (
    <View
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: cosmic.missed, alignItems: 'center', justifyContent: 'center' }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={[bar, { transform: [{ rotate: '45deg' }] }]} />
      <View style={[bar, { transform: [{ rotate: '-45deg' }] }]} />
    </View>
  );
}

/** A padlock drawn in views: the phone's "Answer locked!". */
export function LockMark({ size }: { readonly size: number }) {
  const body = size * 0.46;
  return (
    <View
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: cosmic.turquoise, alignItems: 'center', justifyContent: 'center' }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View
        style={{
          width: body * 0.66,
          height: body * 0.5,
          borderWidth: body * 0.14,
          borderBottomWidth: 0,
          borderColor: cosmic.navy,
          borderTopLeftRadius: body,
          borderTopRightRadius: body,
          marginBottom: -1,
        }}
      />
      <View style={{ width: body, height: body * 0.78, borderRadius: body * 0.16, backgroundColor: cosmic.navy, alignItems: 'center', paddingTop: body * 0.22 }}>
        <View style={{ width: body * 0.16, height: body * 0.3, borderRadius: body * 0.08, backgroundColor: cosmic.turquoise }} />
      </View>
    </View>
  );
}

/** The countdown ring: a cream disc in a turquoise ring, a big navy number. */
export function CountdownRing({ seconds, size }: { readonly seconds: number; readonly size: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: cosmic.cream,
        borderWidth: size * 0.085,
        borderColor: cosmic.turquoise,
        alignItems: 'center',
        justifyContent: 'center',
      }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <CosmicText weight="black" size={Math.round(size * 0.5)} align="center" style={{ lineHeight: Math.round(size * 0.6) }}>
        {seconds}
      </CosmicText>
    </View>
  );
}

/** The Cosmic Quiz logo; `on` is the background it sits on. */
export function Logo({ width, on }: { readonly width: number; readonly on: 'dark' | 'light' }) {
  return (
    <Image
      source={on === 'dark' ? TRIVIA_ART.logoDark : TRIVIA_ART.logoLight}
      style={{ width, height: width / 2 }}
      resizeMode="contain"
      accessible
      accessibilityRole="image"
      accessibilityLabel="Trivia, Cosmic Quiz"
    />
  );
}

export type MascotPose = keyof typeof MASCOT_ASPECT;

/** The alien mascot, sized by width. Decorative. */
export function Mascot({
  pose,
  width,
  style,
  reduceMotion,
}: {
  readonly pose: MascotPose;
  readonly width: number;
  readonly style?: StyleProp<ViewStyle>;
  readonly reduceMotion: boolean | undefined;
}) {
  const bob = useLoop(reduceMotion !== false, 2400);
  const translateY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -width * 0.025] });
  return (
    <Animated.View style={[style, { transform: [{ translateY }] }]} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Image source={TRIVIA_ART.mascot[pose]} style={{ width, height: width / MASCOT_ASPECT[pose] }} resizeMode="contain" accessible={false} />
    </Animated.View>
  );
}

/** A four-point twinkle, drawn as text so it needs no asset. Decorative. */
export function Twinkle({ size, color = cosmic.butter, style }: { readonly size: number; readonly color?: string; readonly style?: StyleProp<TextStyle> }) {
  return (
    <CosmicText weight="black" size={size} color={color} style={[{ position: 'absolute' }, style]} accessibilityElementsHidden importantForAccessibility="no">
      ✦
    </CosmicText>
  );
}

/**
 * Whether the device asks for less motion: `undefined` until it has answered,
 * then the setting, following it as it changes. Entrances wait for the answer
 * so the first screen animates for those who want motion and never for those
 * who don't; idle motion treats "unknown" as "reduce".
 */
export function useReducedMotion(): boolean | undefined {
  const [reduce, setReduce] = useState<boolean | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (alive) setReduce(value);
      })
      .catch(() => {
        if (alive) setReduce(false);
      });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      alive = false;
      subscription.remove();
    };
  }, []);
  return reduce;
}

/** A 0→1→0 loop for gentle idle motion; held at 0 when motion is reduced. */
function useLoop(reduceMotion: boolean, periodMs: number): Animated.Value {
  const value = useState(() => new Animated.Value(0))[0];
  useEffect(() => {
    if (reduceMotion) {
      value.setValue(0);
      return;
    }
    const half = { duration: periodMs / 2, easing: Easing.inOut(Easing.sin), useNativeDriver: true };
    const loop = Animated.loop(Animated.sequence([Animated.timing(value, { toValue: 1, ...half }), Animated.timing(value, { toValue: 0, ...half })]));
    loop.start();
    return () => loop.stop();
  }, [periodMs, reduceMotion, value]);
  return value;
}

/**
 * Fades and lifts its children in once, after `delay`. With reduced motion the
 * children are simply there. Re-keying the element replays it.
 */
export function Enter({
  children,
  delay = 0,
  from = 24,
  scale = 1,
  reduceMotion,
  style,
  testID,
}: {
  readonly children: ReactNode;
  readonly delay?: number;
  /** Distance travelled upward, in the screen's own units. */
  readonly from?: number;
  /** Starting scale, for a pop rather than a lift. */
  readonly scale?: number;
  readonly reduceMotion: boolean | undefined;
  readonly style?: StyleProp<ViewStyle>;
  readonly testID?: string;
}) {
  const progress = useState(() => new Animated.Value(reduceMotion === true ? 1 : 0))[0];
  useEffect(() => {
    // Hold until the device says whether it wants motion.
    if (reduceMotion === undefined) return;
    if (reduceMotion) {
      progress.setValue(1);
      return;
    }
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 420,
      delay,
      easing: Easing.out(Easing.back(1.4)),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [delay, progress, reduceMotion]);
  return (
    <Animated.View
      testID={testID}
      style={[
        style,
        {
          opacity: progress.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1] }),
          transform: [
            { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [from, 0] }) },
            { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [scale, 1] }) },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/**
 * A display countdown for the beat the room is on. The server's deadline moves
 * the game; this only draws the seconds, starting synchronously from the room's
 * remainder so a new beat never flashes the previous one's number.
 */
export function useCountdownSeconds(clockRemainingMs: number | undefined, fallbackSeconds: number, beat: string): number {
  const rawStartingMs = clockRemainingMs ?? fallbackSeconds * 1000;
  const startingMs = Number.isFinite(rawStartingMs) ? Math.max(0, rawStartingMs) : Math.max(0, fallbackSeconds * 1000);
  const initial = Math.max(0, Math.ceil(startingMs / 1000));
  const [display, setDisplay] = useState({ beat, startingMs, seconds: initial });
  const seconds = display.beat === beat && display.startingMs === startingMs ? display.seconds : initial;

  useEffect(() => {
    const startedAt = Date.now();
    if (startingMs <= 0) return;
    const timer = setInterval(() => {
      const remainingMs = startingMs - (Date.now() - startedAt);
      if (remainingMs <= 0) {
        setDisplay({ beat, startingMs, seconds: 0 });
        clearInterval(timer);
        return;
      }
      setDisplay({ beat, startingMs, seconds: Math.ceil(remainingMs / 1000) });
    }, 250);
    return () => clearInterval(timer);
  }, [beat, startingMs]);

  return seconds;
}

/** "08s": two digits, as the mockups' timer pills read. */
export function timerLabel(seconds: number): string {
  return `${String(Math.max(0, seconds)).padStart(2, '0')}s`;
}
