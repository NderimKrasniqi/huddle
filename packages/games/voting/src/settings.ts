import { type GameSettings, type GameSettingsSchema, settingsFrom } from '@huddle/game-core';

import { CURATED_PROMPTS } from './prompts';

/**
 * The Voting game's one host-tunable option: how many prompts a game runs.
 *
 * Trivia declares three settings; this game declares one, which is enough to
 * prove the same thing — the hub validates it, defaults it and draws it without
 * knowing that "rounds" is a number of prompts. Everything the game knows about
 * its own setting is on this side of a schema the hub reads as labelled strings.
 *
 * One setting rather than none because a *test* game with an empty schema would
 * leave the settings path untested by anything but trivia; one setting exercises
 * it for a second, differently-shaped game.
 */

/** How many prompts a game runs — kept below the Curated Prompt count so the deal always has a prompt to take. */
export const ROUND_COUNTS = [3, 5] as const;

export type RoundCount = (typeof ROUND_COUNTS)[number];

const ROUNDS_KEY = 'rounds';

const DEFAULT_ROUNDS: RoundCount = 3;

/**
 * What the Host may choose before a game of Voting starts.
 *
 * Every value is a string the hub hands back untouched and a label only a
 * person reads. The options are capped at what the Curated Prompts can supply,
 * so a Host can never ask for more prompts than the game has to deal.
 */
export const VOTING_SETTINGS_SCHEMA: GameSettingsSchema = [
  {
    key: ROUNDS_KEY,
    label: 'Rounds',
    // Only the counts the prompt list can actually deal: a longer game than
    // there are prompts is not an option the schema offers.
    options: ROUND_COUNTS.filter((count) => count <= CURATED_PROMPTS.length).map((count) => ({
      value: String(count),
      label: `${count} prompts`,
    })),
    defaultValue: String(DEFAULT_ROUNDS),
  },
];

/** The setting above, as the game's own rules need it. */
export type VotingSettings = {
  readonly rounds: RoundCount;
};

function roundCount(value: string | undefined): RoundCount {
  return ROUND_COUNTS.find((count) => String(count) === value) ?? DEFAULT_ROUNDS;
}

/**
 * The Host's settings, read as the game's one.
 *
 * Total, like `settingsFrom` it is built on: a game handed something its schema
 * never offered deals a default rather than throwing inside a mutation. That is
 * a floor nobody stands on — `startGame` refuses those settings before a game is
 * seeded from them — and it is what makes this return type honest, since
 * `GameSettings` is strings and `VotingSettings` is not.
 */
export function votingSettings(chosen: GameSettings | undefined): VotingSettings {
  const settled = settingsFrom(VOTING_SETTINGS_SCHEMA, chosen);

  return { rounds: roundCount(settled[ROUNDS_KEY]) };
}
