import { StyleSheet, Text, View } from 'react-native';

/**
 * Placeholder for the Controller join screen. Boardwalk styling arrives with
 * the theme package, so this screen deliberately sets no colors of its own.
 */
export default function ControllerPlaceholderScreen() {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Huddle</Text>
      <Text style={styles.subtitle}>Controller app placeholder</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  title: {
    fontSize: 40,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 16,
  },
});
