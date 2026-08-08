import { isPlayerColorName, type PlayerColorName } from '@huddle/game-core';

import { nicknameEntry } from './join-entry';

/**
 * The two things a returning player should not have to say twice: the name they
 * go by and the color they picked last time.
 *
 * Neither is a secret — a nickname in a living room, and one of ten swatches —
 * so unlike the Session Token these live in plain device storage
 * (`identity-store.ts`) rather than the keystore. Losing them costs a returning
 * player a few taps, never their seat, which is why every read here falls back
 * to nothing-remembered rather than failing: a prefill that cannot be filled is
 * just the form the way it has always opened.
 *
 * The storage is handed in rather than reached for, exactly as `session.ts`
 * does it, so the part worth checking — what a corrupt or empty store parses to,
 * and that one field's write never disturbs the other — is plain TypeScript a
 * unit test can run. `identity-store.ts` holds the phone's real storage.
 */
export type PlayerIdentity = {
  /** The last name this phone joined under, or `null` if it never has. */
  readonly nickname: string | null;
  /** The last color this phone claimed, or `null` if it never has. */
  readonly color: PlayerColorName | null;
};

/** Where the last-used name and color live between launches, as one JSON string. */
export type IdentityStore = {
  /** The stored record, or `null` if this phone has remembered nothing. */
  readonly read: () => Promise<string | null>;
  /** Writes the record, replacing whatever was there. */
  readonly write: (raw: string) => Promise<void>;
};

const NOTHING_REMEMBERED: PlayerIdentity = { nickname: null, color: null };

/**
 * The remembered identity as its two fields, or nothing-remembered for anything
 * that is not a record this app would have written: no value, malformed JSON,
 * an old shape, a color no longer in the palette, a name longer than a name may
 * be.
 *
 * The store is plain text on the device and outlives installs and updates, so
 * what it hands back is treated as input rather than as something this version
 * of the app can assume it once wrote. A name is capped through the same
 * `nicknameEntry` the field uses, so a stored value cannot outrun the rule the
 * keyboard is held to; a color is kept only if it still names a swatch.
 */
export function parseIdentity(raw: string | null): PlayerIdentity {
  if (raw === null) {
    return NOTHING_REMEMBERED;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return NOTHING_REMEMBERED;
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return NOTHING_REMEMBERED;
  }

  const record = parsed as Record<string, unknown>;
  return {
    nickname: cleanNickname(record.nickname),
    color: cleanColor(record.color),
  };
}

/** A stored name, capped and un-blanked exactly as the join field holds it. */
function cleanNickname(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const capped = nicknameEntry(value);
  return capped.trim() === '' ? null : capped;
}

/** A stored color, kept only if it still names one of the ten swatches. */
function cleanColor(value: unknown): PlayerColorName | null {
  return typeof value === 'string' && isPlayerColorName(value) ? value : null;
}

/**
 * The remembered identity, or nothing-remembered if the store cannot be read.
 *
 * It never throws: a prefill is a courtesy, and a phone that cannot read its own
 * preferences arrives at the same form a first-time phone does.
 */
export async function recallIdentity(store: IdentityStore): Promise<PlayerIdentity> {
  try {
    return parseIdentity(await store.read());
  } catch {
    return NOTHING_REMEMBERED;
  }
}

/**
 * Remembers a name without disturbing the remembered color, and `rememberColor`
 * the reverse.
 *
 * The two are learned at different moments — the name as a player joins, the
 * color once they claim a swatch — so each write reads the record back first and
 * changes only its own field. Writing the name alone would otherwise erase a
 * color the player claimed on their last visit, and the next visit would prefill
 * only half of what it could.
 */
export async function rememberName(store: IdentityStore, nickname: string): Promise<void> {
  await mergeIdentity(store, (current) => ({ ...current, nickname: cleanNickname(nickname) }));
}

/** Remembers a color, leaving the remembered name untouched (see `rememberName`). */
export async function rememberColor(store: IdentityStore, color: PlayerColorName): Promise<void> {
  await mergeIdentity(store, (current) => ({ ...current, color }));
}

async function mergeIdentity(
  store: IdentityStore,
  change: (current: PlayerIdentity) => PlayerIdentity,
): Promise<void> {
  try {
    const next = change(await recallIdentity(store));
    await store.write(JSON.stringify(next));
  } catch {
    // A phone that cannot write down a preference has lost a courtesy, not a
    // seat — the same silence `rememberSession` keeps for the Session Token.
  }
}
