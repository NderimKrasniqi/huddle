const { defineConfig, globalIgnores } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

const forbiddenPresentationImports = [
  'nativewind',
  'react-native-css-interop',
  'expo-image',
  'react-native-reanimated',
  'react-native-worklets',
  'lucide-react-native',
  '@react-native-community/netinfo',
  'react-native-qrcode-svg',
  'react-native-svg',
  '@huddle/ui/kit',
  '@huddle/ui/fonts',
];

module.exports = defineConfig([
  globalIgnores([
    '**/dist/**',
    '**/.expo/**',
    '**/expo-env.d.ts',
    'convex/convex/_generated/**',
    '.claude/**',
  ]),
  expoConfig,
  {
    files: ['apps/**/*.{ts,tsx}', 'games/*/src/**/*.{ts,tsx}', 'packages/ui/src/**/*.{ts,tsx}'],
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
