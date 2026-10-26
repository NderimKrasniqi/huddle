import { tvRoomClient } from '../room-client/native';
import { ensureTvSessionToken } from './tv-session';
import { nativeTvSessionUuid, secureTvSessionStore } from './tv-session-native';
import { keepTvPresent } from './tv-presence';
import { type OpenRoom, roomOpener } from './room-opening';

let activeTvSessionToken: string | undefined;

export const { openRoom, closeExpiredRoom } = roomOpener(
  async (): Promise<OpenRoom> => {
    if (!tvRoomClient.deployed) {
      throw new Error('Huddle TV has no room service to open a room on');
    }
    const token = await ensureTvSessionToken(secureTvSessionStore, nativeTvSessionUuid);
    activeTvSessionToken = token;
    return await tvRoomClient.openRoom(token);
  },
);

export function keepRoomPresent(): () => void {
  if (!tvRoomClient.deployed || activeTvSessionToken === undefined) return () => {};
  const token = activeTvSessionToken;
  return keepTvPresent(() => tvRoomClient.heartbeat(token));
}

export function tvSessionToken(): string | undefined {
  return activeTvSessionToken;
}

export const deployed = tvRoomClient.deployed;
