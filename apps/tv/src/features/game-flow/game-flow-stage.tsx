import { CAROUSEL_REGISTRY, carouselWindow, gameModuleById } from '@huddle/game-registry';
import { HEARTBEAT_ARTWORK, HuddleText, huddleAvatarSource } from '@huddle/ui/native';
import { radii, semanticColors, shadows, spacing } from '@huddle/design-tokens';
import { Image, ImageBackground, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useEffect, useMemo, useState } from 'react';

import type { RosterSeat } from '../../models';
import {
  resolveTvReducedMotion,
  useTvSystemReducedMotion,
} from '../../ui/reduced-motion';
import { gameArtAsset, gameCardAsset } from './assets';
import { TvGameCarouselScreen } from './game-carousel-screen';
import {
  TV_GAME_ART_REVEAL_DURATION_MS,
  TvSelectedGameArtScreen,
} from './game-art-reveal-screen';
import {
  tvReadiness,
  type TvGameCarouselCard,
  type TvGamePlayer,
} from './game-flow-model';
import { TvReadyToStartScreen } from './game-ready-screen';
import { TvGameSetupScreen } from './game-setup-screen';

/** The Convex setup projection consumed by the display-only flow. */
export type TvGameSetupProjection = {
  readonly gameId: string;
  readonly settings: Readonly<Record<string, string>>;
  readonly mode: 'quick' | 'standard' | 'custom';
  readonly stage: 'configuring' | 'ready';
  readonly readyPlayerIds: readonly string[];
};

export type TvGameFlowStageProps = {
  /** `null` means no Host selection has started; `undefined` is still loading. */
  readonly browsingAt: number | null | undefined;
  readonly setup: TvGameSetupProjection | null | undefined;
  readonly roster: readonly RosterSeat[];
  readonly roomCode?: string;
  readonly reduceMotion?: boolean;
};

/**
 * Coordinates the TV's pre-game presentation without becoming a second source
 * of game state. Convex owns the browsing position, setup draft, and readiness;
 * the only local state here is whether this particular selection's decorative
 * art reveal has completed.
 */
export function TvGameFlowStage({
  browsingAt,
  setup,
  roster,
  roomCode,
  reduceMotion: reduceMotionOverride,
}: TvGameFlowStageProps) {
  const systemReduceMotion = useTvSystemReducedMotion();
  const reduceMotion = resolveTvReducedMotion(reduceMotionOverride, systemReduceMotion);
  const cards = useMemo<TvGameCarouselCard[]>(
    () =>
      CAROUSEL_REGISTRY.map((game) => ({
        id: game.metadata.id,
        title: game.metadata.title,
        subtitle: game.placeholder === true ? 'Coming soon' : carouselSubtitle(game.metadata.id),
        available: game.placeholder !== true,
        image: gameCardAsset(game.metadata.id),
      })),
    [],
  );
  const hostName = roster.find((seat) => seat.host)?.nickname;
  const selectedIndex = carouselWindow(browsingAt ?? 0)?.index ?? 0;

  if (setup === null || setup === undefined) {
    return (
      <TvGameCarouselScreen
        hostName={hostName}
        selectedIndex={selectedIndex}
        cards={cards}
        reduceMotion={reduceMotion}
      />
    );
  }

  const selectedGame = gameModuleById(setup.gameId);
  if (selectedGame === undefined) {
    return (
      <TvPlatformStatusScreen
        kind="error"
        title="Game unavailable"
        message="This game is not installed on this Huddle TV. Return to the phone to choose another."
        testID="tv-game-flow-unavailable"
        roomCode={roomCode}
      />
    );
  }

  return (
    <TvGameSetupHandoff
      key={setup.gameId}
      setup={setup}
      selectedGame={selectedGame}
      hostName={hostName}
      roster={roster}
      roomCode={roomCode}
      reduceMotion={reduceMotion}
    />
  );
}

function TvGameSetupHandoff({
  setup,
  selectedGame,
  hostName,
  roster,
  roomCode,
  reduceMotion,
}: {
  readonly setup: TvGameSetupProjection;
  readonly selectedGame: NonNullable<ReturnType<typeof gameModuleById>>;
  readonly hostName?: string;
  readonly roster: readonly RosterSeat[];
  readonly roomCode?: string;
  readonly reduceMotion: boolean;
}) {
  const artAvailable = gameArtAsset(setup.gameId) !== undefined;
  const [revealCompleteState, setRevealComplete] = useState(
    () => reduceMotion || !artAvailable,
  );
  const revealComplete = revealCompleteState || reduceMotion || !artAvailable;

  useEffect(() => {
    // Motion can be enabled after the first static frame, but a mounted
    // selection must never replay its art reveal when that preference changes
    // back to normal motion. A new setup/game key owns the only reset.
    if (!reduceMotion) return;
    let active = true;
    // The render above is immediately static; this microtask only latches the
    // completed state so a later preference change cannot replay the reveal.
    void Promise.resolve().then(() => {
      if (active) setRevealComplete(true);
    });
    return () => {
      active = false;
    };
  }, [reduceMotion]);

  useEffect(() => {
    if (revealComplete) return;

    const timer = setTimeout(
      () => {
        setRevealComplete(true);
      },
      TV_GAME_ART_REVEAL_DURATION_MS,
    );
    return () => clearTimeout(timer);
  }, [revealComplete]);

  if (!revealComplete) {
    return (
      <TvSelectedGameArtScreen
        gameId={setup.gameId}
        gameTitle={selectedGame.metadata.title}
        hostName={hostName}
        reduceMotion={reduceMotion}
      />
    );
  }

  const readyPlayerIds = setup.readyPlayerIds.map(String);
  const players = roster.map<TvGamePlayer>((seat) => ({
    id: String(seat.playerId),
    name: seat.nickname,
    isHost: seat.host,
    away: seat.away,
    avatar: huddleAvatarSource(seat.avatar),
    avatarId: seat.avatar,
    ready: readyPlayerIds.includes(String(seat.playerId)) && !seat.away,
  }));

  const allReady = tvReadiness({
    gameId: setup.gameId,
    stage: setup.stage,
    players,
    readyPlayerIds,
    playerRange: selectedGame.metadata.playerRange,
  }).allReady;

  if (allReady) {
    return (
      <TvReadyToStartScreen
        gameId={setup.gameId}
        gameTitle={selectedGame.metadata.title}
        hostName={hostName}
        roomCode={roomCode}
        ready
        reduceMotion={reduceMotion}
      />
    );
  }

  return (
    <TvGameSetupScreen
      gameId={setup.gameId}
      gameTitle={selectedGame.metadata.title}
      hostName={hostName}
      mode={setup.mode}
      settings={setup.settings}
      settingsSchema={selectedGame.settingsSchema}
      playerRange={selectedGame.metadata.playerRange}
      players={players}
      readyPlayerIds={readyPlayerIds}
      stage={setup.stage}
      reduceMotion={reduceMotion}
    />
  );
}

function carouselSubtitle(gameId: string): string | undefined {
  switch (gameId) {
    case 'trivia':
      return 'Test your knowledge';
    case 'voting':
      return 'Vote on fun topics';
    default:
      return undefined;
  }
}

export type TvPlatformStatusScreenProps = {
  readonly kind: 'loading' | 'error';
  readonly title: string;
  readonly message: string;
  readonly roomCode?: string;
  readonly testID?: string;
};

/**
 * Shared passive platform state for unresolved TV data and device failures.
 * The background remains an authored stage image while every meaningful word
 * and status mark stays native and accessible.
 */
export function TvPlatformStatusScreen({
  kind,
  title,
  message,
  roomCode,
  testID,
}: TvPlatformStatusScreenProps) {
  const viewport = useWindowDimensions();
  const scale = safeScale(viewport.width, viewport.height);
  const normalizedCode = roomCode?.trim().toUpperCase().slice(0, 4);
  const stageMessage = kind === 'loading' ? 'Reconnecting to the live Huddle room.' : 'The room is safe. Use the phones to recover or choose again.';

  return (
    <View
      style={styles.statusViewport}
      pointerEvents="none"
      focusable={false}
      accessible
      accessibilityRole="alert"
      accessibilityLabel={`${title}. ${message}${normalizedCode ? ` Room ${normalizedCode.split('').join(' ')}.` : ''}`}
      testID={testID}
    >
      <View style={[styles.statusStage, { transform: [{ scale }] }]} pointerEvents="none" focusable={false}>
        <ImageBackground
          source={kind === 'loading' ? HEARTBEAT_ARTWORK.tv.platformLivingRoom : HEARTBEAT_ARTWORK.tv.deviceUnavailable}
          resizeMode="cover"
          style={StyleSheet.absoluteFill}
          accessible={false}
          testID={testID ? `${testID}-background` : undefined}
        />
        <View style={styles.statusShade} pointerEvents="none" focusable={false} />
        <View style={styles.statusBrand} pointerEvents="none" focusable={false} accessible={false}>
          <Image source={HEARTBEAT_ARTWORK.brand.displayMark} resizeMode="contain" style={styles.statusMark} accessible={false} />
          <HuddleText variant="hero" color="surface" style={styles.statusBrandName}>Huddle</HuddleText>
        </View>
        <View style={styles.statusPanel} pointerEvents="none" focusable={false} accessible={false}>
          <HuddleText variant="caption" color="text" style={styles.statusKicker}>
            {kind === 'loading' ? 'HUDDLE · RESTORING' : 'HUDDLE · TV STATUS'}
          </HuddleText>
          <HuddleText variant="tvDisplay" color="text" align="center" style={styles.statusTitle}>
            {title}
          </HuddleText>
          <HuddleText variant="bodyLarge" color="text" align="center" style={styles.statusMessage}>
            {message}
          </HuddleText>
          {normalizedCode ? (
            <View style={styles.statusRoomCode} pointerEvents="none" focusable={false}>
              <HuddleText variant="caption" color="text" style={styles.statusRoomLabel}>ROOM</HuddleText>
              <HuddleText variant="title" color="text" style={styles.statusRoomValue}>{normalizedCode.split('').join('  ')}</HuddleText>
            </View>
          ) : null}
          <View style={styles.statusRule} pointerEvents="none" focusable={false} />
          <View style={styles.statusLine} pointerEvents="none" focusable={false}>
            <View style={[styles.statusDot, kind === 'error' ? styles.errorDot : null]} pointerEvents="none" focusable={false} />
            <HuddleText variant="body" color="text">{stageMessage}</HuddleText>
          </View>
        </View>
      </View>
    </View>
  );
}

function safeScale(width: number, height: number): number {
  const scale = Math.min(width / 1920, height / 1080);
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

const styles = StyleSheet.create({
  statusViewport: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: semanticColors.text,
  },
  statusStage: {
    width: 1920,
    height: 1080,
    overflow: 'hidden',
  },
  statusShade: {
    ...StyleSheet.absoluteFill,
    backgroundColor: semanticColors.text,
    opacity: 0.34,
  },
  statusBrand: {
    position: 'absolute',
    left: 112,
    top: 82,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  statusMark: { width: 70, height: 70 },
  statusBrandName: { color: semanticColors.surface, fontSize: 52, lineHeight: 64 },
  statusPanel: {
    position: 'absolute',
    left: 470,
    top: 166,
    width: 980,
    minHeight: 640,
    paddingHorizontal: spacing['3xl'],
    paddingVertical: spacing['3xl'],
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.xl,
    backgroundColor: 'rgba(249, 241, 230, 0.97)',
    ...shadows.floating,
  },
  statusKicker: { color: semanticColors.text, letterSpacing: 2.4 },
  statusTitle: { marginTop: spacing.md, color: semanticColors.text },
  statusMessage: { marginTop: spacing.md, maxWidth: 760, color: semanticColors.text },
  statusRoomCode: { marginTop: spacing.xl, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, minWidth: 320, alignItems: 'center', borderRadius: radii.lg, backgroundColor: 'rgba(255,215,102,0.18)' },
  statusRoomLabel: { color: semanticColors.text, letterSpacing: 2 },
  statusRoomValue: { marginTop: spacing.xs, color: semanticColors.text, letterSpacing: 6 },
  statusRule: { width: 140, height: 4, marginVertical: spacing.xl, borderRadius: 2, backgroundColor: semanticColors.primary },
  statusLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  statusDot: { width: 16, height: 16, borderRadius: 8, backgroundColor: semanticColors.secondary },
  errorDot: { backgroundColor: semanticColors.highlight },
});
