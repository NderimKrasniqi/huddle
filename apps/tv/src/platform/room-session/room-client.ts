import { api } from '@huddle/convex';

import { convexClient } from '../convex/native';
import { ensureTvSessionToken } from './tv-session';
import { nativeTvSessionUuid, secureTvSessionStore } from './tv-session-native';
import { keepTvPresent } from './tv-presence';
import { type OpenRoom, roomOpener } from './room-opening';

let activeTvSessionToken: string | undefined;

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
  async (): Promise<OpenRoom> => {
    if (convexClient === undefined) {
      throw new Error('Huddle TV has no Convex deployment to open a room on');
    }
    const token = await ensureTvSessionToken(secureTvSessionStore, nativeTvSessionUuid);
    // Set only after the credential has been durably persisted. A storage
    // failure therefore leaves no in-memory identity that could open a room.
    activeTvSessionToken = token;
    return await convexClient.mutation(api.rooms.openRoom, { tvSessionToken: token });
  },
);

/** Starts the TV's 3-second presence loop for the currently open room. */
export function keepRoomPresent(): () => void {
  const client = convexClient;
  if (client === undefined || activeTvSessionToken === undefined) return () => {};
  const token = activeTvSessionToken;
  return keepTvPresent(async () => {
    await client.mutation(api.rooms.tvHeartbeat, { tvSessionToken: token });
  });
}

/** Whether this build was given a Convex deployment to open a room on at all. */
export const deployed = convexClient !== undefined;
