import {
  normalizeRoomCode,
  ROOM_CODE_ACCEPTED_ALPHABET,
  ROOM_CODE_LENGTH,
} from '@huddle/domain';
import type { PlayerSession } from '../room-client';

export type { PlayerSession };

export type SessionTokenStore = {
  readonly read: () => Promise<string | null>;
  readonly write: (sessionToken: string) => Promise<void>;
  readonly clear?: () => Promise<void>;
};

type SessionLookup = (sessionToken: string) => Promise<PlayerSession | null>;

export function resumeReportState({
  current,
  currentToken,
  candidateToken,
  late,
  ignoreLateResume,
}: {
  readonly current: PlayerSession | null | undefined;
  readonly currentToken: string | undefined;
  readonly candidateToken: string | undefined;
  readonly late: PlayerSession | null;
  readonly ignoreLateResume: boolean;
}): { readonly session: PlayerSession | null | undefined; readonly sessionToken: string | undefined } {
  if (ignoreLateResume || (current !== undefined && current !== null)) {
    return { session: current, sessionToken: currentToken };
  }

  return late === null
    ? { session: null, sessionToken: undefined }
    : { session: late, sessionToken: candidateToken };
}

export type ResumeLookupResult = 'pending' | 'seat' | 'null' | 'failed';

export function shouldClearRestoredCredential({
  lookupResult,
  reported,
  current,
  ignoreLateResume,
}: {
  readonly lookupResult: ResumeLookupResult;
  readonly reported: PlayerSession | null;
  readonly current: PlayerSession | null | undefined;
  readonly ignoreLateResume: boolean;
}): boolean {
  return lookupResult === 'null' && reported === null && current === null && !ignoreLateResume;
}

export type SessionTokenStatus = 'present' | 'missing';

export function alsoInMemory(store: SessionTokenStore): SessionTokenStore {
  let mintedThisLaunch: string | null = null;

  return {
    read: async () => mintedThisLaunch ?? (await store.read()),
    write: async (sessionToken) => {
      mintedThisLaunch = sessionToken;
      await store.write(sessionToken);
    },
    clear: async () => {
      mintedThisLaunch = null;
      await store.clear?.();
    },
  };
}

export async function forgetSession(store: SessionTokenStore): Promise<void> {
  try {
    await store.clear?.();
  } catch {
  }
}

const RESUME_PATIENCE_MS = 4000;

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
      if (!cancelled && !timedOut) onTokenStatus?.('missing');
    }

    clearTimeout(givingUp);
    if (!cancelled) {
      report(session);
    }
  })();

  return () => {
    cancelled = true;
    clearTimeout(givingUp);
  };
}

export async function rememberSession(
  store: SessionTokenStore,
  sessionToken: string,
): Promise<void> {
  try {
    await store.write(sessionToken);
  } catch {
  }
}

type JoinScreenState =
  | { readonly kind: 'restoring' }
  | { readonly kind: 'joining' }
  | { readonly kind: 'handoff'; readonly session: PlayerSession }
  | { readonly kind: 'seated'; readonly session: PlayerSession };

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

  const scanned = [...normalizeRoomCode(linkedCode)]
    .filter((letter) => ROOM_CODE_ACCEPTED_ALPHABET.includes(letter))
    .slice(0, ROOM_CODE_LENGTH)
    .join('');

  return scanned !== '' && scanned !== session.code
    ? { kind: 'handoff', session }
    : { kind: 'seated', session };
}
