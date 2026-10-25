import { ConvexProvider } from 'convex/react';
import { createContext, type PropsWithChildren, useContext } from 'react';

import { convexClient } from './convex-client';
import { convexRoomClient } from './convex-room-client';
import type { RoomClient } from './index';
import { lanRoomClient } from './lan-room-client';

/**
 * Which room service this build uses: `lan` talks to a TV that hosts its own
 * room (ADR-01); anything else uses the Convex deployment until it is retired.
 * Metro inlines `EXPO_PUBLIC_ROOM_BACKEND` at bundle time.
 */
const hostsRoom = process.env.EXPO_PUBLIC_ROOM_BACKEND === 'lan';

const RoomClientContext = createContext<RoomClient | null>(null);
const defaultClient = hostsRoom ? lanRoomClient() : convexRoomClient(convexClient);

/** Gives every route the room client. Convex needs its own provider for queries. */
export function RoomClientProvider({ children }: PropsWithChildren) {
  const provided = <RoomClientContext.Provider value={defaultClient}>{children}</RoomClientContext.Provider>;
  return hostsRoom ? provided : <ConvexProvider client={convexClient}>{provided}</ConvexProvider>;
}

export function useRoomClient(): RoomClient {
  const client = useContext(RoomClientContext);
  if (client === null) throw new Error('useRoomClient must be used inside RoomClientProvider');
  return client;
}
