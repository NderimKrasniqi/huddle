import { GameText } from '@huddle/ui/game-kit';
import type { ReactNode } from 'react';
import type { TextStyle } from 'react-native';

import { bomb, FONT } from './theme';

/** Bomb Squad's type: Nunito at a set size, cream on the night sky by default. */
export function BombText({
  children,
  size,
  weight = 'regular',
  color = bomb.cream,
  tracking,
  align = 'center',
  leading = 1.25,
  numberOfLines,
  style,
}: {
  readonly children: ReactNode;
  readonly size: number;
  readonly weight?: keyof typeof FONT;
  readonly color?: string;
  readonly tracking?: number;
  readonly align?: 'center' | 'left';
  /** Line height as a multiple of the size; the TV sets display type tighter. */
  readonly leading?: number;
  readonly numberOfLines?: number;
  readonly style?: TextStyle;
}) {
  return (
    <GameText
      numberOfLines={numberOfLines}
      align={align}
      style={[{ fontFamily: FONT[weight], fontSize: size, lineHeight: Math.round(size * leading), color, letterSpacing: tracking }, style]}
    >
      {children}
    </GameText>
  );
}
