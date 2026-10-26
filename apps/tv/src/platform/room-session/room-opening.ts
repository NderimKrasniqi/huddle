import type { OpenRoom } from '../room-client';

import { onlyOnce } from './only-once';
import { isTvIdentityError } from './tv-session';

export type { OpenRoom };

export type RoomOpener = {
  readonly openRoom: () => Promise<OpenRoom>;
  readonly closeExpiredRoom: (expired: OpenRoom) => void;
};

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

export type RoomOpening =
  | { readonly kind: 'opening' }
  | { readonly kind: 'reconnecting' }
  | { readonly kind: 'open'; readonly room: OpenRoom }
  | { readonly kind: 'misconfigured' }
  | { readonly kind: 'deviceFailure' };

const RECONNECTING: RoomOpening = { kind: 'reconnecting' };

export function roomOpeningAtLaunch(deployed: boolean): RoomOpening {
  return deployed ? { kind: 'opening' } : { kind: 'misconfigured' };
}

const REOPEN_DELAYS_MS = [1_000, 2_000, 4_000, 8_000, 16_000] as const;

const REOPEN_SETTLED_DELAY_MS = 30_000;

export function reopenDelay(failures: number): number {
  return REOPEN_DELAYS_MS[failures - 1] ?? REOPEN_SETTLED_DELAY_MS;
}

const OPEN_PATIENCE_MS = 4_000;

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

  function complainOnce(...message: readonly unknown[]): void {
    if (!complained) {
      complained = true;
      console.warn(...message);
    }
  }

  const impatient = setTimeout(() => {
    if (!stopped) {
      complainOnce('Huddle TV is not getting through to its room service; it keeps trying.');
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

        if (isTvIdentityError(error)) {
          complainOnce(`Huddle TV device identity failed (${error.failure}).`);
          if (!stopped) report({ kind: 'deviceFailure' });
          return;
        }

        complainOnce('Huddle TV could not open a room; it keeps trying.');

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

export type RoomOpeningCaption = {
  readonly kind: 'invitation';
  readonly before: string;
  readonly emphasis: string;
  readonly after: string;
} | {
  readonly kind: 'trouble';
  readonly text: string;
};

export function roomOpeningCaption(opening: RoomOpening): RoomOpeningCaption {
  switch (opening.kind) {
    case 'opening':
    case 'open':
      return {
        kind: 'invitation',
        before: 'Open ',
        emphasis: 'Huddle',
        after: ' on your phone and enter the code',
      };
    case 'reconnecting':
      return { kind: 'trouble', text: 'Can’t reach Huddle — reconnecting…' };
    case 'misconfigured':
      return {
        kind: 'trouble',
        text: 'No Huddle room service in this build',
      };
    case 'deviceFailure':
      return {
        kind: 'trouble',
        text: 'Huddle could not save this TV identity — check device storage',
      };
  }
}
