import { useRoomMoments } from '@huddle/ui/native';
import { runningGameScreen, type RunningGameScreen } from '@huddle/game-registry';
import { gamePlayersFrom, type LanJoin } from '@huddle/domain';
import { useEffect, useMemo } from 'react';

import { TvGameFlowStage, TvPlatformStatusScreen, type TvGameSetupProjection } from '../features/game-flow/native';
import { GameStage, TvRuntimeStatus } from '../features/game-session/native';
import { RoomStage } from '../features/room/native';
import type { RosterSeat, SeatArrival } from '../models';
import type { OpenRoom, RoomOpening } from '../platform/room-session';
import type { TvViewer } from '../platform/room-client';
import { tvRoomClient } from '../platform/room-client/native';
import { keepRoomPresent, tvSessionToken, useRoomExpiry } from '../platform/room-session/native';
import { tvPurposeForSurface } from './tv-purpose';
import { tvSurface, type TvSurface } from './tv-surface';

export function TvSessionController({
  room,
  opening: _opening,
  onExpired,
}: {
  readonly room: OpenRoom;
  readonly opening: RoomOpening;
  readonly onExpired: (expired: OpenRoom) => void;
}) {
  const tvToken = tvSessionToken();
  const asTv: TvViewer | undefined = useMemo(
    () => (tvToken === undefined ? undefined : { roomId: room.roomId, tvSessionToken: tvToken }),
    [room.roomId, tvToken],
  );
  const roster = tvRoomClient.useView('roster', asTv);
  useRoomExpiry(room, onExpired);
  useEffect(() => keepRoomPresent(), [room.roomId]);

  const running = tvRoomClient.useView('running', asTv);
  const runtime = runningGameScreen(running);
  const browsingAt = tvRoomClient.useView('browsing', asTv);
  const setup = tvRoomClient.useView('setup', asTv);
  const hasBrowsing = browsingAt !== undefined && browsingAt !== null;
  const surface = tvSurface({
    runtime: runtime.kind,
    hasBrowsing,
    hasSetup: setup !== null && setup !== undefined,
    runningPending: running === undefined,
    hasRunningGame: room.hasRunningGame,
  });
  const arrivals = tvRoomClient.useView('arrivals', surface === 'room' ? asTv : undefined);
  const lan = tvRoomClient.useLanJoin();

  const playerIds = useMemo(() => roster?.map((player) => String(player.playerId)), [roster]);
  const moments = useRoomMoments({ playerIds, runtime: runtime.kind,
    lobbyResolved: running !== undefined && runtime.kind === 'lobby' && browsingAt === null && setup === null,
    browsing: hasBrowsing,
  });
  const gameId = runtime.kind === 'game' || runtime.kind === 'finished' ? runtime.module.metadata.id : undefined;
  return (
    <TvSessionPresentation
      returned={moments.returned}
      welcomeIds={moments.welcomeIds}
      surface={surface}
      runtime={runtime.kind}
      runtimeScreen={runtime}
      gameId={gameId}
      roomCode={room.code}
      roster={roster ?? []}
      arrivals={arrivals ?? []}
      browsingAt={browsingAt}
      setup={setup}
      lan={lan}
    />
  );
}

function TvSessionPresentation({
  surface,
  runtime,
  runtimeScreen,
  gameId,
  roomCode,
  roster,
  arrivals = [],
  browsingAt,
  setup,
  reduceMotion,
  returned,
  welcomeIds,
  lan,
}: {
  readonly lan?: LanJoin;
  readonly returned?: boolean;
  readonly welcomeIds?: readonly string[];
  readonly surface: TvSurface;
  readonly runtime: RunningGameScreen['kind'];
  readonly runtimeScreen?: RunningGameScreen;
  readonly gameId?: string;
  readonly roomCode: string;
  readonly roster: readonly RosterSeat[];
  readonly arrivals?: readonly SeatArrival[];
  readonly browsingAt?: number | null;
  readonly setup?: TvGameSetupProjection | null;
  readonly reduceMotion?: boolean;
}) {
  if (runtimeScreen?.kind === 'game' || runtimeScreen?.kind === 'finished') {
    return (
      <GameStage
        module={runtimeScreen.module}
        state={runtimeScreen.state}
        players={gamePlayersFrom(roster)}
        clockRemainingMs={runtimeScreen.kind === 'game' ? runtimeScreen.clockRemainingMs : undefined}
        hostNickname={roster.find((seat) => seat.host)?.nickname}
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
    return <RoomStage roomCode={roomCode} roster={roster} arrivals={arrivals} returned={returned} welcomeIds={welcomeIds} lan={lan} />;
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

  const title = tvPurposeForSurface(surface, runtime, gameId);
  return <TvPlatformStatusScreen
    kind="error"
    title={title}
    message="Huddle is waiting for the authoritative room state."
    testID="tv-runtime-fallback"
    roomCode={roomCode}
  />;
}
