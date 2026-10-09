// Expo's default config, plus one alias: the phone app does not ship
// react-native-svg's native module, so games' TV-only SVG art resolves to a
// stub here. The phone never renders a game's TV screen.
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const svgStub = path.resolve(__dirname, 'metro-stubs/react-native-svg.tsx');
const resolveDefault = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'react-native-svg') return { type: 'sourceFile', filePath: svgStub };
  return (resolveDefault ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
