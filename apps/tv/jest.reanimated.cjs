// Reanimated's published Jest mock, plus the one hook it leaves out
// (`useReducedMotion`). Tests render the full-motion screens; components that
// take a `reduceMotion` prop are covered by passing it explicitly.
const mock = require('react-native-reanimated/mock');

module.exports = {
  ...mock,
  useReducedMotion: () => false,
};
