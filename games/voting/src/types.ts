import type { GameEvent } from '@huddle/domain';
export type VotingState = { readonly phase: 'entered'; readonly resolvedSettings: { readonly rounds: 3 | 5 } };
export type VotingEvent = GameEvent & { readonly kind: 'unsupported' };
