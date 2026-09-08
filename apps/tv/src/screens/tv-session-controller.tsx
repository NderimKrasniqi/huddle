import { api } from '@huddle/convex';
import { runningGameScreen, type RunningGameScreen } from '@huddle/game-registry';
import { gamePlayersFrom } from '@huddle/domain';
import { useQuery } from 'convex/react';
import { useEffect } from 'react';

import { TvGameFlowStage, TvPlatformStatusScreen, type TvGameSetupProjection } from '../features/game-flow/native';
import { GameStage, TvRuntimeStatus } from '../features/game-session/native';
import { RoomStage } from '../features/room/native';
import type { RosterSeat } from '../models';
import type { OpenRoom, RoomOpening } from '../platform/room-session';
import { keepRoomPresent, useRoomExpiry } from '../platform/room-session/native';
import { tvPurposeForSurface } from './tv-purpose';
import { tvSurface, type TvSurface } from './tv-surface';

/**
 * Owns the live TV room session after a safe room code exists. It resolves
 * subscriptions and lifecycle, then hands already-resolved state to the
 * display stages; it does not decide game rules or render Room internals.
 */
export function TvSessionController({
  room,
  opening: _opening,
  onExpired,
}: {
  readonly room: OpenRoom;
  readonly opening: RoomOpening;
  readonly onExpired: (expired: OpenRoom) => void;
}) {
  const roster = useQuery(api.players.roster, { roomId: room.roomId });
  useRoomExpiry(room, onExpired);
  useEffect(() => keepRoomPresent(), [room.roomId]);

  const running = useQuery(api.games.running, { roomId: room.roomId });
  const runtime = runningGameScreen(running);
  const browsingAt = useQuery(api.games.browsing, { roomId: room.roomId });
  const setup = useQuery(api.games.setup, { roomId: room.roomId });
  const hasBrowsing = browsingAt !== undefined && browsingAt !== null;
  const surface = tvSurface({
    runtime: runtime.kind,
    hasBrowsing,
    hasSetup: setup !== null && setup !== undefined,
    runningPending: running === undefined,
    hasRunningGame: room.hasRunningGame,
  });

  const gameId = runtime.kind === 'game' || runtime.kind === 'finished' ? runtime.module.metadata.id : undefined;
  return (
    <TvSessionPresentation
      surface={surface}
      runtime={runtime.kind}
      runtimeScreen={runtime}
      gameId={gameId}
      roomCode={room.code}
      roster={roster ?? []}
      browsingAt={browsingAt}
      setup={setup}
    />
  );
}

/** Renders the resolved TV surface without owning subscriptions or lifecycle. */
export function TvSessionPresentation({
  surface,
  runtime,
  runtimeScreen,
  gameId,
  roomCode,
  roster,
  browsingAt,
  setup,
  reduceMotion,
}: {
  readonly surface: TvSurface;
  readonly runtime: RunningGameScreen['kind'];
  readonly runtimeScreen?: RunningGameScreen;
  readonly gameId?: string;
  readonly roomCode: string;
  readonly roster: readonly RosterSeat[];
  readonly browsingAt?: number | null;
  readonly setup?: TvGameSetupProjection | null;
  readonly reduceMotion?: boolean;
}) {
  // Runtime state is authoritative. Keep a stale surface projection from
  // flashing the invitation, picker, or setup while a game payload is ready.
  if (runtimeScreen?.kind === 'game' || runtimeScreen?.kind === 'finished') {
    return (
      <GameStage
        module={runtimeScreen.module}
        state={runtimeScreen.state}
        players={gamePlayersFrom(roster)}
        clockRemainingMs={runtimeScreen.kind === 'game' ? runtimeScreen.clockRemainingMs : undefined}
      />
    );
  }

  if (runtimeScreen?.kind === 'paused' || runtimeScreen?.kind === 'unavailable') {
    return (
      <TvRuntimeStatus
        kind={runtimeScreen.kind}
        reason={runtimeScreen.kind === 'paused' ? runtimeScreen.reason : undefined}
        gameId={runtimeScreen.gameId}
        roomCode={roomCode}
        players={roster}
      />
    );
  }

  // A restored room can briefly have a pending running query. Keep that
  // handoff visibly distinct from a failed runtime while subscriptions settle.
  if (runtimeScreen?.kind === 'lobby' && surface === 'runtime-status') {
    return (
      <TvPlatformStatusScreen
        kind="loading"
        title="Restoring the game"
        message="Reconnecting to the live Huddle room."
        testID="tv-runtime-pending"
        roomCode={roomCode}
      />
    );
  }

  if (surface === 'room') {
    return <RoomStage roomCode={roomCode} roster={roster} />;
  }

  if (surface === 'carousel' || surface === 'setup') {
    return (
      <TvGameFlowStage
        browsingAt={browsingAt}
        setup={setup}
        roster={roster}
        roomCode={roomCode}
        reduceMotion={reduceMotion}
      />
    );
  }

  // Keep the presentation component total for direct previews and in-flight
  // legacy callers that have only passed the resolved surface kind. The live
  // controller always supplies `runtimeScreen` above.
  const title = tvPurposeForSurface(surface, runtime, gameId);
  return <TvPlatformStatusScreen
    kind="error"
    title={title}
    message="Huddle is waiting for the authoritative room state."
    testID="tv-runtime-fallback"
    roomCode={roomCode}
  />;
}
