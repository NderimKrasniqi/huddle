import { api } from '@huddle/convex';
import { runningGameScreen } from '@huddle/game-registry';
import { PurposeScreen } from '@huddle/ui/native';
import { useQuery } from 'convex/react';
import { useEffect } from 'react';

import type { OpenRoom, RoomOpening } from '../platform/room-session';
import { keepRoomPresent, useRoomExpiry } from '../platform/room-session/native';
import { tvPurposeForSurface } from './tv-purpose';
import { tvSurface } from './tv-surface';

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
  useQuery(api.players.roster, { roomId: room.roomId });
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
    <PurposeScreen
      platform="tv"
      purpose={tvPurposeForSurface(surface, runtime.kind, gameId)}
    />
  );
}
