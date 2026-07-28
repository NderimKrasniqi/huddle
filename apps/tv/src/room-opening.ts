import type { api } from '@huddle/convex';
import type { FunctionReturnType } from 'convex/server';

import { onlyOnce } from './only-once';

/**
 * Everything about getting a room onto the pairing screen: which room the TV is
 * showing and when it needs another, how long it waits between tries, what it is
 * doing right now, and what the screen says about it.
 *
 * All of it lives here rather than beside the Convex client in `room.ts` —
 * which is only this launch's instance of it — because the TV app is *untouched
 * after launch*. There is no remote surface, no relaunch, nobody to tell. A
 * television switched on before the router has finished booting has to arrive at
 * a working pairing screen on its own, however long that takes; one whose room
 * expires under it at midnight has to open the next one just as unaided; and
 * both have to say something legible from a sofa meanwhile. Those are decisions,
 * not plumbing, so they are made here, where they are plain TypeScript a unit
 * test can run.
 */

/** The room this TV opened: its id, and the Room Code on the pairing screen. */
export type OpenRoom = FunctionReturnType<typeof api.rooms.createRoom>;

/** The room this TV is showing, and the news that it has expired. */
export type RoomOpener = {
  /** The room this TV shows — minting one the first time, then the same one. */
  readonly openRoom: () => Promise<OpenRoom>;
  /**
   * Says a room is gone, so the next `openRoom` mints a replacement. Anything
   * but the room currently being shown is ignored.
   */
  readonly closeExpiredRoom: (expired: OpenRoom) => void;
};

/**
 * Holds the one room a television is showing.
 *
 * `openRoom` is memoised because `createRoom` is a mutation and mutations are
 * not idempotent: calling it twice mints two rooms and the screen can only show
 * one code, so every phone that read the other one is typing at a room nobody is
 * showing. A `useEffect` cannot promise "once" by itself — StrictMode runs
 * effects twice on purpose, and Fast Refresh and expo-router both remount
 * screens — which is why the memo lives out here rather than in a render.
 *
 * Room expiry is what makes it a memo per *room* rather than per launch. A room
 * whose party has gone is deleted ten minutes later, and the television is still
 * on and still showing its code; a code that belongs to no room is the worst
 * thing this screen can display, because it fails silently in somebody's hands
 * across the room. So the pairing screen says the room is gone and this mints
 * the next one — the only moment a second room is the right answer, since the
 * first no longer exists to be confused with it.
 *
 * `closeExpiredRoom` ignores any room other than the one being shown, which is
 * what makes it safe to say twice. The screen learns of an expiry from a live
 * subscription and an effect, and either can repeat; forgetting a replacement
 * that was still in flight would mint the second room all of the above exists to
 * prevent.
 */
export function roomOpener(mint: () => Promise<OpenRoom>): RoomOpener {
  let opening = onlyOnce(mint);
  let showing: OpenRoom | undefined;

  return {
    openRoom: async () => {
      const room = await opening();
      showing = room;
      return room;
    },
    closeExpiredRoom: (expired) => {
      if (showing?.roomId !== expired.roomId) {
        return;
      }

      showing = undefined;
      opening = onlyOnce(mint);
    },
  };
}

/** How far the TV has got with opening the room it is going to show. */
export type RoomOpening =
  | { readonly kind: 'opening' }
  | { readonly kind: 'reconnecting' }
  | { readonly kind: 'open'; readonly room: OpenRoom }
  | { readonly kind: 'misconfigured' };

/**
 * One value rather than a fresh object per failed attempt: the screen keeps
 * this in state, and `Object.is` is what stops a redraw every thirty seconds
 * for as long as the backend is away.
 */
const RECONNECTING: RoomOpening = { kind: 'reconnecting' };

/**
 * Where a launch starts. `deployed` is whether this build was given a Convex
 * deployment at all (`convexClient !== undefined`); without one there is
 * nothing to try, so the screen says so straight away instead of pretending to
 * reconnect to something that does not exist.
 */
export function roomOpeningAtLaunch(deployed: boolean): RoomOpening {
  return deployed ? { kind: 'opening' } : { kind: 'misconfigured' };
}

/**
 * The waits between attempts, in order — a second, then doubling. A backend
 * that is merely a moment behind the television is caught almost at once, and
 * one that is properly down is not hammered.
 */
const REOPEN_DELAYS_MS = [1_000, 2_000, 4_000, 8_000, 16_000] as const;

/**
 * The wait every attempt past the last of those takes. It is a ceiling and not
 * a limit: there is no attempt count at which the TV stops, because stopping
 * would mean a pairing screen that stays broken until somebody finds a remote
 * this app does not have. Half a minute is often enough to catch a router
 * coming back before anyone has poured a drink, and rare enough to be free.
 */
const REOPEN_SETTLED_DELAY_MS = 30_000;

/** How long the TV waits before trying again, having failed `failures` times. */
export function reopenDelay(failures: number): number {
  return REOPEN_DELAYS_MS[failures - 1] ?? REOPEN_SETTLED_DELAY_MS;
}

/**
 * How long an attempt may go unanswered before the screen admits it is not
 * getting through.
 *
 * It exists because the failure that actually happens is silence, not a
 * rejection: `ConvexReactClient` queues a mutation it has no socket for and
 * neither resolves nor rejects it, so a TV switched on ahead of its router
 * would sit on four blank code tiles with nothing to say. Four seconds is far
 * longer than the round trip a working deployment makes — a room with wifi
 * never sees this — and matches the patience the Controller spends on the same
 * silence when it resumes a session.
 */
const OPEN_PATIENCE_MS = 4_000;

/**
 * Keeps opening the room until one opens, telling the screen where it has got
 * to, and never stopping.
 *
 * The two ways it can fail want different answers. A *rejection* is an attempt
 * that is over, so another one is made after `delayAfter`. Silence is an
 * attempt that is still out there — Convex is holding the mutation and will
 * send it the moment the socket comes up — so the screen is told it is
 * reconnecting and nothing else is issued: re-asking would open a second room
 * as soon as the connection returned, and every phone that had read the first
 * code off the screen would be typing it at a room nobody was showing.
 *
 * `open` is `openRoom`, whose memo makes the whole thing safe from the other
 * direction too: while an attempt is in flight, asking again is the same
 * attempt, and once one has succeeded every later caller gets that room.
 *
 * Returns a stop for a screen that has gone away: it drops the pending retry
 * and reports nothing further.
 */
export function keepOpeningRoom(
  open: () => Promise<OpenRoom>,
  report: (opening: RoomOpening) => void,
  patience: number = OPEN_PATIENCE_MS,
  delayAfter: (failures: number) => number = reopenDelay,
): () => void {
  let stopped = false;
  let failures = 0;
  let retrying: ReturnType<typeof setTimeout> | undefined;
  let complained = false;

  /**
   * The TV has no other channel to complain through — but it complains once.
   * A line per attempt is some 2,900 of them across a night against a backend
   * that is simply gone, every one saying what the first already said, so what
   * reaches the log is the change of state and not the retrying.
   */
  function complainOnce(...message: readonly unknown[]): void {
    if (!complained) {
      complained = true;
      console.warn(...message);
    }
  }

  const impatient = setTimeout(() => {
    if (!stopped) {
      complainOnce('Huddle TV is not getting through to its Convex deployment; it keeps trying.');
      report(RECONNECTING);
    }
  }, patience);

  function attempt(): void {
    open().then(
      (room) => {
        clearTimeout(impatient);
        if (!stopped) {
          report({ kind: 'open', room });
        }
      },
      (error: unknown) => {
        clearTimeout(impatient);
        failures += 1;
        complainOnce('Huddle TV could not open a room; it keeps trying:', error);

        if (!stopped) {
          report(RECONNECTING);
          retrying = setTimeout(attempt, delayAfter(failures));
        }
      },
    );
  }

  attempt();

  return () => {
    stopped = true;
    clearTimeout(impatient);
    clearTimeout(retrying);
  };
}

/** The line under the code tiles, and whether it is trouble the room should see. */
export type RoomOpeningCaption = {
  readonly text: string;
  /**
   * Trouble is drawn as a Boardwalk status chip rather than as the caption's
   * quiet muted line — see `PairingCaption` in `app/index.tsx`.
   */
  readonly trouble: boolean;
};

/**
 * What the pairing screen says under the Room Code tiles.
 *
 * The handoff draws no failure state for this screen — it draws a TV that is
 * working — so the two troubled lines are additions to the system rather than
 * transcriptions of it. Both are written for the only reader a broken TV has:
 * somebody across the room who cannot touch the app, and (for the misconfigured
 * one) whoever installed it, who needs the name of the setting rather than an
 * apology. That line says *rebuild* and not *relaunch* on purpose: Metro inlines
 * every `EXPO_PUBLIC_` value at bundle time, so an APK sideloaded onto the
 * Philips cannot pick up an edited `.env` by being started again.
 *
 * Exhaustive by construction, as the Controller's rejection copy is
 * (`join-rejection.ts`): every kind is named and there is no `default`, so a
 * fifth `RoomOpening` is a compile error here rather than a state that quietly
 * inherits the invitation.
 */
export function roomOpeningCaption(opening: RoomOpening): RoomOpeningCaption {
  switch (opening.kind) {
    case 'opening':
    case 'open':
      return { text: 'Open Huddle on your phone and enter this code', trouble: false };
    case 'reconnecting':
      return { text: 'Can’t reach Huddle — reconnecting…', trouble: true };
    case 'misconfigured':
      return { text: 'No Huddle backend — set EXPO_PUBLIC_CONVEX_URL and rebuild', trouble: true };
  }
}
