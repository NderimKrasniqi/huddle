import { radii, semanticColors, shadows, spacing, typography } from '@huddle/design-tokens';
import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';

export type CodeTilesProps = {
  readonly code?: string;
  readonly length?: number;
  readonly focusedIndex?: number;
  readonly error?: boolean;
  readonly onPress?: () => void;
  readonly accessibilityLabel?: string;
  readonly testID?: string;
  readonly style?: StyleProp<ViewStyle>;
};

/** Four-character room code presented as native, legible tiles. */
export function CodeTiles({
  code = '',
  length = 4,
  focusedIndex,
  error = false,
  onPress,
  accessibilityLabel,
  testID,
  style,
}: CodeTilesProps) {
  const normalizedCode = code.toUpperCase();
  const tiles = Array.from({ length }, (_, index) => normalizedCode[index] ?? '');
  const tileContent = (
    <View style={[styles.row, style]} testID={testID} focusable={false}>
      {tiles.map((value, index) => (
        <View
          key={`${index}-${value}`}
          style={[styles.tile, focusedIndex === index ? styles.focused : null, error ? styles.error : null]}
          accessible={false}
          focusable={false}
        >
          <Text style={styles.value}>{value}</Text>
        </View>
      ))}
    </View>
  );

  if (onPress === undefined) {
    return (
      <View pointerEvents="none" focusable={false} accessible accessibilityRole="text" accessibilityLabel={accessibilityLabel ?? `Room code ${normalizedCode}`}>
        {tileContent}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? `Room code ${normalizedCode}`}
      accessibilityHint="Opens room code entry"
      testID={testID ? `${testID}-button` : undefined}
    >
      {tileContent}
    </Pressable>
  );
}

const styles = {
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  } satisfies ViewStyle,
  tile: {
    width: 48,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: semanticColors.surface,
    borderColor: semanticColors.border,
    borderWidth: 1,
    borderRadius: radii.sm,
    ...shadows.card,
  } satisfies ViewStyle,
  focused: {
    borderColor: semanticColors.primary,
    borderWidth: 2,
  } satisfies ViewStyle,
  error: {
    borderColor: semanticColors.highlight,
  } satisfies ViewStyle,
  value: {
    ...typography.title,
    color: semanticColors.text,
    width: '100%',
    textAlign: 'center',
  },
} as const;
