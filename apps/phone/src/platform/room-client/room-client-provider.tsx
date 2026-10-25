import { ConvexProvider } from 'convex/react';
import { createContext, type PropsWithChildren, useContext } from 'react';

import { convexClient } from './convex-client';
import { convexRoomClient } from './convex-room-client';
import type { RoomClient } from './index';

const RoomClientContext = createContext<RoomClient | null>(null);
const defaultClient = convexRoomClient(convexClient);

/** Gives every route the room client. Convex needs its own provider for queries. */
export function RoomClientProvider({ children }: PropsWithChildren) {
  return (
    <ConvexProvider client={convexClient}>
      <RoomClientContext.Provider value={defaultClient}>{children}</RoomClientContext.Provider>
    </ConvexProvider>
  );
}

export function useRoomClient(): RoomClient {
  const client = useContext(RoomClientContext);
  if (client === null) throw new Error('useRoomClient must be used inside RoomClientProvider');
  return client;
}
