import { createContext, type PropsWithChildren, useContext } from 'react';

import type { RoomClient } from './index';
import { lanRoomClient } from './lan-room-client';

const RoomClientContext = createContext<RoomClient | null>(null);
const defaultClient = lanRoomClient();

export function RoomClientProvider({ children }: PropsWithChildren) {
  return <RoomClientContext.Provider value={defaultClient}>{children}</RoomClientContext.Provider>;
}

export function useRoomClient(): RoomClient {
  const client = useContext(RoomClientContext);
  if (client === null) throw new Error('useRoomClient must be used inside RoomClientProvider');
  return client;
}
