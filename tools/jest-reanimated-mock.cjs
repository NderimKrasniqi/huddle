const { View } = require('react-native');

const identity = (value) => value;
const easing = Object.assign(identity, {
  cubic: identity,
  in: identity,
  inOut: identity,
  out: identity,
  quad: identity,
});

function interpolate(value, input, output) {
  if (value <= input[0]) return output[0];
  return output[output.length - 1];
}

const api = {
  cancelAnimation: () => undefined,
  Easing: easing,
  interpolate,
  useAnimatedStyle: (factory) => factory(),
  useSharedValue: (value) => ({ value }),
  withDelay: (_delay, animation) => animation,
  withRepeat: (animation) => animation,
  withSequence: (...animations) => animations[animations.length - 1],
  withSpring: identity,
  withTiming: identity,
};

module.exports = { __esModule: true, ...api, default: { View } };
