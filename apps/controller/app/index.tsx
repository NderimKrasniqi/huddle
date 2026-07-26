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
 * Placeholder for the Controller join screen. It exists to prove the
 * Boardwalk theme renders on the phone — every color, radius, border, shadow
 * and font below comes from `@huddle/ui`.
 */
export default function ControllerPlaceholderScreen() {
  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.title}>
          HUDDLE<Text style={styles.titlePeriod}>.</Text>
        </Text>
        <Text style={styles.subtitle}>Controller app placeholder</Text>
      </View>
      <View style={styles.button}>
        <Text style={styles.buttonLabel}>JOIN</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 28,
    padding: 24,
    backgroundColor: colors.canvas,
  },
  card: {
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 32,
    backgroundColor: colors.surface,
    borderColor: colors.ink,
    borderWidth: borderWidth.medium,
    borderRadius: radius.card,
    boxShadow: offsetShadow(shadowDepth.phoneCard),
    transform: [{ rotate: '-2deg' }],
  },
  title: {
    color: colors.ink,
    fontFamily: fontFamily.display,
    fontSize: 40,
  },
  titlePeriod: {
    color: colors.tangerine,
  },
  subtitle: {
    color: colors.mutedText,
    fontFamily: fontFamily.body,
    fontSize: minBodyFontSize.phone,
  },
  button: {
    alignItems: 'center',
    alignSelf: 'stretch',
    justifyContent: 'center',
    minHeight: 56,
    backgroundColor: colors.cobalt,
    borderColor: colors.ink,
    borderWidth: borderWidth.medium,
    borderRadius: radius.button,
    boxShadow: offsetShadow(shadowDepth.phoneCard),
  },
  buttonLabel: {
    color: colors.surface,
    fontFamily: fontFamily.bodyBold,
    fontSize: minBodyFontSize.phone,
    letterSpacing: letterSpacing.label,
  },
});
