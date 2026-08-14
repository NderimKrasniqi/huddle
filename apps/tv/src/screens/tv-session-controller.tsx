import { api } from '@huddle/convex';
import { runningGameScreen } from '@huddle/game-registry';
import { PurposeScreen } from '@huddle/ui/native';
import { useQuery } from 'convex/react';
import { useEffect } from 'react';

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
  });

  const gameId = runtime.kind === 'game' || runtime.kind === 'finished' ? runtime.module.metadata.id : undefined;
  return (
    <TvSessionPresentation
      surface={surface}
      runtime={runtime.kind}
      gameId={gameId}
      roomCode={room.code}
      roster={roster ?? []}
    />
  );
}

/** Renders the resolved TV surface without owning subscriptions or lifecycle. */
export function TvSessionPresentation({
  surface,
  runtime,
  gameId,
  roomCode,
  roster,
}: {
  readonly surface: TvSurface;
  readonly runtime: 'game' | 'finished' | 'paused' | 'unavailable' | 'lobby';
  readonly gameId?: string;
  readonly roomCode: string;
  readonly roster: readonly RosterSeat[];
}) {
  if (surface === 'room') {
    return <RoomStage roomCode={roomCode} roster={roster} />;
  }

  return (
    <PurposeScreen
      platform="tv"
      purpose={tvPurposeForSurface(surface, runtime, gameId)}
    />
  );
}
