import { playroomColors, playroomTv } from '@huddle/design-tokens';
import { PlayroomHeading, PlayroomPill, PlayroomText, PlayroomTvStage } from '@huddle/ui/native';
import React, { useEffect } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  View,
} from 'react-native';

import {
  TvRestoreIndicator,
  type TvRestoreIndicatorStage,
} from './tv-restore-indicator';
import {
  resolveTvReducedMotion,
  useTvSystemReducedMotion,
} from '../../ui/reduced-motion';

export type TvRestoringRoomStage = TvRestoreIndicatorStage;

export type TvRestoringRoomScreenProps = {
  readonly roomCode: string;
  /** Omit for the self-timed 1.3s restore transition; pass to control a stage in tests or a coordinator. */
  readonly stage?: TvRestoringRoomStage;
  /** Legacy alias retained for the coordinator seam. */
  readonly onReady?: () => void;
  /** Called after the green-check spring completes. */
  readonly onReadyAnimationComplete?: () => void;
  /** Override the motion preference for deterministic previews/tests. */
  readonly reduceMotion?: boolean;
};

export const TV_RESTORE_READY_DELAY_MS = 1_300;

/** Display-only restore handoff for a persisted TV room. */
export function TvRestoringRoomScreen({
  roomCode,
  stage,
  onReady,
  onReadyAnimationComplete,
  reduceMotion: reduceMotionOverride,
}: TvRestoringRoomScreenProps) {
  const systemReduceMotion = useTvSystemReducedMotion();
  const reduceMotion = resolveTvReducedMotion(reduceMotionOverride, systemReduceMotion);
  const motionPreferenceResolved = reduceMotionOverride !== undefined || systemReduceMotion !== undefined;
  const [internalStage, setInternalStage] = React.useState<TvRestoringRoomStage>('restoring');
  const readyCallback = onReadyAnimationComplete ?? onReady;
  const readyCallbackRef = React.useRef(readyCallback);
  const renderedStage =
    stage ?? (motionPreferenceResolved && reduceMotion ? 'ready' : internalStage);
  const code = roomCode.trim().toUpperCase().slice(0, 4);
  const spokenCode = code.split('').join(' ');
  const isReady = renderedStage === 'ready';
  const [enter] = React.useState(() => new Animated.Value(reduceMotion ? 1 : 0));

  useEffect(() => {
    readyCallbackRef.current = readyCallback;
  }, [readyCallback]);

  useEffect(() => {
    enter.stopAnimation();
    if (reduceMotion) {
      enter.setValue(1);
      return;
    }
    enter.setValue(0);
    const animation = Animated.timing(enter, {
      toValue: 1,
      duration: 240,
      easing: Easing.bezier(0.23, 1, 0.32, 1),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [enter, reduceMotion]);

  useEffect(() => {
    if (stage !== undefined) return;
    if (!motionPreferenceResolved) return;
    if (reduceMotion) return;
    const readyTimer = setTimeout(() => setInternalStage('ready'), TV_RESTORE_READY_DELAY_MS);
    return () => clearTimeout(readyTimer);
  }, [motionPreferenceResolved, reduceMotion, stage]);

  const title = isReady
    ? 'Your room is ready'
    : renderedStage === 'reconnecting'
      ? 'Reconnecting your room…'
      : 'Restoring your room…';
  const subtitle = isReady ? 'Returning to your Huddle' : 'Preparing your Huddle room';

  return (
    <View
      style={styles.viewport}
      pointerEvents="none"
      focusable={false}
      accessible
      accessibilityRole="text"
      accessibilityLabel={`Welcome back. ${title}. ${subtitle}. Room code ${spokenCode}.`}
      testID="tv-restoring-room-screen"
    >
      <PlayroomTvStage testID="tv-restoring-room-stage">
        <Animated.View
          style={[styles.content, { opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }]}
          pointerEvents="none"
          focusable={false}
          accessible={false}
        >
          <TvRestoreIndicator
            stage={renderedStage}
            size={132}
            reduceMotion={reduceMotion}
            onReadyAnimationComplete={() => readyCallbackRef.current?.()}
          />
          <PlayroomHeading type={playroomTv.type.hero} style={styles.title}>
            {title}
          </PlayroomHeading>
          <PlayroomText color="muted" style={[playroomTv.type.body, styles.subtitle]}>
            {subtitle}
          </PlayroomText>
          <PlayroomPill style={styles.code} textStyle={playroomTv.type.label}>
            {`Room ${code}`}
          </PlayroomPill>
        </Animated.View>
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
    position: 'absolute',
    top: 156,
    left: playroomTv.safeX,
    right: playroomTv.safeX,
    bottom: playroomTv.safeY,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 24,
  },
  title: {
    marginTop: 40,
  },
  subtitle: {
    marginTop: 12,
    textAlign: 'center',
  },
  code: {
    marginTop: 28,
    paddingHorizontal: 28,
  },
});
