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

export type TvGameSetupProjection = {
  readonly gameId: string;
  readonly settings: Readonly<Record<string, string>>;
  readonly mode: 'quick' | 'standard' | 'custom';
  readonly stage: 'configuring' | 'ready' | 'countdown';
  readonly readyPlayerIds: readonly string[];
  readonly countdownEndsAt?: number;
};

export type TvGameFlowStageProps = {
  readonly browsingAt: number | null | undefined;
  readonly setup: TvGameSetupProjection | null | undefined;
  readonly roster: readonly RosterSeat[];
  readonly roomCode?: string;
  readonly reduceMotion?: boolean;
};

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
    if (!reduceMotion) return;
    let active = true;
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
