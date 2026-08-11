import { api } from '@huddle/convex';
import { carouselWindow, runningGameScreen } from '@huddle/game-registry';
import { useQuery } from 'convex/react';
import { useEffect } from 'react';

import { CarouselStage } from '../features/carousel/native';
import { GameSetupStage } from '../features/game-setup/native';
import { GameStage, TvRuntimeStatus } from '../features/game-session/native';
import { RoomStage, useRoomGreetings } from '../features/room/native';
import type { RosterSeat } from '../features/room';
import {
  keepRoomPresent,
  type OpenRoom,
  type RoomOpening,
  useRoomExpiry,
  useRoomOpening,
} from '../platform/room-session';
import { tvSurface } from './tv-surface';

/** Opens a room, owns its subscriptions, and selects the TV surface. */
export default function TvRoomScreen() {
  const { opening, reopen } = useRoomOpening();
  const room = opening.kind === 'open' ? opening.room : undefined;

  if (room === undefined) {
    return <RoomStage opening={opening} code={undefined} roster={[]} />;
  }

  return <OpenRoomStage key={room.roomId} room={room} opening={opening} onExpired={reopen} />;
}

function OpenRoomStage({
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
  const surface = tvSurface({ runtime: runtime.kind, hasBrowsing: browsing !== undefined, hasSetup: setup !== null && setup !== undefined });
  const seats: readonly RosterSeat[] = roster ?? [];

  if (surface === 'game' && (runtime.kind === 'game' || runtime.kind === 'finished')) {
    return (
      <GameStage
        module={runtime.module}
        state={runtime.state}
        clockRemainingMs={runtime.kind === 'game' ? runtime.clockRemainingMs : undefined}
        roster={seats}
      />
    );
  }

  if (
    surface === 'runtime-status' &&
    (runtime.kind === 'paused' || runtime.kind === 'unavailable')
  ) {
    return (
      <TvRuntimeStatus
        kind={runtime.kind}
        reason={runtime.kind === 'paused' ? runtime.reason : undefined}
        disconnectedPlayers={seats.filter((player) => player.away).map((player) => player.nickname)}
      />
    );
  }

  if (surface === 'setup' && setup !== null && setup !== undefined) {
    return <GameSetupStage code={room.code} draft={setup} roster={seats} />;
  }

  if (surface === 'carousel' && browsing !== undefined) {
    return <CarouselStage window={browsing} roster={seats} />;
  }

  return (
    <RoomStage
      opening={opening}
      code={room.code}
      roster={seats}
      greeting={greeting}
      onGreeted={onGreeted}
    />
  );
}
