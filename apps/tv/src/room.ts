import { api } from '@huddle/convex';

import { convexClient } from './convex-client';
import { onlyOnce } from './only-once';

/**
 * Opens the one room this TV shows, and hands every later caller that same
 * room. The TV app holds no player record and needs no remote — launching it
 * *is* the act of opening a room.
 *
 * The memo lives at module scope on purpose: it must outlive the pairing
 * screen's mounts, because a second call would mint a second room and strand
 * every phone that already read the first code off the screen.
 */
export const openRoom = onlyOnce(() => convexClient.mutation(api.rooms.createRoom, {}));

/** The room this TV opened: its id, and the Room Code on the pairing screen. */
export type OpenRoom = Awaited<ReturnType<typeof openRoom>>;
