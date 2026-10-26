const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const skiaStub = path.resolve(__dirname, 'metro-stubs/react-native-skia.tsx');
const resolveDefault = config.resolver.resolveRequest;

// Web only: Skia needs CanvasKit loaded first, which the web TV build does not do yet.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && moduleName === '@shopify/react-native-skia') return { type: 'sourceFile', filePath: skiaStub };
  return (resolveDefault ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
