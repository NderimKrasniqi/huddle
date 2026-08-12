import { colors } from '../colors';
import { ImageBackground, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import triviaArt from '../../assets/game-art/trivia.png';
import wordGameArt from '../../assets/game-art/word-game.png';
import drawingArt from '../../assets/game-art/drawing.png';

const artwork: Record<string, typeof triviaArt> = {
  trivia: triviaArt,
  voting: wordGameArt,
  'draw-battle': drawingArt,
  'word-sneak': wordGameArt,
};

/**
 * The supplied key art has a painted surface that should continue under the
 * title/fact treatment. Keeping that mapping beside the asset mapping avoids
 * every phone and TV screen inventing a different footer colour for the same
 * game card.
 */
export function gameArtSurfaceColor(
  gameId: string,
  fallback: keyof typeof colors,
): string {
  return {
    trivia: colors.setupCanvas,
    voting: colors.accent,
    'draw-battle': colors.sage,
    'word-sneak': colors.online,
  }[gameId] ?? colors[fallback];
}

/** Shared key-art renderer with a palette fallback for future registry entries. */
export function GameKeyArt({
  gameId,
  title,
  color,
  style,
}: {
  readonly gameId: string;
  readonly title: string;
  readonly color: keyof typeof colors;
  readonly style?: StyleProp<ViewStyle>;
}) {
  const source = artwork[gameId];
  return source === undefined ? (
    <View style={[styles.fallback, style, { backgroundColor: colors[color] }]}>
      <Text style={styles.fallbackLabel}>{title}</Text>
    </View>
  ) : (
    <ImageBackground
      source={source}
      resizeMode="cover"
      accessibilityRole="image"
      accessibilityLabel={`${title} artwork`}
      style={[styles.art, style]}
    />
  );
}

const styles = StyleSheet.create({
  art: { overflow: 'hidden' },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  fallbackLabel: { color: colors.inverse },
});
