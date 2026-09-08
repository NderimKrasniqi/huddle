import { brandColors, radii, shadows, spacing } from '@huddle/design-tokens';
import { HEARTBEAT_ARTWORK, HuddleButton, HuddleText, ScreenShell } from '@huddle/ui/native';
import { ImageBackground, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SeatedPhone } from './seated-phone';
import { RoomCodeEntry } from '../features/join/room-code-entry';
import { usePhoneSession } from '../platform/session';
import { PhoneLoadingScreen } from '../ui/native';

/** Root Phone coordinator: restore first, then seated room or manual entry. */
export default function PhoneScreen() {
  const { session, restoringToken, notice, reportSeatLost, leave, clearNotice } = usePhoneSession();

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
  const insets = useSafeAreaInsets();

  return (
    <ScreenShell tone="background" style={styles.seatLostShell} testID="phone-seat-lost">
      <ImageBackground
        source={HEARTBEAT_ARTWORK.phone.seatLost}
        resizeMode="cover"
        style={StyleSheet.absoluteFill}
        accessible={false}
        testID="phone-seat-lost-art"
      />
      <View pointerEvents="none" style={styles.seatLostVeil} />
      <HuddleText
        variant="title"
        align="center"
        accessibilityRole="header"
        style={[styles.seatLostHeader, { top: insets.top + spacing.lg }]}
      >
        Uh oh!
      </HuddleText>
      <ScrollView
        contentContainerStyle={[
          styles.seatLostScroll,
          {
            paddingTop: insets.top + spacing.lg,
            paddingRight: insets.right + spacing.lg,
            paddingBottom: insets.bottom + spacing.lg,
            paddingLeft: insets.left + spacing.lg,
          },
        ]}
        showsVerticalScrollIndicator={false}
        testID="phone-seat-lost-scroll"
      >
        <View style={styles.seatLostContent}>
          <View style={styles.seatLostSheet}>
            <HuddleText variant="title" align="center" accessibilityRole="header">
              Seat no longer available
            </HuddleText>
            <HuddleText
              variant="body"
              align="center"
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              testID="phone-seat-lost-reason"
            >
              {reason}
            </HuddleText>
            <HuddleButton
              title="Join another room"
              variant="primary"
              onPress={onJoinAnotherRoom}
              accessibilityLabel="Join another room"
              testID="phone-seat-lost-join-another-room"
              style={styles.seatLostAction}
            />
          </View>
        </View>
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  seatLostShell: {
    paddingHorizontal: 0,
    overflow: 'hidden',
  },
  seatLostVeil: {
    ...StyleSheet.absoluteFill,
    backgroundColor: brandColors.cream,
    opacity: 0.05,
  },
  seatLostHeader: {
    position: 'absolute',
    right: spacing.lg,
    left: spacing.lg,
    zIndex: 1,
  },
  seatLostScroll: {
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  seatLostContent: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  seatLostSheet: {
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    borderRadius: radii.xl,
    backgroundColor: 'rgba(249,241,230,0.96)',
    ...shadows.card,
  },
  seatLostAction: {
    width: '100%',
    minHeight: 52,
    borderRadius: radii.lg,
  },
});
