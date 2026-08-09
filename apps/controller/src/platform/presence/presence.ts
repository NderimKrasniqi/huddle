import { HEARTBEAT_INTERVAL_MS } from '@huddle/game-core';

import type { SessionTokenStore } from '../session';

/**
 * Presence, from the phone's side: saying "still here" for as long as the app
 * is in front of its owner, and saying nothing at all once it is not.
 *
 * The silence is the point. A phone in a pocket is a player who cannot answer a
 * question on the TV, and the room finds that out by not being told — so
 * backgrounding stops the beat deliberately rather than relying on the platform
 * to suspend the timer, and going away is one behaviour whether the app was
 * backgrounded, force-quit, or carried out of wifi range.
 *
 * The storage, the beat itself and word of the foreground are handed in rather
 * than reached for, exactly as in `session.ts`: what is worth testing here is
 * *when* a phone speaks, and that is then plain TypeScript on a fake clock.
 */

/** Sending one beat to the room — `players.heartbeat`, bound to a client. */
export type Heartbeat = (sessionToken: string) => Promise<unknown>;

/**
 * Word of whether the app is in front of its owner, now and whenever that
 * changes. Subscribing reports the current state straight away, so a caller
 * never has to guess it; the returned function unsubscribes.
 */
export type ForegroundWatch = (onChange: (inForeground: boolean) => void) => () => void;

/**
 * Keeps the room hearing from this phone: a beat now and every `interval`
 * afterwards while the app is in the foreground, nothing while it is not, and a
 * beat the instant it comes back.
 *
 * That immediate beat is what clears an away badge — a returning player is
 * marked present again within a round trip, rather than within an interval of
 * one. It is also why the interval only ever starts alongside a beat: a phone
 * must never be a whole interval away from saying anything it could have said.
 *
 * Every failure ends in silence rather than a throw, because silence is a
 * meaning this module already has. A beat that does not land, a phone that
 * cannot read its own Session Token, and a phone that never joined a room are
 * all a room hearing nothing — which is the truth in every one of those cases,
 * and the next beat carries the news if it stops being true.
 *
 * Returns a stop for the screen that started it: it drops the timer and the
 * foreground subscription.
 */
export function keepPresent(
  store: SessionTokenStore,
  beat: Heartbeat,
  watchForeground: ForegroundWatch,
  interval: number = HEARTBEAT_INTERVAL_MS,
): () => void {
  let sessionToken: string | null = null;
  let inForeground = false;
  let beating: ReturnType<typeof setInterval> | undefined;
  let stopped = false;

  async function pulse(token: string): Promise<void> {
    try {
      await beat(token);
    } catch {
      // A beat that does not land leaves the room hearing nothing, which is
      // what "away" is for, and the next one is one interval behind it.
    }
  }

  function beatNow(): void {
    if (sessionToken !== null) {
      void pulse(sessionToken);
    }
  }

  function startBeating(): void {
    if (beating !== undefined || stopped || !inForeground || sessionToken === null) {
      return;
    }

    beatNow();
    beating = setInterval(beatNow, interval);
  }

  function stopBeating(): void {
    if (beating !== undefined) {
      clearInterval(beating);
      beating = undefined;
    }
  }

  const unwatch = watchForeground((foreground) => {
    inForeground = foreground;

    if (foreground) {
      startBeating();
    } else {
      stopBeating();
    }
  });

  void store.read().then(
    (remembered) => {
      sessionToken = remembered;
      // The token usually arrives after the first word about the foreground,
      // so this is where a launch's first beat comes from.
      startBeating();
    },
    () => {
      // A phone that cannot say who it is says nothing.
    },
  );

  return () => {
    stopped = true;
    stopBeating();
    unwatch();
  };
}
