import {
  HEARTBEAT_ARTWORK,
  HuddleText,
  LoadingMark,
} from '@huddle/ui/native';
import { semanticColors, spacing } from '@huddle/design-tokens';
import { ImageBackground, StyleSheet, View, useWindowDimensions } from 'react-native';
import {
  tvBootPresentation,
  type TvBootPhase,
} from './boot-state';
import { TvCreatingRoomScreen } from './tv-creating-room-screen';

/** The TV before it has a safe room code to show. */
export function TvBootScreen({ phase }: { readonly phase: TvBootPhase }) {
  if (phase === 'startup' || phase === 'opening' || phase === 'reconnecting') {
    return <TvCreatingRoomScreen phase={phase} />;
  }

  const purpose = tvBootPresentation(phase).purpose;
  return <TvBootSystemState phase={phase} title={purpose} />;
}

/**
 * Platform recovery is part of the stage language. Keeping it here avoids
 * falling back to the phone's generic status card on a ten-foot screen.
 */
function TvBootSystemState({
  phase,
  title,
}: {
  readonly phase: Extract<TvBootPhase, 'misconfigured' | 'deviceFailure'>;
  readonly title: string;
}) {
  const { width, height } = useWindowDimensions();
  const scale = Math.min(width / 1920, height / 1080) || 1;
  const setupRequired = phase === 'misconfigured';
  const message = setupRequired
    ? 'Let’s get your TV set up so everyone can join.'
    : 'Let’s get things back on track so the fun can continue.';

  return (
    <View
      style={styles.viewport}
      pointerEvents="none"
      focusable={false}
      accessible
      accessibilityRole="alert"
      accessibilityLabel={`${title}. ${message}`}
      testID="tv-boot-status"
    >
      <View style={[styles.stage, { transform: [{ scale }] }]} pointerEvents="none" focusable={false}>
        <ImageBackground
          source={setupRequired ? HEARTBEAT_ARTWORK.tv.setupRequired : HEARTBEAT_ARTWORK.tv.deviceUnavailable}
          resizeMode="cover"
          style={StyleSheet.absoluteFill}
          accessible={false}
          testID="tv-boot-status-background"
        />
        <View style={styles.statusContent} pointerEvents="none" focusable={false} accessible={false}>
          <View style={styles.statusBrand} pointerEvents="none" focusable={false}>
            <LoadingMark size={62} reduceMotion accessibilityLabel="Huddle" />
            <HuddleText variant="hero" color="text" style={styles.statusBrandName}>
              Huddle
            </HuddleText>
          </View>
          <HuddleText variant="tvDisplay" color="text" style={styles.statusTitle}>
            {setupRequired ? 'Almost there!' : 'We can’t reach your TV right now'}
          </HuddleText>
          <HuddleText variant="bodyLarge" color="text" style={styles.statusMessage}>
            {message}
          </HuddleText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: semanticColors.text,
  },
  stage: {
    width: 1920,
    height: 1080,
    overflow: 'hidden',
  },
  statusContent: {
    position: 'absolute',
    left: 192,
    top: 150,
    width: 900,
    bottom: 150,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  statusBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  statusBrandName: {
    color: semanticColors.text,
    fontSize: 58,
    lineHeight: 68,
  },
  statusTitle: {
    marginTop: spacing['2xl'],
    color: semanticColors.text,
    maxWidth: 900,
  },
  statusMessage: {
    marginTop: spacing.md,
    color: semanticColors.text,
    maxWidth: 700,
  },
});
