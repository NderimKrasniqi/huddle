import type { PropsWithChildren } from 'react';

import { lanTvRoomClient } from './lan-tv-room-client';

export const tvRoomClient = lanTvRoomClient();

export function RoomClientProvider({ children }: PropsWithChildren) {
  return <>{children}</>;
}
