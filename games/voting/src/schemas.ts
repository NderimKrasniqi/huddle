import { z } from 'zod';

const playerId = z.string().min(1);
const prompt = z.strictObject({
  text: z.string(),
  options: z.tuple([z.string(), z.string(), z.string(), z.string()]),
});
const counts = z.tuple([
  z.number().int().nonnegative(),
  z.number().int().nonnegative(),
  z.number().int().nonnegative(),
  z.number().int().nonnegative(),
]);
const recapItem = z.strictObject({
  kind: z.enum(['agreement', 'closest', 'wildcard']),
  title: z.string(),
  detail: z.string(),
  value: z.string(),
});

const legacyVotingState = z.strictObject({
  phase: z.literal('entered'),
  resolvedSettings: z.strictObject({ rounds: z.union([z.literal(3), z.literal(5)]) }),
});

const playableVotingState = z.strictObject({
  prompts: z.array(prompt).min(1),
  roundIndex: z.number().int().nonnegative(),
  phase: z.enum(['intro', 'vote', 'reveal', 'finished']),
  voteSeconds: z.union([z.literal(15), z.literal(30), z.literal(45), z.literal('none')]),
  results: z.enum(['together', 'live']),
  voterLabels: z.enum(['hidden', 'afterReveal']),
  playerIds: z.array(playerId),
  votes: z.record(playerId, z.number().int().min(0).max(3)),
  history: z.array(z.strictObject({ promptIndex: z.number().int().nonnegative(), counts })),
  participationCount: z.number().int().nonnegative().optional(),
  tally: counts.optional(),
  revealedVoters: z.array(z.array(playerId)).optional(),
  recap: z.array(recapItem).optional(),
});

export const votingStateSchema = z.union([legacyVotingState, playableVotingState]);

const commonEvent = {
  msRemaining: z.number().finite().optional(),
  awayPlayerIds: z.array(playerId).optional(),
};

export const votingEventSchema = z.union([
  z.strictObject({
    kind: z.literal('vote'),
    playerId,
    roundIndex: z.number().int().nonnegative(),
    optionIndex: z.number().int().min(0).max(3),
    ...commonEvent,
  }),
  z.strictObject({
    kind: z.literal('advance'),
    playerId: playerId.optional(),
    roundIndex: z.number().int().nonnegative(),
    phase: z.enum(['intro', 'vote', 'reveal', 'finished']),
    ...commonEvent,
  }),
]);
