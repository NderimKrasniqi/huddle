/**
 * Stand-in for @shopify/react-native-skia in the web TV build only (TASK-23).
 * Skia on the web needs CanvasKit (a WebAssembly file) loaded before any game
 * module runs; until a web TV shell does that, every shape draws nothing, so
 * Bomb Squad and Sumo Bumpers lose their TV art on the web. A copy of the
 * phone's stub; wired up by apps/tv/metro.config.js.
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
