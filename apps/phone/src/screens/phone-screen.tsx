import { playroomPhone } from '@huddle/design-tokens';
import { PlayroomButton, PlayroomHeading, PlayroomStatusImage, PlayroomText } from '@huddle/ui/native';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { SeatedPhone } from './seated-phone';
import { RoomCodeEntry } from '../features/join/room-code-entry';
import { useRoomClient } from '../platform/room-client/native';
import { ConnectionProblemScreen } from './connection-problem-screen';
import { usePhoneSession } from '../platform/session';
import { PhoneLoadingScreen } from '../ui/native';
import { PhoneFrame } from './seated/phone-frame';

export default function PhoneScreen() {
  const { session: current, restoringToken, notice, reportSeatLost, leave, clearNotice } = usePhoneSession();
  const room = useRoomClient();
  const problem = room.useConnectionProblem();
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

  if (problem !== undefined) {
    return <ConnectionProblemScreen problem={problem} onRetry={room.retryConnection} />;
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
