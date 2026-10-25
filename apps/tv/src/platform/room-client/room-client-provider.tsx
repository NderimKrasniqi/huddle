import { ConvexProvider } from 'convex/react';
import type { PropsWithChildren } from 'react';

import { convexClient } from './convex-client';
import { convexTvRoomClient } from './convex-tv-room-client';

/**
 * The TV's room client. A module-level instance, because opening the room is
 * a fact about the evening and outlives any screen (see `roomOpener`).
 */
export const tvRoomClient = convexTvRoomClient(convexClient);

/** Convex needs its own provider for live queries; without a deployment there is nothing to provide. */
export function RoomClientProvider({ children }: PropsWithChildren) {
  return convexClient === undefined ? <>{children}</> : <ConvexProvider client={convexClient}>{children}</ConvexProvider>;
}
