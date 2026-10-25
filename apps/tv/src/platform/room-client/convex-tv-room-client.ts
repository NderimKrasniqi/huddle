import { api } from '@huddle/convex';
import { type ConvexReactClient, useQuery } from 'convex/react';
import type { FunctionReference } from 'convex/server';

import type { TvRoomClient, TvViewName, TvViews } from './index';

/** One dispatch table over several typed Convex queries, so the references are loosened. */
type AnyQuery = FunctionReference<'query', 'public', any, any>;

const VIEWS: Record<TvViewName, AnyQuery> = {
  roster: api.players.roster,
  running: api.games.running,
  browsing: api.gameSetup.browsing,
  setup: api.gameSetup.setup,
  arrivals: api.seatPreviews.arrivals,
};

/** The TV's room client over the Convex deployment; `undefined` when the build has none. */
export function convexTvRoomClient(convex: ConvexReactClient | undefined): TvRoomClient {
  return {
    deployed: convex !== undefined,
    openRoom: async (tvSessionToken) => {
      if (convex === undefined) throw new Error('Huddle TV has no Convex deployment to open a room on');
      return await convex.mutation(api.rooms.openRoom, { tvSessionToken });
    },
    heartbeat: async (tvSessionToken) => {
      await convex?.mutation(api.rooms.tvHeartbeat, { tvSessionToken });
    },
    useView: <Name extends TvViewName>(name: Name, viewer: Parameters<TvRoomClient['useView']>[1]) => {
      const view: AnyQuery = VIEWS[name];
      return useQuery(view, viewer === undefined ? 'skip' : { roomId: viewer.roomId, tvSessionToken: viewer.tvSessionToken }) as TvViews[Name] | undefined;
    },
    useStillOpen: (roomId) => useQuery(api.rooms.stillOpen, { roomId: roomId as never }),
    useLanJoin: () => undefined,
  };
}
