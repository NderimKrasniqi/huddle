import { readiness, settingOptionLabel, type AvatarId, type GameSettingIcon, type GameSettingsSchema, type GameSetupStage } from '@huddle/domain';
import { GAME_REGISTRY, gameModuleById } from '@huddle/game-registry';

export type TvGameCarouselCard = {
  readonly id: string;
  readonly title: string;
  readonly subtitle?: string;
};

/** The installed games as shelf cards, straight from the Registry. */
export const DEFAULT_TV_CAROUSEL_CARDS: readonly TvGameCarouselCard[] = GAME_REGISTRY.map((game) => ({
  id: game.metadata.id,
  title: game.metadata.title,
  subtitle: game.metadata.tagline,
}));

/** A game's display name, from the Registry; "Game" for an id this build does not have. */
export function gameTitleFor(gameId: string): string {
  return gameModuleById(gameId)?.metadata.title ?? 'Game';
}

export type TvGamePlayer = {
  readonly id: string;
  readonly name: string;
  readonly isHost?: boolean;
  readonly ready?: boolean;
  readonly away?: boolean;
  readonly avatarId?: AvatarId;
};

export type TvSetupSetting = {
  readonly key: string;
  readonly value: string;
  readonly label?: string;
  /** The picture the game declared for this setting. */
  readonly icon?: GameSettingIcon;
};

export type TvSetupSettings =
  | Readonly<Record<string, string>>
  | readonly TvSetupSetting[];

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
  const declared = schema ?? gameModuleById(gameId)?.settingsSchema ?? [];

  return declared.flatMap((definition) => {
    const key = definition.key;
    const setting = entries.find((entry) => entry.key === key);
    const rawValue = setting?.value ?? definition.defaultValue;
    return [{
      key,
      // The same words as the phone's labelled rows.
      value: settingOptionLabel(definition, rawValue),
      // Labels belong to the installed schema; persisted values cannot rename
      // a setting on a display-only surface.
      label: definition.label,
      icon: definition.icon,
    }];
  });
}

export type TvReadinessInput = {
  readonly gameId: string;
  readonly stage?: GameSetupStage;
  readonly players: readonly TvGamePlayer[];
  readonly readyPlayerIds?: readonly string[];
  /** The selected module's range; defaults to the installed game's own. */
  readonly playerRange?: { readonly min: number; readonly max: number };
};

export type TvReadiness = {
  readonly readyCount: number;
  readonly playerCount: number;
  readonly allReady: boolean;
  /** Fewest seats the game can start with, when the range is known. */
  readonly minPlayers: number | undefined;
};

/** Mirrors the server start gate without claiming that away players are ready. */
export function tvReadiness({
  gameId,
  stage,
  players,
  readyPlayerIds = [],
  playerRange,
}: TvReadinessInput): TvReadiness {
  // Without an installed module range there is no authoritative start gate to
  // mirror, so `readiness` fails closed rather than claiming an unknown game
  // is playable.
  const range = playerRange ?? gameModuleById(gameId)?.metadata.playerRange;
  const gate = readiness({
    stage: stage ?? 'configuring',
    seats: players.map((player) => ({ playerId: player.id, away: player.away === true })),
    readyPlayerIds,
    playerRange: range,
  });

  return { readyCount: gate.readyCount, playerCount: gate.seatCount, allReady: gate.complete, minPlayers: range?.min };
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
