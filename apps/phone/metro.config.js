const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const skiaStub = path.resolve(__dirname, 'metro-stubs/react-native-skia.tsx');
const resolveDefault = config.resolver.resolveRequest;

// The phone ships no native Skia; games' TV-only Skia art resolves to a stub.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === '@shopify/react-native-skia') return { type: 'sourceFile', filePath: skiaStub };
  return (resolveDefault ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
