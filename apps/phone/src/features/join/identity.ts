import { isAvatarId, isGuestId, type AvatarId, type GuestProfileV1 } from '@huddle/domain';

import type { IdentityStore, PlayerIdentity } from '../../models';
import { nicknameEntry } from './join-entry';

export type { IdentityStore, PlayerIdentity } from '../../models';

const NOTHING_REMEMBERED: PlayerIdentity = { nickname: null, avatar: null };

type GuestIdFactory = () => string;

function parseIdentity(raw: string | null): PlayerIdentity {
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

function cleanNickname(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === '' ? null : nicknameEntry(trimmed);
}

function cleanAvatar(value: unknown): AvatarId | null {
  return typeof value === 'string' && isAvatarId(value) ? value : null;
}

export async function recallIdentity(store: IdentityStore): Promise<PlayerIdentity> {
  try {
    return parseIdentity(await store.read());
  } catch {
    return NOTHING_REMEMBERED;
  }
}

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
          typeof record.displayName === 'string' &&
          cleanAvatar(record.avatarId) !== null
        ) {
          const profile: GuestProfileV1 = {
            version: 1,
            guestId: record.guestId,
            displayName: cleanNickname(record.displayName) ?? '',
            avatarId: cleanAvatar(record.avatarId) as AvatarId,
          };

          if (JSON.stringify(candidate) !== JSON.stringify(profile)) {
            await rememberProfile(store, profile);
          }
          return profile;
        }
      }
    }
  } catch {
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
  }
}

export async function rememberName(store: IdentityStore, nickname: string): Promise<void> {
  await mergeIdentity(store, (current) => ({ ...current, nickname: cleanNickname(nickname) }));
}

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
  }
}
