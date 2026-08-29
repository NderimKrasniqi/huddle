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
// The boot illustration uses the TV app's existing SVG runtime for its logo
// face and sparkles; it remains display-only and has no controls.
// eslint-disable-next-line no-restricted-imports
import Svg, { Circle, Path } from 'react-native-svg';

import type {
  TvAnimatedBootPhase,
} from './boot-state';
import { tvBootAnimationCopy } from './boot-state';

const COLORS = {
  navy: '#06235C',
  coral: '#FF5B54',
  orange: '#FFAA21',
  blue: '#45A2F4',
  purple: '#8C6DEB',
  cream: '#FFF8EC',
} as const;

const STAGE_WIDTH = 1920;
const STAGE_HEIGHT = 1080;
const absoluteFill = {
  position: 'absolute',
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
} as const;

const SPARKLES = [
  { x: 0.24, y: 0.25, color: COLORS.purple, size: 24, delay: 0 },
  { x: 0.36, y: 0.08, color: COLORS.orange, size: 15, delay: 160 },
  { x: 0.63, y: 0.09, color: COLORS.blue, size: 22, delay: 330 },
  { x: 0.7, y: 0.19, color: COLORS.coral, size: 18, delay: 90 },
  { x: 0.29, y: 0.39, color: COLORS.orange, size: 17, delay: 440 },
  { x: 0.75, y: 0.44, color: COLORS.purple, size: 20, delay: 240 },
  { x: 0.66, y: 0.55, color: COLORS.orange, size: 15, delay: 520 },
] as const;

const LIGHTS = [0.05, 0.13, 0.23, 0.75, 0.84, 0.91, 0.965] as const;

type TvCreatingRoomScreenProps = {
  readonly phase: TvAnimatedBootPhase;
  readonly backgroundSource?: ImageSourcePropType;
};

/**
 * Display-only TV startup renderer. The room-opening operation remains owned
 * by the TV session coordinator; this component only presents its pending
 * phase and stops every animation when the phase leaves the boot lifecycle.
 */
export function TvCreatingRoomScreen({
  phase,
  backgroundSource = require('../../../assets/room-invitation/tv-lobby-background.png'),
}: TvCreatingRoomScreenProps) {
  const { width, height } = useWindowDimensions();
  const copy = tvBootAnimationCopy(phase);
  const rawScale = Math.min(width / STAGE_WIDTH, height / STAGE_HEIGHT);
  const scale = Number.isFinite(rawScale) && rawScale > 0 ? rawScale : 1;

  const sharpBackground = useAnimatedValue(0);
  const blurredBackground = useAnimatedValue(1);
  const ambient = useAnimatedValue(0);
  const pieceTL = useAnimatedValue(0);
  const pieceTR = useAnimatedValue(0);
  const pieceBL = useAnimatedValue(0);
  const pieceBR = useAnimatedValue(0);
  const face = useAnimatedValue(0);
  const wordmark = useAnimatedValue(0);
  const copyIn = useAnimatedValue(0);
  const spinnerIn = useAnimatedValue(0);
  const spinnerRotation = useAnimatedValue(0);
  const lightPulse = useAnimatedValue(0);
  const sparkleValues = useAnimatedValues(SPARKLES.length);
  const sparkleFloatValues = useAnimatedValues(SPARKLES.length);

  useEffect(() => {
    const assemblePiece = (
      value: Animated.Value,
      delay: number,
    ): Animated.CompositeAnimation =>
      Animated.timing(value, {
        toValue: 1,
        delay,
        duration: 380,
        easing: Easing.out(Easing.back(1.35)),
        useNativeDriver: true,
      });

    const intro = Animated.parallel([
      Animated.timing(sharpBackground, {
        toValue: 1,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(blurredBackground, {
        toValue: 0,
        duration: 520,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(ambient, {
        toValue: 1,
        delay: 220,
        duration: 420,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      assemblePiece(pieceTL, 510),
      assemblePiece(pieceTR, 565),
      assemblePiece(pieceBL, 620),
      assemblePiece(pieceBR, 675),
      Animated.timing(face, {
        toValue: 1,
        delay: 760,
        duration: 260,
        easing: Easing.out(Easing.back(1.6)),
        useNativeDriver: true,
      }),
      Animated.timing(wordmark, {
        toValue: 1,
        delay: 900,
        duration: 420,
        easing: Easing.out(Easing.back(1.15)),
        useNativeDriver: true,
      }),
      Animated.timing(copyIn, {
        toValue: 1,
        delay: 1160,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(spinnerIn, {
        toValue: 1,
        delay: 1410,
        duration: 300,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      ...sparkleValues.map((value, index) =>
        Animated.timing(value, {
          toValue: 1,
          delay: 240 + (SPARKLES[index]?.delay ?? 0),
          duration: 420,
          easing: Easing.out(Easing.back(1.25)),
          useNativeDriver: true,
        }),
      ),
    ]);

    const spinnerLoop = Animated.loop(
      Animated.timing(spinnerRotation, {
        toValue: 1,
        duration: 1300,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    const lightsLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(lightPulse, {
          toValue: 1,
          duration: 1150,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(lightPulse, {
          toValue: 0,
          duration: 1450,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    const sparkleLoops = sparkleFloatValues.map((value, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(350 + index * 90),
          Animated.timing(value, {
            toValue: 1,
            duration: 1500 + index * 120,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0,
            duration: 1500 + index * 120,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      ),
    );

    intro.start();
    spinnerLoop.start();
    lightsLoop.start();
    sparkleLoops.forEach((loop) => loop.start());

    return () => {
      intro.stop();
      spinnerLoop.stop();
      lightsLoop.stop();
      sparkleLoops.forEach((loop) => loop.stop());
    };
  }, [
    ambient,
    blurredBackground,
    copyIn,
    face,
    lightPulse,
    pieceBL,
    pieceBR,
    pieceTL,
    pieceTR,
    sharpBackground,
    sparkleFloatValues,
    sparkleValues,
    spinnerIn,
    spinnerRotation,
    wordmark,
  ]);

  const logoSize = 170 * scale;
  const wordmarkSize = 104 * scale;
  const titleSize = 48 * scale;
  const subtitleSize = 30 * scale;
  const iconPiece = logoSize * 0.42;
  const iconInset = logoSize * 0.055;
  const iconRadius = logoSize * 0.11;
  const faceSize = logoSize * 0.34;

  const pieceStyle = (
    value: Animated.Value,
    fromX: number,
    fromY: number,
    fromRotate: number,
  ) => ({
    opacity: value,
    transform: [
      {
        translateX: value.interpolate({
          inputRange: [0, 1],
          outputRange: [fromX * scale, 0],
        }),
      },
      {
        translateY: value.interpolate({
          inputRange: [0, 1],
          outputRange: [fromY * scale, 0],
        }),
      },
      {
        rotate: value.interpolate({
          inputRange: [0, 1],
          outputRange: [`${fromRotate}deg`, '0deg'],
        }),
      },
      {
        scale: value.interpolate({
          inputRange: [0, 0.65, 1],
          outputRange: [0.45, 1.08, 1],
        }),
      },
    ],
  });

  return (
    <View
      style={styles.root}
      pointerEvents="none"
      accessible
      focusable={false}
      accessibilityRole="text"
      accessibilityLabel={`${copy.title}. ${copy.subtitle}`}
      testID="tv-boot-animated"
    >
      <Animated.Image
        source={backgroundSource}
        resizeMode="cover"
        blurRadius={Platform.OS === 'android' ? 8 : 14}
        accessible={false}
        style={[absoluteFill, { opacity: blurredBackground }]}
        testID="tv-boot-background-blurred"
      />
      <Animated.Image
        source={backgroundSource}
        resizeMode="cover"
        accessible={false}
        style={[absoluteFill, { opacity: sharpBackground }]}
        testID="tv-boot-background"
      />

      <View style={styles.vignette} pointerEvents="none" />

      <Animated.View
        style={[absoluteFill, { opacity: ambient }]}
        pointerEvents="none"
      >
        {LIGHTS.map((x, index) => {
          const pulse = lightPulse.interpolate({
            inputRange: [0, 1],
            outputRange: [0.22 + (index % 2) * 0.06, 0.52 - (index % 2) * 0.04],
          });
          return (
            <Animated.View
              key={x}
              style={[
                styles.lightGlow,
                {
                  left: width * x - 32 * scale,
                  top: 20 * scale,
                  width: 64 * scale,
                  height: 64 * scale,
                  borderRadius: 32 * scale,
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
        const translateY = float.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -8 * scale],
        });
        const rotate = float.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', '8deg'],
        });

        return (
          <Animated.View
            key={`${sparkle.x}-${sparkle.y}`}
            pointerEvents="none"
            style={[
              styles.sparkle,
              {
                left: width * sparkle.x,
                top: height * sparkle.y,
                width: sparkle.size * scale,
                height: sparkle.size * scale,
                opacity: appear,
                transform: [
                  { translateY },
                  { rotate },
                  {
                    scale: appear.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.2, 1],
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

      <View
        style={[styles.content, { transform: [{ translateY: -22 * scale }] }]}
        pointerEvents="none"
      >
        <View style={styles.brandRow} pointerEvents="none">
          <View style={{ width: logoSize, height: logoSize }} pointerEvents="none">
            <Animated.View
              style={[
                styles.logoPiece,
                {
                  width: iconPiece,
                  height: iconPiece,
                  left: iconInset,
                  top: iconInset,
                  borderTopLeftRadius: iconRadius,
                  borderTopRightRadius: iconRadius,
                  borderBottomLeftRadius: iconRadius,
                  backgroundColor: COLORS.coral,
                },
                pieceStyle(pieceTL, -80, -70, -16),
              ]}
            />
            <Animated.View
              style={[
                styles.logoPiece,
                {
                  width: iconPiece,
                  height: iconPiece,
                  right: iconInset,
                  top: iconInset,
                  borderTopLeftRadius: iconRadius,
                  borderTopRightRadius: iconRadius,
                  borderBottomRightRadius: iconRadius,
                  backgroundColor: COLORS.orange,
                },
                pieceStyle(pieceTR, 85, -72, 16),
              ]}
            />
            <Animated.View
              style={[
                styles.logoPiece,
                {
                  width: iconPiece,
                  height: iconPiece,
                  left: iconInset,
                  bottom: iconInset,
                  borderTopLeftRadius: iconRadius,
                  borderBottomLeftRadius: iconRadius,
                  borderBottomRightRadius: iconRadius,
                  backgroundColor: COLORS.blue,
                },
                pieceStyle(pieceBL, -82, 70, 14),
              ]}
            />
            <Animated.View
              style={[
                styles.logoPiece,
                {
                  width: iconPiece,
                  height: iconPiece,
                  right: iconInset,
                  bottom: iconInset,
                  borderTopRightRadius: iconRadius,
                  borderBottomLeftRadius: iconRadius,
                  borderBottomRightRadius: iconRadius,
                  backgroundColor: COLORS.purple,
                },
                pieceStyle(pieceBR, 82, 72, -14),
              ]}
            />
            <Animated.View
              style={[
                styles.face,
                {
                  width: faceSize,
                  height: faceSize,
                  left: logoSize / 2 - faceSize / 2,
                  top: logoSize / 2 - faceSize / 2,
                  borderRadius: faceSize / 2,
                  opacity: face,
                  transform: [
                    {
                      scale: face.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.25, 1],
                      }),
                    },
                  ],
                },
              ]}
            >
              <Svg width={faceSize} height={faceSize} viewBox="0 0 100 100">
                <Circle cx="36" cy="43" r="5.7" fill={COLORS.navy} />
                <Circle cx="64" cy="43" r="5.7" fill={COLORS.navy} />
                <Path
                  d="M31 58 C38 72 62 72 69 58"
                  fill="none"
                  stroke={COLORS.navy}
                  strokeWidth="7"
                  strokeLinecap="round"
                />
              </Svg>
            </Animated.View>
          </View>

          <Animated.Text
            style={[
              styles.wordmark,
              {
                fontSize: wordmarkSize,
                marginLeft: 30 * scale,
                opacity: wordmark,
                transform: [
                  {
                    scale: wordmark.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.82, 1],
                    }),
                  },
                  {
                    translateY: wordmark.interpolate({
                      inputRange: [0, 1],
                      outputRange: [12 * scale, 0],
                    }),
                  },
                ],
              },
            ]}
            accessibilityElementsHidden
          >
            Huddle
          </Animated.Text>
        </View>

        <Animated.View
          style={{
            alignItems: 'center',
            opacity: copyIn,
            transform: [
              {
                translateY: copyIn.interpolate({
                  inputRange: [0, 1],
                  outputRange: [24 * scale, 0],
                }),
              },
            ],
          }}
          pointerEvents="none"
        >
          <Text
            style={[styles.title, { fontSize: titleSize, marginTop: 26 * scale }]}
          >
            {copy.title}
          </Text>
          <Text
            style={[styles.subtitle, { fontSize: subtitleSize, marginTop: 8 * scale }]}
          >
            {copy.subtitle}
          </Text>
        </Animated.View>

        <Animated.View
          style={[
            styles.spinnerWrap,
            {
              width: 62 * scale,
              height: 62 * scale,
              marginTop: 32 * scale,
              opacity: spinnerIn,
              transform: [
                {
                  scale: spinnerIn.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.7, 1],
                  }),
                },
                {
                  rotate: spinnerRotation.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', '360deg'],
                  }),
                },
              ],
            },
          ]}
          pointerEvents="none"
          accessibilityElementsHidden
        >
          {Array.from({ length: 8 }).map((_, index) => {
            const angle = (index / 8) * Math.PI * 2;
            const radius = 23 * scale;
            const dotSize = 8 * scale;
            const palette = [COLORS.coral, COLORS.orange, COLORS.purple, COLORS.blue];
            return (
              <View
                key={index}
                style={{
                  position: 'absolute',
                  width: dotSize,
                  height: dotSize,
                  borderRadius: dotSize / 2,
                  backgroundColor: palette[index % palette.length],
                  left: 31 * scale + Math.cos(angle) * radius - dotSize / 2,
                  top: 31 * scale + Math.sin(angle) * radius - dotSize / 2,
                  opacity: 0.5 + (index / 8) * 0.5,
                }}
              />
            );
          })}
        </Animated.View>
      </View>
    </View>
  );
}

function useAnimatedValue(initialValue: number) {
  const [value] = React.useState(() => new Animated.Value(initialValue));
  return value;
}

function useAnimatedValues(count: number) {
  return React.useMemo(
    () => Array.from({ length: count }, () => new Animated.Value(0)),
    [count],
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F7D6AC',
    overflow: 'hidden',
  },
  vignette: {
    ...absoluteFill,
    backgroundColor: 'rgba(255,248,236,0.03)',
  },
  content: {
    ...absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoPiece: {
    position: 'absolute',
  },
  face: {
    position: 'absolute',
    backgroundColor: COLORS.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmark: {
    color: COLORS.navy,
    fontWeight: '800',
    letterSpacing: -2.2,
    includeFontPadding: false,
  },
  title: {
    color: COLORS.coral,
    fontWeight: '800',
    includeFontPadding: false,
  },
  subtitle: {
    color: COLORS.navy,
    fontWeight: '600',
    includeFontPadding: false,
  },
  spinnerWrap: {
    position: 'relative',
  },
  sparkle: {
    position: 'absolute',
  },
  lightGlow: {
    position: 'absolute',
    backgroundColor: '#FFF4C7',
    shadowColor: '#FFF0A6',
    shadowOpacity: 0.9,
    shadowRadius: 26,
    elevation: 4,
  },
});
