const { defineConfig, globalIgnores } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

const forbiddenPresentationImports = [
  'nativewind',
  'react-native-css-interop',
  'expo-image',
  'react-native-worklets',
  'lucide-react-native',
  '@react-native-community/netinfo',
  'react-native-qrcode-svg',
  'react-native-svg',
  '@huddle/ui/kit',
  '@huddle/ui/fonts',
];

// Playroom platform motion runs on Reanimated; game modules own their own
// presentation and stay without it.
const forbiddenGameImports = [...forbiddenPresentationImports, 'react-native-reanimated'];

module.exports = defineConfig([
  globalIgnores([
    '**/dist/**',
    '**/.expo/**',
    '**/expo-env.d.ts',
    'convex/convex/_generated/**',
    '.claude/**',
    'output/**',
  ]),
  expoConfig,
  {
    files: ['apps/**/*.{ts,tsx}', 'packages/ui/src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: forbiddenPresentationImports.map((name) => ({
            name,
            message: 'The clean-slate renderer has no presentation dependency.',
          })),
        },
      ],
    },
  },
  {
    files: ['games/*/src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: forbiddenGameImports.map((name) => ({
            name,
            message: 'Game modules own their presentation without platform motion dependencies.',
          })),
        },
      ],
    },
  },
  {
    files: ['apps/tv/src/features/room/room-invitation-screen.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: forbiddenPresentationImports
            .filter((name) => name !== 'react-native-qrcode-svg' && name !== 'react-native-svg')
            .map((name) => ({
              name,
              message: 'The illustrated TV Room renderer has one QR/SVG dependency exception.',
            })),
        },
      ],
    },
  },
]);
