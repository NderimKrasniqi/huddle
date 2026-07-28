import { api } from '@huddle/convex';

import { convexClient } from './convex-client';
import { onlyOnce } from './only-once';
import type { OpenRoom } from './room-opening';

/**
 * Opens the one room this TV shows, and hands every later caller that same
 * room. The TV app holds no player record and needs no remote — launching it
 * *is* the act of opening a room.
 *
 * The memo lives at module scope on purpose: it must outlive the pairing
 * screen's mounts, because a second call would mint a second room and strand
 * every phone that already read the first code off the screen. It is also what
 * makes retrying safe — `onlyOnce` forgets a *failed* attempt so the next
 * caller has another go, and hands back an *in-flight* one so a retry that
 * arrives early is the same attempt rather than a second room. `keepOpeningRoom`
 * is the caller that does the retrying.
 */
export const openRoom = onlyOnce(
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
