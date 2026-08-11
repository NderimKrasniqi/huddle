import type { api } from '@huddle/convex';
import type { FunctionReturnType } from 'convex/server';

/** One seat of the room roster as projected by Convex. */
export type RosterSeat = FunctionReturnType<typeof api.players.roster>[number];
