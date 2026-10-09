import { carouselWindow, gameModuleById } from '@huddle/game-registry';
import { playroomColors, playroomTv } from '@huddle/design-tokens';
import {
  PlayroomHeading,
  PlayroomPill,
  PlayroomStatusImage,
  PlayroomText,
  PlayroomTvStage,
  playroomGameArt,
} from '@huddle/ui/native';
import { StyleSheet, View } from 'react-native';
import { useEffect, useMemo, useState } from 'react';

import type { RosterSeat } from '../../models';
import { TvGameCarouselScreen } from './game-carousel-screen';
import {
  TV_GAME_ART_REVEAL_DURATION_MS,
  TvSelectedGameArtScreen,
} from './game-art-reveal-screen';
import {
  type TvGamePlayer,
} from './game-flow-model';
import { TvGameSetupScreen } from './game-setup-screen';
import { useTvReducedMotion } from '../../ui';

/** The Convex setup projection consumed by the display-only flow. */
export type TvGameSetupProjection = {
  readonly gameId: string;
  readonly settings: Readonly<Record<string, string>>;
  readonly mode: 'quick' | 'standard' | 'custom';
  readonly stage: 'configuring' | 'ready' | 'countdown';
  readonly readyPlayerIds: readonly string[];
  /** Server epoch ms when the countdown's start is due; set only while counting down. */
  readonly countdownEndsAt?: number;
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
  const reduceMotion = useTvReducedMotion(reduceMotionOverride);
  const hostName = roster.find((seat) => seat.host)?.nickname;
  const selectedIndex = carouselWindow(browsingAt ?? 0)?.index ?? 0;
  const players = useMemo(() => roster.map((seat) => tvPlayer(seat, [])), [roster]);

  if (setup === null || setup === undefined) {
    return (
      <TvGameCarouselScreen
        hostName={hostName}
        selectedIndex={selectedIndex}
        players={players}
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
      reduceMotion={reduceMotion}
    />
  );
}

function TvGameSetupHandoff({
  setup,
  selectedGame,
  hostName,
  roster,
  reduceMotion,
}: {
  readonly setup: TvGameSetupProjection;
  readonly selectedGame: NonNullable<ReturnType<typeof gameModuleById>>;
  readonly hostName?: string;
  readonly roster: readonly RosterSeat[];
  readonly reduceMotion: boolean;
}) {
  const artAvailable = playroomGameArt(setup.gameId) !== undefined;
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
  const players = roster.map((seat) => tvPlayer(seat, readyPlayerIds));

  // The selected game's world owns both pre-start states. Keep the art and
  // settings visible after every player is ready; the Host starts from the
  // phone, which makes the running module replace this surface with its own
  // countdown before the first playable beat.
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
      countdownEndsAt={setup.countdownEndsAt}
      reduceMotion={reduceMotion}
    />
  );
}

function tvPlayer(seat: RosterSeat, readyPlayerIds: readonly string[]): TvGamePlayer {
  return {
    id: String(seat.playerId),
    name: seat.nickname,
    isHost: seat.host,
    away: seat.away,
    avatarId: seat.avatar,
    ready: readyPlayerIds.includes(String(seat.playerId)) && !seat.away,
  };
}

export type TvPlatformStatusScreenProps = {
  readonly kind: 'loading' | 'error';
  readonly title: string;
  readonly message: string;
  readonly roomCode?: string;
  readonly testID?: string;
};

/**
 * Shared passive platform state for unresolved TV data and device failures:
 * a status illustration, what happened, and the room it belongs to.
 */
export function TvPlatformStatusScreen({
  kind,
  title,
  message,
  roomCode,
  testID,
}: TvPlatformStatusScreenProps) {
  const normalizedCode = roomCode?.trim().toUpperCase().slice(0, 4);

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
      <PlayroomTvStage>
        <View style={styles.statusColumn} pointerEvents="none" focusable={false} accessible={false}>
          <PlayroomStatusImage
            art={kind === 'loading' ? 'loading' : 'disconnected'}
            width={460}
            height={460}
          />
          <PlayroomHeading type={playroomTv.type.heading}>{title}</PlayroomHeading>
          <PlayroomText color="muted" style={[playroomTv.type.body, styles.statusMessage]}>
            {message}
          </PlayroomText>
          {normalizedCode ? (
            <PlayroomPill textStyle={playroomTv.type.label}>{`Room ${normalizedCode}`}</PlayroomPill>
          ) : null}
        </View>
      </PlayroomTvStage>
    </View>
  );
}

const styles = StyleSheet.create({
  statusViewport: {
    flex: 1,
    backgroundColor: playroomColors.canvas,
  },
  statusColumn: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
    paddingHorizontal: 240,
  },
  statusMessage: {
    textAlign: 'center',
    maxWidth: 1100,
  },
});
