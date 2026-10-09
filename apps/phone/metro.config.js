// Expo's default config, plus one alias: the phone app does not ship Skia's
// native module, so games' TV-only Skia art resolves to a stub here. The phone
// never renders a game's TV screen.
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const skiaStub = path.resolve(__dirname, 'metro-stubs/react-native-skia.tsx');
const resolveDefault = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === '@shopify/react-native-skia') return { type: 'sourceFile', filePath: skiaStub };
  return (resolveDefault ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
