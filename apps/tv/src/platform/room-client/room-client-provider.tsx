import { ConvexProvider } from 'convex/react';
import type { PropsWithChildren } from 'react';

import { convexClient } from './convex-client';
import { convexTvRoomClient } from './convex-tv-room-client';
import { lanTvRoomClient } from './lan-tv-room-client';

/**
 * Which room service this build uses: `lan` runs the room host inside the TV
 * app (ADR-01); anything else uses the Convex deployment until it is retired.
 * Metro inlines `EXPO_PUBLIC_ROOM_BACKEND` at bundle time.
 */
const hostsRoom = process.env.EXPO_PUBLIC_ROOM_BACKEND === 'lan';

/**
 * The TV's room client. A module-level instance, because opening the room is
 * a fact about the evening and outlives any screen (see `roomOpener`).
 */
export const tvRoomClient = hostsRoom ? lanTvRoomClient() : convexTvRoomClient(convexClient);

/** Convex needs its own provider for live queries; a hosted room needs none. */
export function RoomClientProvider({ children }: PropsWithChildren) {
  return hostsRoom || convexClient === undefined ? <>{children}</> : <ConvexProvider client={convexClient}>{children}</ConvexProvider>;
}
