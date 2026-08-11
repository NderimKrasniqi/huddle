import { api } from '@huddle/convex';
import { carouselWindow, runningGameScreen } from '@huddle/game-registry';
import { useQuery } from 'convex/react';
import { useEffect } from 'react';
import { AnimatedScreen } from '@huddle/ui/native';

import { CarouselStage } from '../features/carousel/native';
import { GameSetupStage } from '../features/game-setup/native';
import { GameStage, TvRuntimeStatus } from '../features/game-session/native';
import { RoomStage, useRoomGreetings } from '../features/room/native';
import type { RosterSeat } from '../models';
import type { OpenRoom, RoomOpening } from '../platform/room-session';
import { keepRoomPresent, useRoomExpiry } from '../platform/room-session/native';
import { tvSurface } from './tv-surface';

/**
 * Owns the live TV room session after a safe room code exists. It resolves
 * subscriptions and lifecycle, then hands already-resolved state to the
 * display stages; it does not decide game rules or render Room internals.
 */
export function TvSessionController({
  room,
  opening,
  onExpired,
}: {
  readonly room: OpenRoom;
  readonly opening: RoomOpening;
  readonly onExpired: (expired: OpenRoom) => void;
}) {
  const roster = useQuery(api.players.roster, { roomId: room.roomId });
  const { greeting, onGreeted } = useRoomGreetings(roster);
  useRoomExpiry(room, onExpired);
  useEffect(() => keepRoomPresent(), [room.roomId]);

  const running = useQuery(api.games.running, { roomId: room.roomId });
  const runtime = runningGameScreen(running);
  const browsingAt = useQuery(api.games.browsing, { roomId: room.roomId });
  const setup = useQuery(api.games.setup, { roomId: room.roomId });
  const browsing =
    browsingAt === undefined || browsingAt === null ? undefined : carouselWindow(browsingAt);
  const surface = tvSurface({
    runtime: runtime.kind,
    hasBrowsing: browsing !== undefined,
    hasSetup: setup !== null && setup !== undefined,
  });
  const seats: readonly RosterSeat[] = roster ?? [];

  if (surface === 'game' && (runtime.kind === 'game' || runtime.kind === 'finished')) {
    return (
      <AnimatedScreen key="game">
        <GameStage
          module={runtime.module}
          state={runtime.state}
          clockRemainingMs={runtime.kind === 'game' ? runtime.clockRemainingMs : undefined}
          roster={seats}
        />
      </AnimatedScreen>
    );
  }

  if (
    surface === 'runtime-status' &&
    (runtime.kind === 'paused' || runtime.kind === 'unavailable')
  ) {
    return (
      <AnimatedScreen key="runtime-status">
        <TvRuntimeStatus
          kind={runtime.kind}
          reason={runtime.kind === 'paused' ? runtime.reason : undefined}
          disconnectedPlayers={seats.filter((player) => player.away).map((player) => player.nickname)}
        />
      </AnimatedScreen>
    );
  }

  if (surface === 'setup' && setup !== null && setup !== undefined) {
    return <GameSetupStage code={room.code} draft={setup} roster={seats} />;
  }

  if (surface === 'carousel' && browsing !== undefined) {
    return (
      <AnimatedScreen key="carousel">
        <CarouselStage window={browsing} roster={seats} />
      </AnimatedScreen>
    );
  }

  return (
    <AnimatedScreen key="room">
      <RoomStage
        opening={opening}
        code={room.code}
        roster={seats}
        greeting={greeting}
        onGreeted={onGreeted}
      />
    </AnimatedScreen>
  );
}
