import { colors } from '@huddle/design-tokens';
import { Text, View, type TextStyle, type ViewStyle } from 'react-native';

export type PurposeScreenProps = {
  readonly platform: 'phone' | 'tv';
  readonly purpose: string;
};

/**
 * The complete clean-slate renderer. It deliberately accepts no children or
 * style overrides so every Phone and TV state has the same observable shape.
 */
export function PurposeScreen({ platform, purpose }: PurposeScreenProps) {
  return (
    <View style={styles.screen}>
      <Text
        accessible
        accessibilityRole="text"
        accessibilityLabel={purpose}
        style={[styles.label, platform === 'tv' ? styles.tvLabel : styles.phoneLabel]}
      >
        {purpose}
      </Text>
    </View>
  );
}

const styles = {
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  } satisfies ViewStyle,
  label: {
    color: colors.text,
    textAlign: 'center',
  } satisfies TextStyle,
  phoneLabel: {
    fontSize: 24,
  } satisfies TextStyle,
  tvLabel: {
    fontSize: 48,
  } satisfies TextStyle,
} as const;
