module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}', '../../packages/ui/src/**/*.{js,jsx,ts,tsx}', '../../games/*/src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset'), require('@huddle/design-tokens/tailwind-preset')]
};
