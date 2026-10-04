import { playroomPhone } from '@huddle/design-tokens';
import { PlayroomButton, PlayroomHeading, PlayroomStatusImage, PlayroomText } from '@huddle/ui/native';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { SeatedPhone } from './seated-phone';
import { RoomCodeEntry } from '../features/join/room-code-entry';
import { usePhoneSession } from '../platform/session';
import { PhoneLoadingScreen } from '../ui/native';
import { PhoneFrame } from './seated/phone-frame';

/** Root Phone coordinator: restore first, then seated room or manual entry. */
export default function PhoneScreen() {
  const { session: current, restoringToken, notice, reportSeatLost, leave, clearNotice } = usePhoneSession();
  // A seated phone stays mounted through a momentary "unknown" while the
  // session re-resolves: swapping to the loading screen would remount the
  // room and drop whatever the player had open, such as a confirmation sheet.
  const [lastSeated, setLastSeated] = useState(current ?? undefined);
  if (current && current !== lastSeated) setLastSeated(current);
  if (current === null && lastSeated !== undefined) setLastSeated(undefined);
  const session = current === undefined ? lastSeated : current;

  if (session === undefined) {
    return <PhoneLoadingScreen phase={restoringToken ? 'restoring' : 'startup'} />;
  }

  if (session !== null) {
    return (
      <SeatedPhone
        session={session}
        onSeatLost={reportSeatLost}
        onLeft={() => leave()}
      />
    );
  }

  if (notice !== undefined) {
    return <SeatLostRecoverySurface reason={notice} onJoinAnotherRoom={clearNotice} />;
  }

  return <RoomCodeEntry />;
}

function SeatLostRecoverySurface({
  reason,
  onJoinAnotherRoom,
}: {
  readonly reason: string;
  readonly onJoinAnotherRoom: () => void;
}) {
  return (
    <PhoneFrame
      testID="phone-seat-lost"
      contentStyle={styles.content}
      footer={
        <PlayroomButton
          label="Join a room"
          onPress={onJoinAnotherRoom}
          accessibilityLabel="Join a room"
          testID="phone-seat-lost-join-another-room"
        />
      }
    >
      <PlayroomHeading type={playroomPhone.type.heading}>You’re out of the room</PlayroomHeading>
      <PlayroomStatusImage art="leftRoom" width={220} height={220} />
      <PlayroomText
        color="muted"
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        style={[playroomPhone.type.body, styles.center]}
        testID="phone-seat-lost-reason"
      >
        {reason}
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
});
