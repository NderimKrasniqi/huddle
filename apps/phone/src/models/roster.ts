import type { ViewValue } from '@huddle/contracts/protocol';

/** One seat of the room roster, as the room projects it. */
export type RosterSeat = ViewValue<'roster'>[number];
