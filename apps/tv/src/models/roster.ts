import type { api } from '@huddle/convex';
import type { FunctionReturnType } from 'convex/server';

/** The shared TV roster projection, independent of any renderer. */
export type RosterSeat = FunctionReturnType<typeof api.players.roster>[number];
