import { CAROUSEL_REGISTRY, carouselWindow, gameModuleById } from '@huddle/game-registry';
import { PurposeScreen } from '@huddle/ui/native';
import { useMemo, useState, useEffect } from 'react';

import type { RosterSeat } from '../../models';
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
  reduceMotion = false,
}: TvGameFlowStageProps) {
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
    return <PurposeScreen platform="tv" purpose="Game unavailable" />;
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
  const [revealComplete, setRevealComplete] = useState(
    () => reduceMotion || gameArtAsset(setup.gameId) === undefined,
  );

  useEffect(() => {
    if (revealComplete) return;

    const timer = setTimeout(
      () => setRevealComplete(true),
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
