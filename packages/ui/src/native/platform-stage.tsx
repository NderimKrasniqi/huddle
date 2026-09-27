import {
  platformTheme,
  radii,
  semanticColors,
  shadows,
  spacing,
  type TypographyToken,
} from '@huddle/design-tokens';
import type { PropsWithChildren, ReactNode } from 'react';
import {
  Image,
  ImageBackground,
  StyleSheet,
  View,
  useWindowDimensions,
  type ImageSourcePropType,
  type StyleProp,
  type TextStyle,
  type ViewProps,
  type ViewStyle,
} from 'react-native';

import { HEARTBEAT_ARTWORK } from './artwork';
import { HuddleText } from './huddle-text';

export type PlatformStageProps = PropsWithChildren<
  Omit<ViewProps, 'style'> & {
    readonly backgroundSource?: ImageSourcePropType;
    readonly backgroundTestID?: string;
    readonly shadeOpacity?: number;
    readonly style?: StyleProp<ViewStyle>;
  }
>;

/**
 * The shared 16:9 Huddle room. Platform screens compose native content over
 * this stage; game modules own their own worlds and do not use this wrapper.
 */
export function PlatformStage({
  children,
  backgroundSource = HEARTBEAT_ARTWORK.tv.platformLivingRoom,
  backgroundTestID,
  shadeOpacity = 0.14,
  style,
  ...viewProps
}: PlatformStageProps) {
  const viewport = useWindowDimensions();
  const scale = safeScale(viewport.width, viewport.height);

  return (
    <View style={styles.viewport} {...viewProps}>
      <View
        style={[styles.stage, { transform: [{ scale }] }, style]}
        pointerEvents="none"
        focusable={false}
        accessible={false}
      >
        <ImageBackground
          source={backgroundSource}
          resizeMode="cover"
          style={StyleSheet.absoluteFill}
          accessible={false}
          testID={backgroundTestID}
        />
        <View
          style={[styles.stageShade, { opacity: shadeOpacity }]}
          pointerEvents="none"
          focusable={false}
        />
        {children}
      </View>
    </View>
  );
}

export type PlatformBrandLockupProps = {
  readonly label?: string;
  readonly markSize?: number;
  readonly markTestID?: string;
  readonly style?: StyleProp<ViewStyle>;
  readonly textStyle?: StyleProp<TextStyle>;
  readonly testID?: string;
};

/** Brand anchor shared by platform room, picker, and recovery surfaces. */
export function PlatformBrandLockup({
  label = 'Huddle',
  markSize = 72,
  markTestID,
  style,
  textStyle,
  testID,
}: PlatformBrandLockupProps) {
  return (
    <View style={[styles.brandRow, style]} pointerEvents="none" focusable={false} accessible={false} testID={testID}>
      <Image
        source={HEARTBEAT_ARTWORK.brand.displayMark}
        resizeMode="contain"
        style={{ width: markSize, height: markSize }}
        accessible={false}
        testID={markTestID}
      />
      <HuddleText variant="hero" color="surface" style={[styles.brandName, textStyle]}>
        {label}
      </HuddleText>
    </View>
  );
}

export type PlatformRailProps = PropsWithChildren<
  Omit<ViewProps, 'style'> & {
    readonly style?: StyleProp<ViewStyle>;
  }
>;

/** A quiet direct-content rail; use it to group live room information. */
export function PlatformRail({ children, style, ...viewProps }: PlatformRailProps) {
  return (
    <View
      {...viewProps}
      style={[styles.rail, style]}
      pointerEvents="none"
      focusable={false}
    >
      {children}
    </View>
  );
}

export type PlatformQrFrameProps = PropsWithChildren<
  Omit<ViewProps, 'style'> & {
    readonly style?: StyleProp<ViewStyle>;
  }
>;

/** The only intentionally bright platform surface: the QR must scan from a TV. */
export function PlatformQrFrame({ children, style, ...viewProps }: PlatformQrFrameProps) {
  return (
    <View
      {...viewProps}
      style={[styles.qrFrame, style]}
      pointerEvents="none"
      focusable={false}
    >
      {children}
    </View>
  );
}

export type PlatformRoomCodeProps = {
  readonly code?: string;
  readonly length?: number;
  readonly spokenCode?: string;
  readonly accessibilityLabel?: string;
  readonly testID?: string;
};

/** Large native room-code treatment used by the invitation stage. */
export function PlatformRoomCode({
  code = '',
  length = 4,
  spokenCode,
  accessibilityLabel,
  testID,
}: PlatformRoomCodeProps) {
  const normalizedCode = code.toUpperCase();
  const tiles = Array.from({ length }, (_unused, index) => normalizedCode[index] ?? '');
  const spoken = spokenCode ?? tiles.join(' ');

  return (
    <View
      style={styles.codeRow}
      pointerEvents="none"
      focusable={false}
      accessible
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel ?? `Room code ${spoken}`}
      testID={testID}
    >
      {tiles.map((value, index) => (
        <View key={`${index}-${value}`} style={styles.codeTile} pointerEvents="none" focusable={false}>
          <HuddleText variant="hero" color="text" style={styles.codeValue}>
            {value}
          </HuddleText>
        </View>
      ))}
      <HuddleText variant="caption" color="surface" style={styles.visuallyHidden}>
        {spoken}
      </HuddleText>
    </View>
  );
}

export type PlatformPortalProps = PropsWithChildren<{
  readonly accentColor: string;
  readonly selected?: boolean;
  readonly status?: ReactNode;
  readonly title: string;
  readonly accessibilityLabel?: string;
  readonly style?: StyleProp<ViewStyle>;
  readonly testID?: string;
}>;

/**
 * A platform carousel portal. It is an open stage window for game art, not a
 * generic app card; the selected portal gains light and a small native label.
 */
export function PlatformPortal({
  accentColor,
  children,
  selected = false,
  status,
  title,
  accessibilityLabel,
  style,
  testID,
}: PlatformPortalProps) {
  return (
    <View
      style={[styles.portal, selected ? styles.selectedPortal : null, style]}
      pointerEvents="none"
      focusable={false}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel ?? `${title}${selected ? ', selected' : ''}`}
      testID={testID}
    >
      <View
        style={[styles.portalAura, { backgroundColor: accentColor, opacity: selected ? 0.36 : 0.14 }]}
        pointerEvents="none"
        focusable={false}
      />
      <View style={styles.portalArtwork} pointerEvents="none" focusable={false}>
        {children}
      </View>
      <View style={styles.portalLabel} pointerEvents="none" focusable={false}>
        <HuddleText variant="title" color="surface" align="center" style={styles.portalTitle} numberOfLines={2}>
          {title}
        </HuddleText>
        {status}
      </View>
      {selected ? <View style={styles.selectionDot} pointerEvents="none" focusable={false} /> : null}
    </View>
  );
}

function safeScale(width: number, height: number): number {
  const scale = Math.min(width / platformTheme.geometry.width, height / platformTheme.geometry.height);
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
    width: platformTheme.geometry.width,
    height: platformTheme.geometry.height,
    overflow: 'hidden',
  },
  stageShade: {
    ...StyleSheet.absoluteFill,
    backgroundColor: platformTheme.colors.ink,
  },
  brandRow: {
    position: 'absolute',
    left: platformTheme.geometry.brandLeft,
    top: platformTheme.geometry.brandTop,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  brandName: {
    fontSize: 52,
    lineHeight: 62,
  },
  rail: {
    ...platformTheme.surfaces.rail,
  },
  qrFrame: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.lg,
    backgroundColor: platformTheme.colors.cream,
    ...shadows.floating,
  },
  codeRow: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  codeTile: {
    width: 88,
    height: 98,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.lg,
    ...platformTheme.surfaces.code,
    ...shadows.card,
  },
  codeValue: {
    fontSize: 56,
    lineHeight: 64,
  },
  visuallyHidden: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
  portal: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'hidden',
    borderRadius: radii.xl,
  },
  selectedPortal: {
    ...platformTheme.surfaces.portal,
    borderColor: platformTheme.colors.borderStrong,
  },
  portalAura: {
    position: 'absolute',
    left: '8%',
    right: '8%',
    top: '14%',
    bottom: '18%',
    borderRadius: radii.round,
  },
  portalArtwork: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 82,
    alignItems: 'center',
    justifyContent: 'center',
  },
  portalLabel: {
    minHeight: 82,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderTopWidth: 1,
    borderTopColor: platformTheme.colors.border,
    backgroundColor: platformTheme.colors.inkSoft,
  },
  portalTitle: {
    fontSize: 30,
    lineHeight: 36,
  },
  selectionDot: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    width: 18,
    height: 18,
    borderRadius: radii.round,
    backgroundColor: platformTheme.colors.gold,
    borderWidth: 4,
    borderColor: platformTheme.colors.cream,
  },
});

export type PlatformTextRole = TypographyToken;
