import { settingsFrom, type GameSettings, type GameSettingsSchema } from '@huddle/domain';

export const ROUND_COUNTS = [3, 5, 7] as const;
export type RoundCount = (typeof ROUND_COUNTS)[number];

export const VOTE_SECONDS_OPTIONS = ['15', '30', '45', 'none'] as const;
export type VoteSeconds = 15 | 30 | 45 | 'none';

export const RESULT_MODES = ['together', 'live'] as const;
export type ResultMode = (typeof RESULT_MODES)[number];

export const VOTER_LABEL_MODES = ['hidden', 'afterReveal'] as const;
export type VoterLabelMode = (typeof VOTER_LABEL_MODES)[number];

const ROUNDS_KEY = 'rounds';
const VOTE_SECONDS_KEY = 'voteSeconds';
const RESULTS_KEY = 'results';
const VOTER_LABELS_KEY = 'voterLabels';

export const VOTING_SETTINGS_SCHEMA: GameSettingsSchema = [
  {
    key: ROUNDS_KEY,
    label: 'Rounds',
    options: ROUND_COUNTS.map((rounds) => ({ value: String(rounds), label: String(rounds) })),
    defaultValue: '5',
  },
  {
    key: VOTE_SECONDS_KEY,
    label: 'Time to vote',
    options: [
      { value: '15', label: '15 sec' },
      { value: '30', label: '30 sec' },
      { value: '45', label: '45 sec' },
      { value: 'none', label: 'No timer' },
    ],
    defaultValue: '30',
  },
  {
    key: RESULTS_KEY,
    label: 'Results',
    options: [
      { value: 'together', label: 'Reveal together' },
      { value: 'live', label: 'Live tally' },
    ],
    defaultValue: 'together',
  },
  {
    key: VOTER_LABELS_KEY,
    label: 'Voter labels',
    options: [
      { value: 'hidden', label: 'Hidden' },
      { value: 'afterReveal', label: 'Shown after reveal' },
    ],
    defaultValue: 'hidden',
  },
];

export type VotingSettings = {
  readonly rounds: RoundCount;
  readonly voteSeconds: VoteSeconds;
  readonly results: ResultMode;
  readonly voterLabels: VoterLabelMode;
};

function roundCount(value: string | undefined): RoundCount {
  return ROUND_COUNTS.find((rounds) => String(rounds) === value) ?? 5;
}

function voteSeconds(value: string | undefined): VoteSeconds {
  if (value === 'none') return 'none';
  if (value === '15' || value === '30' || value === '45') return Number(value) as VoteSeconds;
  return 30;
}

export function votingSettings(chosen: GameSettings | undefined): VotingSettings {
  const settled = settingsFrom(VOTING_SETTINGS_SCHEMA, chosen);
  return {
    rounds: roundCount(settled[ROUNDS_KEY]),
    voteSeconds: voteSeconds(settled[VOTE_SECONDS_KEY]),
    results: settled[RESULTS_KEY] === 'live' ? 'live' : 'together',
    voterLabels: settled[VOTER_LABELS_KEY] === 'afterReveal' ? 'afterReveal' : 'hidden',
  };
}

export const VOTING_SETTINGS_PRESENTATION = {
  presets: [
    {
      mode: 'quick' as const,
      label: 'Quick',
      settings: {
        rounds: '3',
        voteSeconds: '15',
        results: 'together',
        voterLabels: 'hidden',
      },
    },
    {
      mode: 'standard' as const,
      label: 'Standard',
      settings: {
        rounds: '5',
        voteSeconds: '30',
        results: 'together',
        voterLabels: 'hidden',
      },
    },
  ],
  customSettingKeys: [ROUNDS_KEY, VOTE_SECONDS_KEY, RESULTS_KEY, VOTER_LABELS_KEY],
} as const;
