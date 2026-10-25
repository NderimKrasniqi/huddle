import { playroomPhone } from '@huddle/design-tokens';
import { PlayroomButton, PlayroomHeading, PlayroomStatusImage, PlayroomText } from '@huddle/ui/native';
import { Linking, StyleSheet, View } from 'react-native';

import type { ConnectionProblem } from '../platform/room-client';
import { PhoneFrame } from './seated/phone-frame';

const COPY: Readonly<Record<ConnectionProblem, { readonly title: string; readonly message: string }>> = {
  localNetworkDenied: {
    title: 'Huddle needs Local Network access',
    message: 'Huddle finds the TV on your Wi-Fi. Turn on Local Network for Huddle in Settings, then try again.',
  },
  unreachable: {
    title: 'Can’t reach the TV',
    message:
      'Make sure this phone is on the same Wi-Fi as the TV. Guest and hotel Wi-Fi often stop devices from reaching each other. If you turned off Local Network for Huddle, turn it back on in Settings.',
  },
  incompatible: {
    title: 'Update Huddle',
    message: 'This phone and the TV run different versions of Huddle. Update the app on both, then join again.',
  },
};

/**
 * Why the phone cannot reach a TV that hosts its room (approved scope changes
 * 2, 3 and 5): Local Network access is off, the network keeps devices apart,
 * or the phone and the TV speak different versions.
 */
export function ConnectionProblemScreen({
  problem,
  onRetry,
}: {
  readonly problem: ConnectionProblem;
  readonly onRetry: () => void;
}) {
  const copy = COPY[problem];
  const canFixInSettings = problem !== 'incompatible';
  return (
    <PhoneFrame
      testID={`phone-connection-${problem}`}
      contentStyle={styles.content}
      footer={
        <View style={styles.actions}>
          {canFixInSettings ? (
            <PlayroomButton
              label="Open Settings"
              variant="secondary"
              onPress={() => void Linking.openSettings()}
              testID="phone-connection-settings"
            />
          ) : null}
          <PlayroomButton
            label={problem === 'incompatible' ? 'OK' : 'Try again'}
            onPress={onRetry}
            testID="phone-connection-retry"
          />
        </View>
      }
    >
      <PlayroomHeading type={playroomPhone.type.heading}>{copy.title}</PlayroomHeading>
      <PlayroomStatusImage art={problem === 'incompatible' ? 'waiting' : 'disconnected'} width={220} height={220} />
      <PlayroomText
        color="muted"
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        style={[playroomPhone.type.body, styles.center]}
        testID="phone-connection-message"
      >
        {copy.message}
      </PlayroomText>
    </PhoneFrame>
  );
}

const styles = StyleSheet.create({
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    textAlign: 'center',
  },
  actions: {
    gap: 12,
  },
});
