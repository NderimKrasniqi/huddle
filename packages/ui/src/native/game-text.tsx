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
