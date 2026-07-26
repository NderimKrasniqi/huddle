import { StyleSheet, Text, View } from 'react-native';

/**
 * Placeholder for the TV pairing screen. Boardwalk styling arrives with the
 * theme package, so this screen deliberately sets no colors of its own.
 */
export default function TvPlaceholderScreen() {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Huddle</Text>
      <Text style={styles.subtitle}>TV app placeholder</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  title: {
    fontSize: 64,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 24,
  },
});
