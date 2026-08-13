import { isAvatarId, isGuestId, type AvatarId, type GuestProfileV1 } from '@huddle/domain';

import type { IdentityStore, PlayerIdentity } from '../../models';
import { nicknameEntry } from './join-entry';

export type { IdentityStore, PlayerIdentity } from '../../models';

/**
 * The two things a returning player should not have to say twice: the name they
 * go by and the avatar they picked last time.
 *
 * Neither is a secret — a nickname in a living room, and a built-in avatar —
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
const NOTHING_REMEMBERED: PlayerIdentity = { nickname: null, avatar: null };

export type GuestIdFactory = () => string;

/**
 * The remembered identity as its two fields, or nothing-remembered for anything
 * that is not a record this app would have written: no value, malformed JSON,
 * an old shape, an avatar no longer in the set, a name longer than a name may
 * be.
 *
 * The store is plain text on the device and outlives installs and updates, so
 * what it hands back is treated as input rather than as something this version
 * of the app can assume it once wrote. A name is capped through the same
 * `nicknameEntry` the field uses, so a stored value cannot outrun the rule the
 * keyboard is held to; an avatar is kept only if it still names one.
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
    avatar: cleanAvatar(record.avatar),
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

/** A stored avatar, kept only if it still names one this build offers. */
function cleanAvatar(value: unknown): AvatarId | null {
  return typeof value === 'string' && isAvatarId(value) ? value : null;
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

/** Reads the v1 profile or migrates the former remembered name/avatar shape. */
export async function loadGuestProfile(
  store: IdentityStore,
  createGuestId: GuestIdFactory,
): Promise<GuestProfileV1> {
  let raw: string | null = null;
  try {
    raw = await store.read();
    if (raw !== null) {
      const candidate = JSON.parse(raw) as unknown;
      if (typeof candidate === 'object' && candidate !== null) {
        const record = candidate as Record<string, unknown>;
        if (
          record.version === 1 &&
          isGuestId(record.guestId) &&
          cleanNickname(record.displayName) !== null &&
          cleanAvatar(record.avatarId) !== null
        ) {
          return candidate as GuestProfileV1;
        }
      }
    }
  } catch {
    // Corrupt preferences migrate as an empty legacy profile below.
  }

  const legacy = parseIdentity(raw);
  const guestId = createGuestId();
  if (!isGuestId(guestId)) throw new Error('guest id factory returned a non-UUID');
  const profile: GuestProfileV1 = {
    version: 1,
    guestId,
    displayName: legacy.nickname ?? '',
    avatarId: legacy.avatar ?? 'fox',
  };
  await rememberProfile(store, profile);
  return profile;
}

export async function rememberProfile(store: IdentityStore, profile: GuestProfileV1): Promise<void> {
  try {
    await store.write(JSON.stringify(profile));
  } catch {
    // Profile persistence is a convenience; the room credential is separate.
  }
}

/**
 * Remembers a name without disturbing the remembered avatar, and `rememberAvatar`
 * the reverse.
 *
 * The two are learned at different moments — the name as a player joins, the
 * avatar once they pick one — so each write reads the record back first and
 * changes only its own field. Writing the name alone would otherwise erase a
 * avatar the player claimed on their last visit, and the next visit would prefill
 * only half of what it could.
 */
export async function rememberName(store: IdentityStore, nickname: string): Promise<void> {
  await mergeIdentity(store, (current) => ({ ...current, nickname: cleanNickname(nickname) }));
}

/** Remembers an avatar, leaving the remembered name untouched (see `rememberName`). */
export async function rememberAvatar(store: IdentityStore, avatar: AvatarId): Promise<void> {
  await mergeIdentity(store, (current) => ({ ...current, avatar }));
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
