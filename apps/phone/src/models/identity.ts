import type { AvatarId } from '@huddle/domain';

/** The last-used identity remembered by the phone's local preferences. */
export type PlayerIdentity = {
  readonly nickname: string | null;
  readonly avatar: AvatarId | null;
};

/** Pure storage contract shared by the identity feature and its platform owner. */
export type IdentityStore = {
  readonly read: () => Promise<string | null>;
  readonly write: (raw: string) => Promise<void>;
};
