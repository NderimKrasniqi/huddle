import { StyleSheet, type StyleProp, type TextStyle } from 'react-native';

export function fontScaleCap(fontSize: number | undefined): number {
  if (fontSize === undefined) return 2;
  if (fontSize >= 28) return 1.3;
  if (fontSize >= 20) return 1.6;
  return 2;
}

export function textScaleCap(style: StyleProp<TextStyle>, chosen: number | null | undefined): number | null {
  return chosen !== undefined ? chosen : fontScaleCap(StyleSheet.flatten(style)?.fontSize);
}
