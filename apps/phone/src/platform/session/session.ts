import {
  normalizeRoomCode,
  ROOM_CODE_ACCEPTED_ALPHABET,
  ROOM_CODE_LENGTH,
} from '@huddle/domain';
import type { api } from '@huddle/convex';
import type { FunctionReturnType } from 'convex/server';

/**
 * Rejoining, from the phone's side: what the Phone does with the Session
 * Token it wrote down the last time somebody joined.
 *
 * Force-quitting an app does not give up a seat — the player row and its
 * nickname are still in the room. So the Phone's first act on every launch
 * is not to offer a join form but to ask whether this phone is already
 * somebody, and only a phone that is nobody gets the form. That is what keeps a
 * player from taking a second seat under a name the room would then refuse them.
 *
 * The storage and the room are handed in rather than reached for, so that the
 * part worth checking — which screen a launch ends on — is plain TypeScript a
 * unit test can run. `session-store.ts` holds the phone's real storage; the join
 * screen supplies the query.
 */

/** A player's place in a room, as `players.session` and `joinRoom` both give it. */
export type PlayerSession = NonNullable<FunctionReturnType<typeof api.players.session>>;

/** Where the Session Token lives between launches of the app. */
export type SessionTokenStore = {
  /** The remembered token, or `null` if this phone has never joined a room. */
  readonly read: () => Promise<string | null>;
  /** Remembers a token, replacing whatever was there. */
  readonly write: (sessionToken: string) => Promise<void>;
};

/** Asking the room which seat a token holds — `players.session`, bound to a client. */
export type SessionLookup = (sessionToken: string) => Promise<PlayerSession | null>;

/** Whether the launch found a persisted credential before asking the room. */
export type SessionTokenStatus = 'present' | 'missing';

/**
 * `store`, plus a memory of what it was last given — so that a store which
 * cannot write is not also a store that cannot read.
 *
 * A keystore write can fail (a locked device, a keychain that will not open),
 * and `rememberSession` swallows that on purpose: a phone that cannot record
 * its token has lost its rejoin, not its join. That stopped being the whole
 * cost the moment presence started reading the token back on every launch —
 * without this, the same failure would leave a player who is sitting in the
 * room unable to beat, and muted on the TV within seconds of joining it. Memory
 * covers the run the phone is in; only a keystore can cover the next one.
 *
 * What it remembers wins over what the store answers, because it is never the
 * staler of the two: it is written in the same breath, and it is the right one
 * in exactly the case where the store's half of that breath failed.
 */
export function alsoInMemory(store: SessionTokenStore): SessionTokenStore {
  let mintedThisLaunch: string | null = null;

  return {
    read: async () => mintedThisLaunch ?? (await store.read()),
    write: async (sessionToken) => {
      // Before the write, not after it: the failing write is the case this
      // exists for.
      mintedThisLaunch = sessionToken;
      await store.write(sessionToken);
    },
  };
}

/**
 * How long a launch will stay blank waiting to hear whether this phone already
 * holds a seat, before it gives up and shows the join form.
 *
 * It exists because an unreachable backend does not fail: `ConvexReactClient`
 * holds a query until a websocket update arrives, with no timeout of its own and
 * no rejection for connectivity, so a phone opened on dropped wifi would wait on
 * that promise for as long as its owner kept staring at nothing. Four seconds is
 * far longer than the round trip a working connection makes — nobody in a room
 * with wifi sees the form flash — and far shorter than forever.
 *
 * It is a deadline on the blank screen, not on the session: see `resumeSession`.
 */
const RESUME_PATIENCE_MS = 4000;

/**
 * Works out the seat this phone still holds and reports it to the screen —
 * `null` when it holds none.
 *
 * It may report twice, and the second word is the true one. If the room has not
 * answered within `patience`, it says `null`, so the player gets a form rather
 * than a blank screen; if the answer turns up late it says so, and the screen
 * swaps to that seat. Giving up on the *screen* rather than on the *lookup* is
 * what keeps a slow network from costing somebody their seat — abandoning the
 * query at the deadline would leave a rejoining player on a form whose only
 * outcomes are "name taken" and a second seat.
 *
 * Every way of not having a seat ends in `null` rather than a throw, including a
 * phone that cannot read its own storage and a query that fails server-side. The
 * join screen is the only screen a player can act from, so a launch has to end
 * either there or in their seat.
 *
 * What this design leaves open, since the deadline hands out a join form to a
 * player who may still turn out to hold a seat: if the room's answer arrives
 * only *after* they have joined again under a **different** nickname, the room
 * holds two rows for one person. It takes a backend that was unreachable for
 * four seconds and a deliberate change of name — retyping their own name is
 * refused by `nameTaken`, since their first row still holds it — and the screen
 * itself keeps the newer seat (see the report callback in `app/index.tsx`).
 * The stranded row is left to presence and room expiry, which own rows nobody
 * is behind: it goes Away within seconds, and with the room ten minutes after
 * the party does.
 *
 * Returns a canceller for a screen that has gone away: it drops the deadline and
 * the report. The lookup itself cannot be called back, only ignored.
 */
export function resumeSession(
  store: SessionTokenStore,
  lookUp: SessionLookup,
  report: (session: PlayerSession | null) => void,
  patience: number = RESUME_PATIENCE_MS,
  onTokenStatus?: (status: SessionTokenStatus) => void,
): () => void {
  let cancelled = false;
  let timedOut = false;
  const givingUp = setTimeout(() => {
    timedOut = true;
    report(null);
  }, patience);

  void (async () => {
    let session: PlayerSession | null = null;

    try {
      const sessionToken = await store.read();
      if (sessionToken === null) {
        if (!cancelled && !timedOut) onTokenStatus?.('missing');
        session = null;
      } else {
        if (!cancelled && !timedOut) onTokenStatus?.('present');
        session = await lookUp(sessionToken);
      }
    } catch {
      // A phone that cannot say who it is arrives as somebody new.
      if (!cancelled && !timedOut) onTokenStatus?.('missing');
    }

    clearTimeout(givingUp);
    // Saying `null` a second time tells the screen nothing the join form is not
    // already saying, so it is left to be a no-op there rather than guarded here.
    if (!cancelled) {
      report(session);
    }
  })();

  return () => {
    cancelled = true;
    clearTimeout(givingUp);
  };
}

/**
 * Writes down the Session Token a join just minted, so the next launch can find
 * this seat.
 *
 * It never fails: the seat exists in the room the moment `joinRoom` returns, and
 * a phone that cannot record its token has lost its rejoin, not its join. The
 * player must not be told otherwise on a screen that just seated them.
 */
export async function rememberSession(
  store: SessionTokenStore,
  sessionToken: string,
): Promise<void> {
  try {
    await store.write(sessionToken);
  } catch {
    // Nothing to do about it here, and nothing worth saying to the player.
  }
}

/** What the Join Screen is showing: nothing yet, the form, or the seat they hold. */
export type JoinScreenState =
  | { readonly kind: 'restoring' }
  | { readonly kind: 'joining' }
  | { readonly kind: 'seated'; readonly session: PlayerSession };

/**
 * Which of its three faces the Join Screen wears, given what `resumeSession` has
 * reported and the Room Code of a scanned Join Link (empty when the phone did
 * not arrive by one).
 *
 * A seat wins over the form — that is rejoining — with one exception: a Join
 * Link naming a *different* room. The party moving to a second TV is the case,
 * and since the seated screen has no leave control and a room only expires ten
 * minutes after the last phone in it goes quiet, a phone kept in its old room by
 * a scan it ignored would be kept there for the rest of the evening. A link for
 * the room they are already in asks for nothing and is ignored, which is why the
 * two are told apart by code rather than by the link merely existing.
 */
export function joinScreenState(
  session: PlayerSession | null | undefined,
  linkedCode: string,
): JoinScreenState {
  if (session === undefined) {
    return { kind: 'restoring' };
  }

  if (session === null) {
    return { kind: 'joining' };
  }

  // Read through the same entry the tiles use, so a link written in lower case
  // or carrying a stray character is compared as the Room Code it means.
  const scanned = [...normalizeRoomCode(linkedCode)]
    .filter((letter) => ROOM_CODE_ACCEPTED_ALPHABET.includes(letter))
    .slice(0, ROOM_CODE_LENGTH)
    .join('');

  return scanned !== '' && scanned !== session.code
    ? { kind: 'joining' }
    : { kind: 'seated', session };
}
