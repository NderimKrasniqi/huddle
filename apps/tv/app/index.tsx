import {
  borderWidth,
  colors,
  fontFamily,
  letterSpacing,
  minBodyFontSize,
  offsetShadow,
  radius,
  shadowDepth,
} from '@huddle/ui';
import { StyleSheet, Text, View } from 'react-native';

/**
 * Placeholder for the TV pairing screen. It exists to prove the Boardwalk
 * theme renders on the TV — every color, radius, border, shadow and font
 * below comes from `@huddle/ui`.
 */
export default function TvPlaceholderScreen() {
  return (
    <View style={styles.screen}>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>BOARDWALK</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.title}>
          HUDDLE<Text style={styles.titlePeriod}>.</Text>
        </Text>
        <Text style={styles.subtitle}>TV app placeholder</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 40,
    backgroundColor: colors.screen,
  },
  badge: {
    paddingHorizontal: 28,
    paddingVertical: 10,
    backgroundColor: colors.tangerine,
    borderColor: colors.ink,
    borderWidth: borderWidth.thick,
    borderRadius: radius.pill,
    boxShadow: offsetShadow(shadowDepth.phoneCard),
    transform: [{ rotate: '-3deg' }],
  },
  badgeText: {
    color: colors.surface,
    fontFamily: fontFamily.display,
    fontSize: minBodyFontSize.tv,
    letterSpacing: letterSpacing.badge,
  },
  card: {
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 72,
    paddingVertical: 48,
    backgroundColor: colors.surface,
    borderColor: colors.ink,
    borderWidth: borderWidth.thick,
    borderRadius: radius.cardLarge,
    // The accent-colored variant, as on the focused carousel card.
    boxShadow: offsetShadow(shadowDepth.tvHero, colors.cobalt),
  },
  title: {
    color: colors.ink,
    fontFamily: fontFamily.display,
    fontSize: 64,
  },
  titlePeriod: {
    color: colors.tangerine,
  },
  subtitle: {
    color: colors.mutedText,
    fontFamily: fontFamily.body,
    fontSize: minBodyFontSize.tv,
  },
});
