import type { ViewValue } from '@huddle/contracts/protocol';

/** The shared TV roster projection, independent of any renderer. */
export type RosterSeat = ViewValue<'roster'>[number];

/** Someone on the join form, shown as an arriving seat before they join. */
export type SeatArrival = ViewValue<'arrivals'>[number];
