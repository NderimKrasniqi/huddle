import { playroomColors, playroomPhone } from '@huddle/design-tokens';
import { PlayroomStatusImage, PlayroomText, PlayroomWordmark } from '@huddle/ui/native';
import { StyleSheet, View } from 'react-native';

import { phoneLoadingPresentation, type PhoneLoadingPhase } from './loading-state';

/** Startup and session-restoring screen for the phone app. */
export function PhoneLoadingScreen({ phase }: { readonly phase: PhoneLoadingPhase }) {
  return (
    <View style={styles.screen} testID={`phone-${phase}-surface`}>
      <PlayroomWordmark height={44} />
      <PlayroomStatusImage art="loading" width={220} height={220} />
      <View style={styles.copy}>
        <PlayroomText accessibilityRole="alert" style={[playroomPhone.type.heading, styles.center]}>
          {phoneLoadingPresentation(phase).purpose}
        </PlayroomText>
        <PlayroomText color="muted" style={[playroomPhone.type.body, styles.center]}>
          {phase === 'restoring' ? 'This will just take a moment…' : 'Getting the room ready…'}
        </PlayroomText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    paddingHorizontal: 24,
    backgroundColor: playroomColors.canvas,
  },
  copy: {
    alignItems: 'center',
    gap: 8,
  },
  center: {
    textAlign: 'center',
  },
});
