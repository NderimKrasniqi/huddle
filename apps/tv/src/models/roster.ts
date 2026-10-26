import type { ViewValue } from '@huddle/contracts/protocol';

export type RosterSeat = ViewValue<'roster'>[number];

export type SeatArrival = ViewValue<'arrivals'>[number];
