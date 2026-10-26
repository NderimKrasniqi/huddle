import type { AvatarId } from '@huddle/domain';

export type PlayerIdentity = {
  readonly nickname: string | null;
  readonly avatar: AvatarId | null;
};

export type IdentityStore = {
  readonly read: () => Promise<string | null>;
  readonly write: (raw: string) => Promise<void>;
};
