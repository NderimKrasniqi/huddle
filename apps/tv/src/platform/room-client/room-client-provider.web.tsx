import type { PropsWithChildren } from 'react';

import { webTvRoomClient } from './web-tv-room-client';

export const tvRoomClient = webTvRoomClient();

export function RoomClientProvider({ children }: PropsWithChildren) {
  return <>{children}</>;
}
