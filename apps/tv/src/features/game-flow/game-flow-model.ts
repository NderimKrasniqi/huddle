import type { GameSettingsSchema } from '@huddle/domain';
import type { ImageSourcePropType } from 'react-native';

import { gameCardAsset } from './assets';

export type TvGameCarouselCard = {
  readonly id: string;
  readonly title: string;
  readonly subtitle?: string;
  readonly available?: boolean;
  readonly image?: ImageSourcePropType;
};

/** Defaults are visual fallbacks; an authoritative registry projection may override every field. */
export const DEFAULT_TV_CAROUSEL_CARDS: readonly TvGameCarouselCard[] = [
  { id: 'trivia', title: 'Trivia', subtitle: 'Test your knowledge', available: true },
  { id: 'voting', title: 'Voting', subtitle: 'Vote on fun topics', available: true },
  { id: 'word-battle', title: 'Word Battle', subtitle: 'Coming soon', available: false },
  { id: 'more-games', title: 'More Games', subtitle: 'Coming soon', available: false },
].map((card) => ({ ...card, image: gameCardAsset(card.id) }));

export type TvGamePlayer = {
  readonly id: string;
  readonly name: string;
  readonly isHost?: boolean;
  readonly ready?: boolean;
  readonly away?: boolean;
  readonly avatar?: ImageSourcePropType;
};

export type TvSetupSetting = {
  readonly key: string;
  readonly value: string;
  readonly label?: string;
};

export type TvSetupSettings =
  | Readonly<Record<string, string>>
  | readonly TvSetupSetting[];

const SETUP_LABELS: Readonly<Record<string, string>> = {
  questions: 'Questions',
  rounds: 'Rounds',
};

/**
 * Converts the generic setup projection into the small list this TV shell can
 * draw. Unknown keys are deliberately ignored: a visual surface must not
 * invent or expose settings that the installed module did not declare.
 */
export function visibleTvSetupSettings(
  gameId: string,
  settings: TvSetupSettings | undefined,
  schema?: GameSettingsSchema,
): readonly TvSetupSetting[] {
  const entries = Array.isArray(settings)
    ? settings
    : Object.entries(settings ?? {}).map(([key, value]) => ({ key, value }));
  const declared = schema ?? fallbackSchemaFor(gameId);

  return declared.flatMap((definition) => {
    const key = definition.key;
    const setting = entries.find((entry) => entry.key === key);
    const rawValue = setting?.value ?? definition.defaultValue;
    const optionLabel = definition.options.find((option) => option.value === rawValue)?.label;
    return [{
      key,
      value: optionLabel ?? rawValue,
      // Labels belong to the installed schema; persisted values cannot rename
      // a setting on a display-only surface.
      label: definition.label ?? SETUP_LABELS[key],
    }];
  });
}

function fallbackSchemaFor(gameId: string): GameSettingsSchema {
  if (gameId === 'trivia') {
    return [{
      key: 'questions',
      label: 'Questions',
      options: [{ value: '5', label: '5' }, { value: '10', label: '10' }],
      defaultValue: '10',
    }];
  }
  if (gameId === 'voting') {
    return [{
      key: 'rounds',
      label: 'Rounds',
      options: [{ value: '3', label: '3' }, { value: '5', label: '5' }],
      defaultValue: '3',
    }];
  }
  return [];
}

export type TvReadinessInput = {
  readonly gameId: string;
  readonly stage?: 'configuring' | 'ready';
  readonly players: readonly TvGamePlayer[];
  readonly readyPlayerIds?: readonly string[];
  /** Prefer the selected module's authoritative range; the map is a legacy fallback for direct render tests. */
  readonly playerRange?: { readonly min: number; readonly max: number };
};

export type TvReadiness = {
  readonly readyCount: number;
  readonly playerCount: number;
  readonly allReady: boolean;
};

const PLAYER_RANGES: Readonly<Record<string, { readonly min: number; readonly max: number }>> = {
  trivia: { min: 2, max: 10 },
  voting: { min: 2, max: 10 },
};

/** Mirrors the server start gate without claiming that away players are ready. */
export function tvReadiness({
  gameId,
  stage,
  players,
  readyPlayerIds = [],
  playerRange,
}: TvReadinessInput): TvReadiness {
  const ready = new Set(readyPlayerIds.map(String));
  const readyCount = players.filter((player) => player.away !== true && ready.has(String(player.id))).length;
  const range = playerRange ?? PLAYER_RANGES[gameId];
  // Without an installed module range there is no authoritative start gate to
  // mirror, so fail closed rather than claiming an unknown game is playable.
  const inRange = range !== undefined && players.length >= range.min && players.length <= range.max;
  const nobodyAway = players.every((player) => player.away !== true);
  const allReady = stage === 'ready' && players.length > 0 && inRange && nobodyAway &&
    players.every((player) => ready.has(String(player.id)));

  return { readyCount, playerCount: players.length, allReady };
}

export function tvModeLabel(mode: string | undefined): string {
  if (mode === 'quick') return 'Quick';
  if (mode === 'standard') return 'Standard';
  if (mode === 'custom') return 'Custom';
  return 'Setup';
}

export function tvHostCopy(hostName: string | undefined, suffix: string): string {
  const name = hostName?.trim();
  return `${name === undefined || name.length === 0 ? 'the host' : name} ${suffix}`;
}
