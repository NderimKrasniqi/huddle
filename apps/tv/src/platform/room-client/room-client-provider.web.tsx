import type { PropsWithChildren } from 'react';

import { webTvRoomClient } from './web-tv-room-client';

/** The web TV's room client: the room host in the page, reachable through the relay (ADR-04). */
export const tvRoomClient = webTvRoomClient();

export function RoomClientProvider({ children }: PropsWithChildren) {
  return <>{children}</>;
}
