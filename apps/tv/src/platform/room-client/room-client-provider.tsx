import type { PropsWithChildren } from 'react';

import { lanTvRoomClient } from './lan-tv-room-client';

/**
 * The TV's room client: the room host running inside this app (ADR-01). A
 * module-level instance, because opening the room is a fact about the evening
 * and outlives any screen (see `roomOpener`).
 */
export const tvRoomClient = lanTvRoomClient();

/** The room host needs no provider; this keeps the root layout's seam in one place. */
export function RoomClientProvider({ children }: PropsWithChildren) {
  return <>{children}</>;
}
