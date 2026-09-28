import { playroomColors, playroomTv } from '@huddle/design-tokens';
import {
  PlayroomHeading,
  PlayroomStatusImage,
  PlayroomText,
  PlayroomTvStage,
} from '@huddle/ui/native';
import { StyleSheet, View } from 'react-native';
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
      <PlayroomTvStage testID="tv-boot-status-stage">
        <View style={styles.content} pointerEvents="none" focusable={false} accessible={false}>
          <PlayroomStatusImage art={setupRequired ? 'loading' : 'disconnected'} width={420} height={320} />
          <PlayroomHeading type={playroomTv.type.heading} style={styles.title}>
            {setupRequired ? 'Almost there!' : 'We can’t reach your TV right now'}
          </PlayroomHeading>
          <PlayroomText color="inkSoft" style={[playroomTv.type.subheading, styles.message]}>
            {message}
          </PlayroomText>
        </View>
      </PlayroomTvStage>
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: {
    flex: 1,
    backgroundColor: playroomColors.cream,
  },
  content: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: playroomTv.safeX * 2,
  },
  title: {
    marginTop: 32,
  },
  message: {
    marginTop: 16,
    textAlign: 'center',
    maxWidth: 1100,
  },
});
