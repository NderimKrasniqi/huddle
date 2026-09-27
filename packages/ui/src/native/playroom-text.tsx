import { playroomColors, playroomFonts, type PlayroomColor } from '@huddle/design-tokens';
import type { ReactNode } from 'react';
import {
  Image,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { PLAYROOM_ARTWORK } from './playroom-artwork';

export type PlayroomTextProps = Omit<TextProps, 'style'> & {
  readonly children?: ReactNode;
  readonly color?: PlayroomColor;
  readonly style?: StyleProp<TextStyle>;
};

/** Nunito text in Playroom ink. Pass a Playroom type token as `style`. */
export function PlayroomText({ children, color = 'ink', style, ...textProps }: PlayroomTextProps) {
  return (
    <Text {...textProps} style={[styles.text, { color: playroomColors[color] }, style]}>
      {children}
    </Text>
  );
}

export type PlayroomBurstProps = {
  /** Height of the burst; the three dashes scale with it. */
  readonly size: number;
  /** Which side of the content the burst sits on; its dashes point inward. */
  readonly side: 'left' | 'right';
  readonly style?: StyleProp<ViewStyle>;
};

/** Three orange dashes that fan out beside a heading or the main action. */
export function PlayroomBurst({ size, side, style }: PlayroomBurstProps) {
  const thickness = Math.max(2, size * 0.14);
  const length = size * 0.36;
  const dash = (top: number, rotate: string, inset: number): ViewStyle => ({
    position: 'absolute',
    top: top - thickness / 2,
    [side === 'left' ? 'right' : 'left']: inset,
    width: length,
    height: thickness,
    borderRadius: thickness,
    backgroundColor: playroomColors.orange,
    transform: [{ rotate }],
  });
  const sign = side === 'left' ? 1 : -1;
  return (
    <View
      style={[{ width: size * 0.62, height: size }, style]}
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      <View style={dash(size * 0.18, `${40 * sign}deg`, size * 0.08)} />
      <View style={dash(size * 0.5, '0deg', 0)} />
      <View style={dash(size * 0.82, `${-40 * sign}deg`, size * 0.08)} />
    </View>
  );
}

export type PlayroomHeadingProps = {
  readonly children: ReactNode;
  /** A Playroom type token: heading, title, and so on. */
  readonly type: TextStyle;
  readonly bursts?: boolean;
  readonly color?: PlayroomColor;
  readonly numberOfLines?: number;
  readonly style?: StyleProp<ViewStyle>;
  readonly testID?: string;
};

/** A Playroom heading, framed by burst dashes on both sides. */
export function PlayroomHeading({
  children,
  type,
  bursts = true,
  color = 'ink',
  numberOfLines,
  style,
  testID,
}: PlayroomHeadingProps) {
  const size = (type.fontSize ?? 30) * 0.62;
  return (
    <View style={[styles.headingRow, style]} testID={testID}>
      {bursts ? <PlayroomBurst size={size} side="left" /> : null}
      <PlayroomText
        accessibilityRole="header"
        color={color}
        numberOfLines={numberOfLines}
        style={[type, styles.headingText, { marginHorizontal: bursts ? size * 0.2 : 0 }]}
      >
        {children}
      </PlayroomText>
      {bursts ? <PlayroomBurst size={size} side="right" /> : null}
    </View>
  );
}

const WORDMARK_ASPECT = 1200 / 318;

export type PlayroomWordmarkProps = {
  readonly height: number;
  readonly style?: StyleProp<ViewStyle>;
  readonly testID?: string;
};

/** The supplied Huddle wordmark: deep purple with orange dashes. */
export function PlayroomWordmark({ height, style, testID }: PlayroomWordmarkProps) {
  return (
    <View style={style} accessible accessibilityRole="image" accessibilityLabel="Huddle" testID={testID}>
      <Image
        source={PLAYROOM_ARTWORK.brand.wordmark}
        style={{ width: height * WORDMARK_ASPECT, height }}
        resizeMode="contain"
        accessible={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  text: {
    fontFamily: playroomFonts.bold,
    includeFontPadding: false,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headingText: {
    textAlign: 'center',
    flexShrink: 1,
  },
});
