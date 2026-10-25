// Expo's default config, plus one alias for the web build only: Skia needs
// CanvasKit loaded before any game module runs, which the web TV smoke test
// (TASK-23) does not do yet, so games' Skia art resolves to a stub there.
// Android TV and Apple TV keep the real Skia.
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const skiaStub = path.resolve(__dirname, 'metro-stubs/react-native-skia.tsx');
const resolveDefault = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && moduleName === '@shopify/react-native-skia') return { type: 'sourceFile', filePath: skiaStub };
  return (resolveDefault ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
