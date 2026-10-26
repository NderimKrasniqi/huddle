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

export function TvBootScreen({ phase }: { readonly phase: TvBootPhase }) {
  if (phase === 'startup' || phase === 'opening' || phase === 'reconnecting') {
    return <TvCreatingRoomScreen phase={phase} />;
  }

  const purpose = tvBootPresentation(phase).purpose;
  return <TvBootSystemState phase={phase} title={purpose} />;
}

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
    : 'Check the TV’s internet connection. We’ll keep trying on our own.';

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
          <PlayroomHeading type={playroomTv.type.hero} style={styles.title}>
            {setupRequired ? 'Almost there!' : 'We can’t reach your TV right now'}
          </PlayroomHeading>
          <PlayroomText color="muted" style={[playroomTv.type.body, styles.message]}>
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
    backgroundColor: playroomColors.canvas,
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
