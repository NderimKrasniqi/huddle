import { api } from '@huddle/convex';

import { convexClient } from './convex-client';
import { type OpenRoom, roomOpener } from './room-opening';

/**
 * The room this TV shows, bound to this launch's Convex connection. The TV app
 * holds no player record and needs no remote — launching it *is* the act of
 * opening a room.
 *
 * `openRoom` mints one and then hands every later caller that same room;
 * `closeExpiredRoom` is how the pairing screen says the room it was showing has
 * expired, so that the next `openRoom` mints its replacement. Both live at
 * module scope on purpose: they must outlive the pairing screen's mounts,
 * because how many rooms a television has opened is a fact about the evening and
 * not about a render. `roomOpener` holds the rest of the reasoning, and
 * `keepOpeningRoom` is the caller that retries a room that will not open.
 */
export const { openRoom, closeExpiredRoom } = roomOpener(
  (): Promise<OpenRoom> =>
    convexClient === undefined
      ? // Unreachable from the pairing screen, which never starts opening a room
        // without a deployment — but `openRoom` is exported, and a rejection is
        // the one answer a caller of this can already handle.
        Promise.reject(new Error('Huddle TV has no Convex deployment to open a room on'))
      : convexClient.mutation(api.rooms.createRoom, {}),
);

/** Whether this build was given a Convex deployment to open a room on at all. */
export const deployed = convexClient !== undefined;
