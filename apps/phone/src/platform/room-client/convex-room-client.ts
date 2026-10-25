import { RoomRefusal, type RoomRejection } from '@huddle/contracts/protocol';
import { api } from '@huddle/convex';
import { type ConvexReactClient, useQuery } from 'convex/react';
import type { FunctionReference } from 'convex/server';
import { ConvexError } from 'convex/values';

import type { RoomClient, RoomViewName, RoomViews, SeatCommandName } from './index';

/** One dispatch table over many typed Convex functions, so the references are loosened. */
type AnyQuery = FunctionReference<'query', 'public', any, any>;
type AnyMutation = FunctionReference<'mutation', 'public', any, any>;

const VIEWS: Record<RoomViewName, AnyQuery> = {
  session: api.players.session,
  roster: api.players.roster,
  setup: api.gameSetup.setup,
  browsing: api.gameSetup.browsing,
  running: api.games.running,
};

const COMMANDS: Record<SeatCommandName, AnyMutation> = {
  leaveRoom: api.players.leaveRoom,
  transferHost: api.players.transferHost,
  removePlayer: api.players.removePlayer,
  browseGame: api.gameSetup.browseGame,
  selectGame: api.gameSetup.selectGame,
  configureGame: api.gameSetup.configureGame,
  finalizeGameSetup: api.gameSetup.finalizeGameSetup,
  setGameReady: api.gameSetup.setGameReady,
  reopenGameSetup: api.gameSetup.reopenGameSetup,
  cancelGameSetup: api.gameSetup.cancelGameSetup,
  startGame: api.gameSetup.startGame,
  startCountdown: api.gameSetup.startCountdown,
  stopCountdown: api.gameSetup.stopCountdown,
  endGame: api.games.endGame,
  continueAfterDisconnect: api.games.continueAfterDisconnect,
  sendEvent: api.games.sendEvent,
};

/** A Convex refusal becomes the transport-free `RoomRefusal`; anything else passes through. */
function refused(error: unknown): unknown {
  if (error instanceof ConvexError && typeof error.data === 'object' && error.data !== null && typeof (error.data as { kind?: unknown }).kind === 'string') {
    return new RoomRefusal(error.data as RoomRejection);
  }
  return error;
}

async function translated<T>(call: Promise<T>): Promise<T> {
  try {
    return await call;
  } catch (error) {
    throw refused(error);
  }
}

/** The room client over the Convex deployment, until the TV hosts the room. */
export function convexRoomClient(convex: ConvexReactClient): RoomClient {
  return {
    useView: <Name extends RoomViewName>(name: Name, seat: Parameters<RoomClient['useView']>[1]) => {
      const args =
        seat === undefined
          ? 'skip'
          : name === 'session'
            ? { sessionToken: seat.sessionToken }
            : { roomId: seat.roomId, sessionToken: seat.sessionToken };
      const view: AnyQuery = VIEWS[name];
      return useQuery(view, args) as RoomViews[Name] | undefined;
    },
    useJoinAvailability: (code) => useQuery(api.players.joinAvailability, code === undefined ? 'skip' : { code }),
    command: async (name, seat, args) => {
      const mutation: AnyMutation = COMMANDS[name];
      await translated(convex.mutation(mutation, { ...args, sessionToken: seat.sessionToken }));
    },
    joinRoom: (args) => translated(convex.mutation(api.players.joinRoom, args)),
    lookupSession: (sessionToken) => translated(convex.query(api.players.session, { sessionToken })),
    previewSeat: async (args) => {
      await translated(convex.mutation(api.seatPreviews.previewSeat, args));
    },
    clearSeatPreview: async (previewKey) => {
      await translated(convex.mutation(api.seatPreviews.clearSeatPreview, { previewKey }));
    },
    heartbeat: async (sessionToken) => {
      await translated(convex.mutation(api.players.heartbeat, { sessionToken }));
    },
  };
}
