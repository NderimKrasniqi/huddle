import { api } from '@huddle/convex';
import { carouselWindow, runningGameScreen } from '@huddle/game-registry';
import { PurposeScreen } from '@huddle/ui/native';
import { useQuery } from 'convex/react';
import { useEffect } from 'react';

import { lobbyStanding, seatedSurface, seatLossNotice, type RosterSeat } from '../features/room';
import { useHeartbeat } from '../platform/presence/native';
import { useSessionToken } from '../platform/session/native';
import type { PlayerSession } from '../platform/session';
import { phonePurposeForSurface } from './phone-purpose';

/**
 * The seated Phone coordinator still owns the live room subscriptions and
 * lifecycle transitions. Presentation is intentionally reduced to one label.
 */
export function SeatedPhone({
  session,
  onSeatLost,
  onLeft: _onLeft,
}: {
  readonly session: PlayerSession;
  readonly onSeatLost: (reason: string) => void;
  readonly onLeft: () => void;
}) {
  useHeartbeat();

  const { roster } = useRoomRoster(session);
  const standing = lobbyStanding(roster, session.playerId);
  const sessionToken = useSessionToken();
  const running = useQuery(
    api.games.running,
    sessionToken === undefined ? 'skip' : { roomId: session.roomId, sessionToken },
  );
  const seat = useQuery(
    api.players.session,
    sessionToken === undefined ? 'skip' : { sessionToken },
  );
  const browsingAt = useQuery(api.games.browsing, { roomId: session.roomId });
  const setupDraft = useQuery(api.games.setup, { roomId: session.roomId });
  const browsing = carouselWindow(browsingAt ?? 0);
  const screen = runningGameScreen(running);

  useEffect(() => {
    if (seat === null) onSeatLost(seatLossNotice(roster));
  }, [onSeatLost, roster, seat]);

  const stranded = running !== null && running !== undefined && screen.kind === 'lobby';
  const showingPicker =
    standing.youAreHost && setupDraft !== null && setupDraft !== undefined;
  const surface = seatedSurface({
    runtime: screen.kind,
    youAreHost: standing.youAreHost,
    picking: showingPicker,
    strandedRuntime: stranded,
    hasGameToBrowse: browsing !== undefined,
  });

  return (
    <PurposeScreen
      platform="phone"
      purpose={phonePurposeForSurface(
        surface,
        screen,
        setupDraft !== null && setupDraft !== undefined,
      )}
    />
  );
}

function useRoomRoster(session: PlayerSession): {
  readonly roster: readonly RosterSeat[];
} {
  const answered = useQuery(api.players.roster, { roomId: session.roomId });
  return { roster: answered ?? [] };
}
