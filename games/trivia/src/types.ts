import type { GameEvent } from '@huddle/domain';

export type TriviaState = {
  readonly phase: 'entered';
  readonly resolvedSettings: { readonly questions: 5 | 10 };
};

export type TriviaEvent = GameEvent & { readonly kind: 'unsupported' };
