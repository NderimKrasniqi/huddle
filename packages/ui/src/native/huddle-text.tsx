import {
  semanticColors,
  typography,
  type TypographyToken,
} from '@huddle/design-tokens';
import type { PropsWithChildren } from 'react';
import { Platform, Text, type StyleProp, type TextProps, type TextStyle } from 'react-native';

export type HuddleTextProps = PropsWithChildren<
  Omit<TextProps, 'style'> & {
    readonly variant?: TypographyToken;
    readonly color?: keyof typeof semanticColors;
    readonly align?: TextStyle['textAlign'];
    /** Use the platform face when a bundled font cannot be loaded. */
    readonly systemFont?: boolean;
    readonly style?: StyleProp<TextStyle>;
  }
>;

/** Native copy primitive backed by the approved Nunito/token scale. */
export function HuddleText({
  children,
  variant = 'body',
  color = 'text',
  align,
  systemFont = false,
  style,
  ...textProps
}: HuddleTextProps) {
  return (
    <Text
      {...textProps}
      style={[
        typography[variant],
        systemFont ? styles.systemFont : null,
        { color: semanticColors[color], textAlign: align },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

const styles = {
  systemFont: {
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif', default: undefined }),
  } satisfies TextStyle,
} as const;
