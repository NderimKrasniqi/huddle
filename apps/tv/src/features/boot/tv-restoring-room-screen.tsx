/* eslint-disable no-restricted-imports -- this is the approved display-only TV restore renderer. */
import React, { useEffect } from 'react';
import {
  Animated,
  Easing,
  Platform,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ImageSourcePropType,
} from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
/* eslint-enable no-restricted-imports */

import {
  TvRestoreIndicator,
  type TvRestoreIndicatorStage,
} from './tv-restore-indicator';

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
};

export const TV_RESTORE_READY_DELAY_MS = 1_300;

const COLORS = {
  navy: '#06235C',
  coral: '#FF5B54',
  cream: '#FFF8EC',
  panel: 'rgba(255,248,236,0.9)',
} as const;

const STAGE_WIDTH = 1280;
const STAGE_HEIGHT = 720;
const absoluteFill = {
  position: 'absolute',
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
} as const;

const SPARKLES = [
  { x: 0.24, y: 0.24, color: '#8C6DEB', size: 24, delay: 120 },
  { x: 0.35, y: 0.08, color: '#FFAA21', size: 15, delay: 260 },
  { x: 0.63, y: 0.09, color: '#45A2F4', size: 22, delay: 400 },
  { x: 0.7, y: 0.18, color: '#FF5B54', size: 18, delay: 210 },
  { x: 0.29, y: 0.39, color: '#FFAA21', size: 17, delay: 480 },
  { x: 0.75, y: 0.44, color: '#8C6DEB', size: 20, delay: 310 },
] as const;

const LIGHTS = [0.05, 0.13, 0.23, 0.75, 0.84, 0.91, 0.965] as const;

/**
 * Display-only TV restore handoff. A restored room gets one short visual
 * confirmation before the coordinator returns to the live room surface.
 */
export function TvRestoringRoomScreen({
  roomCode,
  stage,
  onReady,
  onReadyAnimationComplete,
  backgroundSource = require('../../../assets/room-invitation/tv-lobby-background.png'),
}: TvRestoringRoomScreenProps) {
  const viewport = useWindowDimensions();
  const rawScale = Math.min(
    viewport.width / STAGE_WIDTH,
    viewport.height / STAGE_HEIGHT,
  );
  const scale = Number.isFinite(rawScale) && rawScale > 0 ? rawScale : 1;
  const [internalStage, setInternalStage] = React.useState<TvRestoringRoomStage>('restoring');
  const readyCallback = onReadyAnimationComplete ?? onReady;
  const readyCallbackRef = React.useRef(readyCallback);
  const renderedStage = stage ?? internalStage;
  const normalizedCode = roomCode.trim().toUpperCase().slice(0, 4);
  const spokenCode = normalizedCode.split('').join(' ');
  const isReady = renderedStage === 'ready';

  const sharpBackground = React.useState(() => new Animated.Value(0))[0];
  const blurredBackground = React.useState(() => new Animated.Value(1))[0];
  const ambient = React.useState(() => new Animated.Value(0))[0];
  const contentOpacity = React.useState(() => new Animated.Value(0))[0];
  const headline = React.useState(() => new Animated.Value(0))[0];
  const statusIn = React.useState(() => new Animated.Value(0))[0];
  const codeIn = React.useState(() => new Animated.Value(0))[0];
  const indicatorIn = React.useState(() => new Animated.Value(0))[0];
  const readyLift = React.useState(() => new Animated.Value(0))[0];
  const lightPulse = React.useState(() => new Animated.Value(0))[0];
  const sparkleValues = useAnimatedValues(SPARKLES.length);
  const sparkleFloatValues = useAnimatedValues(SPARKLES.length);

  useEffect(() => {
    const entrance = Animated.parallel([
      Animated.timing(sharpBackground, {
        toValue: 1,
        duration: 440,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(blurredBackground, {
        toValue: 0,
        duration: 560,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(ambient, {
        toValue: 1,
        delay: 190,
        duration: 430,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(contentOpacity, {
        toValue: 1,
        delay: 180,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(headline, {
        toValue: 1,
        delay: 430,
        duration: 430,
        easing: Easing.out(Easing.back(1.1)),
        useNativeDriver: true,
      }),
      Animated.timing(statusIn, {
        toValue: 1,
        delay: 650,
        duration: 360,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(codeIn, {
        toValue: 1,
        delay: 810,
        duration: 380,
        easing: Easing.out(Easing.back(1.12)),
        useNativeDriver: true,
      }),
      Animated.timing(indicatorIn, {
        toValue: 1,
        delay: 990,
        duration: 300,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      ...sparkleValues.map((value, index) =>
        Animated.timing(value, {
          toValue: 1,
          delay: 210 + SPARKLES[index]!.delay,
          duration: 430,
          easing: Easing.out(Easing.back(1.2)),
          useNativeDriver: true,
        }),
      ),
    ]);
    const lightsLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(lightPulse, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(lightPulse, {
          toValue: 0,
          duration: 1500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    const sparkleLoops = sparkleFloatValues.map((float, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(280 + index * 120),
          Animated.timing(float, {
            toValue: 1,
            duration: 1500 + index * 130,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(float, {
            toValue: 0,
            duration: 1500 + index * 130,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      ),
    );

    entrance.start();
    lightsLoop.start();
    sparkleLoops.forEach((loop) => loop.start());

    return () => {
      entrance.stop();
      lightsLoop.stop();
      sparkleLoops.forEach((loop) => loop.stop());
    };
  }, [
    ambient,
    blurredBackground,
    codeIn,
    contentOpacity,
    headline,
    indicatorIn,
    lightPulse,
    sharpBackground,
    sparkleFloatValues,
    sparkleValues,
    statusIn,
  ]);

  useEffect(() => {
    const lift = Animated.spring(readyLift, {
      toValue: isReady ? 1 : 0,
      useNativeDriver: true,
      damping: 15,
      stiffness: 180,
      mass: 0.8,
    });
    lift.start();

    return () => lift.stop();
  }, [isReady, readyLift]);

  useEffect(() => {
    readyCallbackRef.current = readyCallback;
  }, [readyCallback]);

  useEffect(() => {
    if (stage !== undefined) return;

    const readyTimer = setTimeout(() => {
      setInternalStage('ready');
    }, TV_RESTORE_READY_DELAY_MS);

    return () => clearTimeout(readyTimer);
  }, [stage]);

  const title = isReady
    ? 'Your room is ready'
    : renderedStage === 'reconnecting'
      ? 'Reconnecting your room…'
      : 'Restoring your room…';
  const subtitle = isReady
    ? 'Returning to your Huddle'
    : 'Preparing your Huddle room';
  const logoSize = 76 * scale;
  const titleSize = 42 * scale;
  const subtitleSize = 25 * scale;
  const codeSize = 54 * scale;

  return (
    <View
      style={styles.root}
      pointerEvents="none"
      accessible
      focusable={false}
      accessibilityRole="text"
      accessibilityLabel={`Welcome back. ${title}. ${subtitle}. Room code ${spokenCode}.`}
      testID="tv-restoring-room-screen"
    >
      <Animated.Image
        source={backgroundSource}
        resizeMode="cover"
        blurRadius={Platform.OS === 'android' ? 8 : 14}
        accessible={false}
        style={[absoluteFill, { opacity: blurredBackground }]}
        testID="tv-restoring-room-background-blurred"
      />
      <Animated.Image
        source={backgroundSource}
        resizeMode="cover"
        accessible={false}
        style={[absoluteFill, { opacity: sharpBackground }]}
        testID="tv-restoring-room-background"
      />
      <View style={styles.wash} pointerEvents="none" />

      <Animated.View
        style={[absoluteFill, { opacity: ambient }]}
        pointerEvents="none"
      >
        {LIGHTS.map((x, index) => {
          const pulse = lightPulse.interpolate({
            inputRange: [0, 1],
            outputRange: [0.2 + (index % 2) * 0.05, 0.5 - (index % 2) * 0.04],
          });
          return (
            <Animated.View
              key={x}
              style={[
                styles.lightGlow,
                {
                  left: viewport.width * x - 34 * scale,
                  top: 18 * scale,
                  width: 68 * scale,
                  height: 68 * scale,
                  borderRadius: 34 * scale,
                  opacity: pulse,
                },
              ]}
            />
          );
        })}
      </Animated.View>

      {SPARKLES.map((sparkle, index) => {
        const appear = sparkleValues[index]!;
        const float = sparkleFloatValues[index]!;
        return (
          <Animated.View
            key={`${sparkle.x}-${sparkle.y}`}
            pointerEvents="none"
            style={[
              styles.sparkle,
              {
                left: viewport.width * sparkle.x,
                top: viewport.height * sparkle.y,
                width: sparkle.size * scale,
                height: sparkle.size * scale,
                opacity: appear,
                transform: [
                  {
                    translateY: float.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, -8 * scale],
                    }),
                  },
                  {
                    rotate: float.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0deg', '8deg'],
                    }),
                  },
                  {
                    scale: appear.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.25, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            <Svg width="100%" height="100%" viewBox="0 0 100 100">
              <Path
                d="M50 4 C54 33 67 46 96 50 C67 54 54 67 50 96 C46 67 33 54 4 50 C33 46 46 33 50 4Z"
                fill={sparkle.color}
              />
            </Svg>
          </Animated.View>
        );
      })}

      <Animated.View
        style={[
          styles.content,
          {
            opacity: contentOpacity,
            transform: [
              {
                translateY: Animated.add(
                  contentOpacity.interpolate({
                    inputRange: [0, 1],
                    outputRange: [18 * scale, 0],
                  }),
                  readyLift.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -8 * scale],
                  }),
                ),
              },
            ],
          },
        ]}
        pointerEvents="none"
      >
        <View style={styles.panel} pointerEvents="none">
          <Animated.View
            style={[
              styles.headlineBlock,
              {
                opacity: headline,
                transform: [
                  {
                    translateY: headline.interpolate({
                      inputRange: [0, 1],
                      outputRange: [24 * scale, 0],
                    }),
                  },
                  {
                    scale: headline.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.94, 1],
                    }),
                  },
                ],
              },
            ]}
            pointerEvents="none"
          >
            <View style={styles.brandRow} pointerEvents="none">
              <View style={{ width: logoSize, height: logoSize }} pointerEvents="none">
                <View
                  style={[
                    styles.logoPiece,
                    {
                      width: logoSize * 0.41,
                      height: logoSize * 0.41,
                      left: logoSize * 0.06,
                      top: logoSize * 0.06,
                      borderTopLeftRadius: logoSize * 0.1,
                      borderTopRightRadius: logoSize * 0.1,
                      borderBottomLeftRadius: logoSize * 0.1,
                      backgroundColor: '#FF5B54',
                    },
                  ]}
                />
                <View
                  style={[
                    styles.logoPiece,
                    {
                      width: logoSize * 0.41,
                      height: logoSize * 0.41,
                      right: logoSize * 0.06,
                      top: logoSize * 0.06,
                      borderTopLeftRadius: logoSize * 0.1,
                      borderTopRightRadius: logoSize * 0.1,
                      borderBottomRightRadius: logoSize * 0.1,
                      backgroundColor: '#FFAA21',
                    },
                  ]}
                />
                <View
                  style={[
                    styles.logoPiece,
                    {
                      width: logoSize * 0.41,
                      height: logoSize * 0.41,
                      left: logoSize * 0.06,
                      bottom: logoSize * 0.06,
                      borderTopLeftRadius: logoSize * 0.1,
                      borderBottomLeftRadius: logoSize * 0.1,
                      borderBottomRightRadius: logoSize * 0.1,
                      backgroundColor: '#45A2F4',
                    },
                  ]}
                />
                <View
                  style={[
                    styles.logoPiece,
                    {
                      width: logoSize * 0.41,
                      height: logoSize * 0.41,
                      right: logoSize * 0.06,
                      bottom: logoSize * 0.06,
                      borderTopRightRadius: logoSize * 0.1,
                      borderBottomLeftRadius: logoSize * 0.1,
                      borderBottomRightRadius: logoSize * 0.1,
                      backgroundColor: '#8C6DEB',
                    },
                  ]}
                />
                <View
                  style={[
                    styles.logoFace,
                    {
                      width: logoSize * 0.32,
                      height: logoSize * 0.32,
                      left: logoSize * 0.34,
                      top: logoSize * 0.34,
                      borderRadius: logoSize * 0.16,
                    },
                  ]}
                >
                  <Svg width={logoSize * 0.32} height={logoSize * 0.32} viewBox="0 0 100 100">
                    <Circle cx="36" cy="43" r="6" fill={COLORS.navy} />
                    <Circle cx="64" cy="43" r="6" fill={COLORS.navy} />
                    <Path
                      d="M31 58 C38 72 62 72 69 58"
                      fill="none"
                      stroke={COLORS.navy}
                      strokeWidth="7"
                      strokeLinecap="round"
                    />
                  </Svg>
                </View>
              </View>
              <Text style={[styles.wordmark, { fontSize: 58 * scale }]}>Huddle</Text>
            </View>
            <Text style={[styles.welcome, { fontSize: 24 * scale }]}>Welcome back!</Text>
          </Animated.View>

          <Animated.View
            style={{
              alignItems: 'center',
              opacity: statusIn,
              transform: [
                {
                  translateY: statusIn.interpolate({
                    inputRange: [0, 1],
                    outputRange: [18 * scale, 0],
                  }),
                },
              ],
            }}
            pointerEvents="none"
          >
            <Text style={[styles.title, { fontSize: titleSize }]}>{title}</Text>
            <Text style={[styles.subtitle, { fontSize: subtitleSize }]}>{subtitle}</Text>
          </Animated.View>

          <Animated.View
            style={{
              alignItems: 'center',
              opacity: codeIn,
              transform: [
                {
                  translateY: codeIn.interpolate({
                    inputRange: [0, 1],
                    outputRange: [10 * scale, 0],
                  }),
                },
                {
                  scale: codeIn.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.88, 1],
                  }),
                },
              ],
            }}
            pointerEvents="none"
          >
            <View
              accessible
              focusable={false}
              accessibilityLabel={`Room code ${spokenCode}`}
              testID="tv-restoring-room-code-panel"
            >
              <Text
                style={[
                  styles.roomCode,
                  { fontSize: codeSize, letterSpacing: 12 * scale },
                ]}
                testID="tv-restoring-room-code"
              >
                {spokenCode}
              </Text>
            </View>
          </Animated.View>

          <Animated.View
            style={{
              marginTop: 22 * scale,
              opacity: indicatorIn,
              transform: [
                {
                  scale: indicatorIn.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.75, 1],
                  }),
                },
              ],
            }}
            pointerEvents="none"
          >
            <TvRestoreIndicator
              stage={renderedStage}
              size={70 * scale}
              onReadyAnimationComplete={
                renderedStage === 'ready'
                  ? () => readyCallbackRef.current?.()
                  : undefined
              }
            />
          </Animated.View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F7D6AC',
    overflow: 'hidden',
  },
  wash: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(255,248,236,0.12)',
  },
  content: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  panel: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 510,
    paddingHorizontal: 66,
    paddingVertical: 40,
    borderRadius: 34,
    backgroundColor: COLORS.panel,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headlineBlock: {
    alignItems: 'center',
  },
  logoPiece: {
    position: 'absolute',
  },
  logoFace: {
    position: 'absolute',
    backgroundColor: COLORS.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmark: {
    marginLeft: 20,
    color: COLORS.navy,
    fontWeight: '800',
    letterSpacing: -1.5,
    includeFontPadding: false,
  },
  title: {
    marginTop: 24,
    color: COLORS.coral,
    fontWeight: '800',
    includeFontPadding: false,
  },
  welcome: {
    marginTop: 20,
    color: COLORS.navy,
    fontWeight: '700',
    includeFontPadding: false,
  },
  roomCode: {
    marginTop: 16,
    color: COLORS.navy,
    fontWeight: '800',
    includeFontPadding: false,
  },
  subtitle: {
    marginTop: 12,
    marginBottom: 22,
    color: COLORS.navy,
    fontWeight: '600',
    includeFontPadding: false,
  },
  lightGlow: {
    position: 'absolute',
    backgroundColor: 'rgba(255,244,201,0.9)',
    shadowColor: '#FFF2C8',
    shadowOpacity: 0.9,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 0 },
  },
  sparkle: {
    position: 'absolute',
  },
});

function useAnimatedValues(count: number) {
  return React.useMemo(
    () => Array.from({ length: count }, () => new Animated.Value(0)),
    [count],
  );
}
