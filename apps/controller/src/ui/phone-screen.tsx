import { colors } from '@huddle/ui';
import { type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/**
 * The surface every Controller screen is drawn on.
 *
 * A phone is not a stage: unlike the TV (see `TvStage`), there is no fixed
 * design size to scale, because the screens land on everything from a small
 * phone to a large one, each with its own notch, home indicator, and keyboard.
 * The prototype's 430pt canvas is still a useful upper bound, though: it keeps
 * the supplied phone compositions from becoming a wide tablet layout while
 * the content remains fluid below that width. The layout then flows around the
 * device — safe area at the edges, keyboard pushed against rather than typed
 * behind, and a scroll for the short screens where a raised keyboard leaves
 * less room than the content needs.
 */
export function PhoneScreen({
  children,
  contentStyle,
}: {
  readonly children: ReactNode;
  readonly contentStyle?: StyleProp<ViewStyle>;
}) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoider}
        // Android resizes the window for the keyboard on its own (Expo's
        // default `softwareKeyboardLayoutMode`), and padding on top of that
        // double-counts it.
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.content, contentStyle]}
          // So the first tap on Join lands on Join rather than being spent
          // dismissing the keyboard the player is still typing on.
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  keyboardAvoider: {
    flex: 1,
  },
  content: {
    width: '100%',
    maxWidth: 430,
    alignSelf: 'center',
    // Screens begin below the safe area, as the approved phone boards do. The
    // former vertical centring put short lobby states halfway down tall phones
    // and made every first action look detached from its header.
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 28,
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
});
