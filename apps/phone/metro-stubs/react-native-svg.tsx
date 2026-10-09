/**
 * Stand-in for react-native-svg in the phone app, which does not ship the
 * native SVG module. Games bundle their TV screens into both apps; only the TV
 * renders SVG art (see Bomb Squad's svg-art.tsx), so here every shape draws
 * nothing. Wired up by apps/phone/metro.config.js.
 */
import { forwardRef } from 'react';

const Nothing = forwardRef<unknown, Record<string, unknown>>(function Nothing() {
  return null;
});

export default Nothing;
export const Svg = Nothing;
export const Circle = Nothing;
export const Defs = Nothing;
export const Ellipse = Nothing;
export const G = Nothing;
export const Line = Nothing;
export const LinearGradient = Nothing;
export const Path = Nothing;
export const Polygon = Nothing;
export const RadialGradient = Nothing;
export const Rect = Nothing;
export const Stop = Nothing;
