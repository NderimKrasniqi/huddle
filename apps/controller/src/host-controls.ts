import type { RosterSeat } from './host';

/**
 * What the Host can do to another player's row, and whether they can do it now
 * (task 3.7 in docs/implementation-plan.md; the roster it sits on is §5, the
 * Host Roster).
 *
 * The two powers are `transferHost` and `removePlayer` (`convex/convex/players.ts`),
 * and this module is only the *offer* of them: which controls a row shows and
 * which are live, resolved against the one seat the row draws. The mutations
 * still guard themselves — the roster the Host taps from is the room's own live
 * subscription and can be a beat stale, so a control this module offers can
 * still be refused (`host-control-rejection.ts` turns each refusal into a line).
 * What is here keeps a correct Controller from *drawing* a tap the server is
 * certain to reject: the Host's own row (there is no room to hand oneself and no
 * self to remove — `targetIsSelf`), and handing the room to a phone that has
 * gone quiet (`targetAway`).
 */

/** The two host powers a roster row can offer. */
export type HostControlAction = 'transfer' | 'remove';

/** One control on a row: what it does, and whether the Host can invoke it now. */
export type RosterRowControl = {
  readonly action: HostControlAction;
  /** The word on the control. */
  readonly label: string;
  /** Whether the Host can invoke it against this seat right now. */
  readonly enabled: boolean;
  /**
   * The line to draw under a disabled control saying why — `undefined` when it
   * is live. Only transfer is ever disabled (an away target), so only it ever
   * carries one.
   */
  readonly disabledBecause: string | undefined;
};

/**
 * Handing the room needs a successor the room is still hearing from, the same
 * rule the automatic handover keeps (`handOverRoom`, and `transferHost`'s
 * `targetAway`). Removal has no such bar — clearing out a phone that has gone
 * quiet is the main thing a Host removes anyone for — so this line is transfer's
 * alone. Forward-looking rather than the after-the-fact `targetAway` refusal:
 * the control is dimmed before the tap, so it says what to do instead.
 */
const TRANSFER_AWAY_HINT =
  'They’re away — you can only hand the room to someone who’s still here.';

/**
 * The controls a row offers the Host, in the order they are drawn.
 *
 * The Host's own row offers none: this roster is drawn on the Host's phone alone
 * (see `host-roster.ts`), so the row marked `host` is the reader's own, and the
 * server refuses both powers against it as `targetIsSelf`. Every other row
 * offers both — transfer, live only for a present target, and remove, which is
 * always live.
 */
export function rosterRowControls(seat: RosterSeat): readonly RosterRowControl[] {
  if (seat.host) {
    return [];
  }

  return [
    {
      action: 'transfer',
      label: 'Make host',
      enabled: !seat.away,
      disabledBecause: seat.away ? TRANSFER_AWAY_HINT : undefined,
    },
    {
      action: 'remove',
      label: 'Remove',
      enabled: true,
      disabledBecause: undefined,
    },
  ];
}

/**
 * Whether a row is one the Host can manage at all — the gate on making the row
 * open its controls. It is exactly the rows that offer a control, which is every
 * row but the Host's own.
 */
export function rosterRowIsManageable(seat: RosterSeat): boolean {
  return rosterRowControls(seat).length > 0;
}
