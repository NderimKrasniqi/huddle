import type { ReactNode } from 'react';
import { Text, type StyleProp, type TextProps, type TextStyle } from 'react-native';

import { textScaleCap } from './font-scale';

export type GameTextProps = Omit<TextProps, 'style'> & {
  readonly children?: ReactNode;
  readonly align?: TextStyle['textAlign'];
  readonly style?: StyleProp<TextStyle>;
};

export function GameText({ children, align, style, maxFontSizeMultiplier, ...textProps }: GameTextProps) {
  const textStyle = [align === undefined ? null : { textAlign: align }, style];
  return (
    <Text {...textProps} maxFontSizeMultiplier={textScaleCap(textStyle, maxFontSizeMultiplier)} style={textStyle}>
      {children}
    </Text>
  );
}

export type ThemedGameTextProps<Weight extends string> = {
  readonly children: ReactNode;
  readonly size: number;
  readonly weight?: Weight;
  readonly color?: string;
  readonly tracking?: number;
  readonly align?: 'center' | 'left';
  readonly leading?: number;
  readonly numberOfLines?: number;
  readonly style?: TextStyle;
};

export function themedGameText<Weight extends string>(
  fonts: Readonly<Record<Weight, string>>,
  defaults: { readonly weight: NoInfer<Weight>; readonly color: string; readonly leading: number },
) {
  return function ThemedGameText({
    children,
    size,
    weight = defaults.weight,
    color = defaults.color,
    tracking,
    align = 'center',
    leading = defaults.leading,
    numberOfLines,
    style,
  }: ThemedGameTextProps<Weight>) {
    return (
      <GameText
        numberOfLines={numberOfLines}
        align={align}
        style={[{ fontFamily: fonts[weight], fontSize: size, lineHeight: Math.round(size * leading), color, letterSpacing: tracking }, style]}
      >
        {children}
      </GameText>
    );
  };
}
