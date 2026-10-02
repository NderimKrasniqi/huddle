import { StyleSheet, type StyleProp, type TextStyle } from 'react-native';

/**
 * How far a piece of text may follow the system text size, by how big it
 * already is. Body copy grows the most because it is what people need to
 * read; display type is already large, and letting a 40pt headline triple
 * splits words mid-letter and pushes the main action off the screen.
 */
export function fontScaleCap(fontSize: number | undefined): number {
  if (fontSize === undefined) return 2;
  if (fontSize >= 28) return 1.3;
  if (fontSize >= 20) return 1.6;
  return 2;
}

/** The cap for a styled text, unless the caller already chose one (`null` lifts it). */
export function textScaleCap(style: StyleProp<TextStyle>, chosen: number | null | undefined): number | null {
  return chosen !== undefined ? chosen : fontScaleCap(StyleSheet.flatten(style)?.fontSize);
}
