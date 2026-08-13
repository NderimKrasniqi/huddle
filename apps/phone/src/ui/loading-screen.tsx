import { colors, semanticStyles } from '@huddle/ui';
import { AnimatedScreen, HuddleLoadingSurface } from '@huddle/ui/native';
import { View } from 'react-native';

import { phoneLoadingPresentation, type PhoneLoadingPhase } from './loading-state';

/** Branded startup/session-restoring screen for the phone app. */
export function PhoneLoadingScreen({ phase }: { readonly phase: PhoneLoadingPhase }) {
  return (
    <AnimatedScreen key={phase}>
      <View style={styles.screen}>
        <HuddleLoadingSurface
          platform="phone"
          {...phoneLoadingPresentation(phase)}
        />
      </View>
    </AnimatedScreen>
  );
}

const styles = semanticStyles({
  screen: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
});
