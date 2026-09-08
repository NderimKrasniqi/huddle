import { semanticColors, spacing } from '@huddle/design-tokens';
import { HEARTBEAT_ARTWORK, HuddleText } from '@huddle/ui/native';
import React, { useEffect } from 'react';
import {
  Animated,
  Easing,
  ImageBackground,
  StyleSheet,
  View,
  useWindowDimensions,
  type ImageSourcePropType,
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
  readonly backgroundSource?: ImageSourcePropType;
  /** Override the motion preference for deterministic previews/tests. */
  readonly reduceMotion?: boolean;
};

export const TV_RESTORE_READY_DELAY_MS = 1_300;

/** Display-only Heartbeat restore handoff for a persisted TV room. */
export function TvRestoringRoomScreen({
  roomCode,
  stage,
  onReady,
  onReadyAnimationComplete,
  backgroundSource = HEARTBEAT_ARTWORK.tv.platformLivingRoom,
  reduceMotion: reduceMotionOverride,
}: TvRestoringRoomScreenProps) {
  const viewport = useWindowDimensions();
  const systemReduceMotion = useTvSystemReducedMotion();
  const reduceMotion = resolveTvReducedMotion(reduceMotionOverride, systemReduceMotion);
  const motionPreferenceResolved = reduceMotionOverride !== undefined || systemReduceMotion !== undefined;
  const scale = safeScale(viewport.width, viewport.height);
  const [internalStage, setInternalStage] = React.useState<TvRestoringRoomStage>('restoring');
  const readyCallback = onReadyAnimationComplete ?? onReady;
  const readyCallbackRef = React.useRef(readyCallback);
  const renderedStage =
    stage ?? (motionPreferenceResolved && reduceMotion ? 'ready' : internalStage);
  const spokenCode = roomCode.trim().toUpperCase().slice(0, 4).split('').join(' ');
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
      duration: 420,
      easing: Easing.out(Easing.cubic),
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
      <View
        style={[styles.stage, { transform: [{ scale }] }]}
        pointerEvents="none"
        focusable={false}
        accessible={false}
      >
        <ImageBackground
          source={backgroundSource}
          resizeMode="cover"
          style={StyleSheet.absoluteFill}
          accessible={false}
          testID="tv-restoring-room-background"
        />
        <View style={styles.warmWash} pointerEvents="none" focusable={false} />
        <Animated.View
          style={[styles.content, { opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) }] }]}
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
          <HuddleText variant="tvDisplay" color="surface" align="center" style={styles.title}>
            {title}
          </HuddleText>
          <HuddleText variant="bodyLarge" color="surface" align="center" style={styles.subtitle}>
            {subtitle}
          </HuddleText>
        </Animated.View>
      </View>
    </View>
  );
}

function safeScale(width: number, height: number): number {
  const scale = Math.min(width / 1920, height / 1080);
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
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
  warmWash: {
    ...StyleSheet.absoluteFill,
    backgroundColor: semanticColors.text,
    opacity: 0.66,
  },
  content: {
    position: 'absolute',
    top: 156,
    left: 96,
    right: 96,
    bottom: 54,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 24,
  },
  title: {
    marginTop: spacing.xl,
    color: semanticColors.surface,
  },
  subtitle: {
    marginTop: spacing.sm,
    color: semanticColors.surface,
    opacity: 0.86,
  },
});
