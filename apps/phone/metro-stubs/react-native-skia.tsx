/**
 * Stand-in for @shopify/react-native-skia in the phone app, which does not ship
 * Skia's native module. Games bundle their TV screens into both apps; only the
 * TV renders Skia art (see Bomb Squad's skia-art.tsx), so here every shape draws
 * nothing. Wired up by apps/phone/metro.config.js and vitest.config.ts.
 */
import { forwardRef } from 'react';

const Nothing = forwardRef<unknown, Record<string, unknown>>(function Nothing() {
  return null;
});

export const Canvas = Nothing;
export const BlurMask = Nothing;
export const Circle = Nothing;
export const DashPathEffect = Nothing;
export const Group = Nothing;
export const LinearGradient = Nothing;
export const Oval = Nothing;
export const Path = Nothing;
export const RadialGradient = Nothing;
export const Rect = Nothing;
export const RoundedRect = Nothing;
export const Shadow = Nothing;

const emptyPath = {
  moveTo: () => emptyPath,
  lineTo: () => emptyPath,
  close: () => emptyPath,
  countPoints: () => 0,
  getPoint: () => ({ x: 0, y: 0 }),
};

/** Path builders return a path that draws nothing. */
export const Skia = {
  Path: { Make: () => emptyPath, MakeFromSVGString: () => emptyPath },
  ContourMeasureIter: () => ({ next: () => null }),
};

export const vec = (x = 0, y = 0) => ({ x, y });
