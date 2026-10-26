import type { ReactNode } from 'react';

import type { AvatarId } from './avatar';

export type GamePlayerId = string;

export type GamePlayer = {
  readonly playerId: GamePlayerId;
  readonly nickname: string;
  readonly away: boolean;
  readonly avatar: AvatarId;
};

export type RosterSeatForGame = GamePlayer & { readonly host: boolean };

export function gamePlayersFrom(
  seats: readonly RosterSeatForGame[],
): readonly GamePlayer[] {
  return seats.map(({ playerId, nickname, away, avatar }) => ({
    playerId,
    nickname,
    away,
    avatar,
  }));
}

export type GameEvent = {
  readonly playerId?: GamePlayerId;
  readonly msRemaining?: number;
  readonly awayPlayerIds?: readonly GamePlayerId[];
  readonly fromHost?: boolean;
};

export type GameDeadline<Event extends GameEvent = GameEvent> = {
  readonly beat: string;
  readonly afterMs: number;
  readonly event: Event;
};

export type PlayerRange = {
  readonly min: number;
  readonly max: number;
};

export type GameMetadata = {
  readonly id: string;
  readonly title: string;
  readonly playerRange: PlayerRange;
  readonly estimatedMinutes: number;
  readonly category: string;
  readonly tagline?: string;
};

export type GameSettingOption = {
  readonly value: string;
  readonly label: string;
  readonly short?: string;
  readonly unit?: string;
};

export const GAME_SETTING_ICONS = [
  'count',
  'difficulty',
  'timer',
  'category',
  'scoring',
  'results',
  'players',
] as const;

export type GameSettingIcon = (typeof GAME_SETTING_ICONS)[number];

export type GameSettings = Readonly<Record<string, string>>;

export type GameSetting = {
  readonly key: string;
  readonly label: string;
  readonly options: readonly GameSettingOption[];
  readonly defaultValue: string;
  readonly icon?: GameSettingIcon;
  readonly unit?: string;
};

export type GameSettingsSchema = readonly GameSetting[];

export type GameSettingsMode = 'quick' | 'standard' | 'custom';

export type GameSettingsPreset = {
  readonly mode: Exclude<GameSettingsMode, 'custom'>;
  readonly label: string;
  readonly description?: string;
  readonly settings: Readonly<Record<string, string>>;
};

export type GameSettingsPresentation = {
  readonly presets?: readonly GameSettingsPreset[];
  readonly customSettingKeys?: readonly string[];
  readonly customOptions?: Readonly<Record<string, readonly string[]>>;
};

export type FinishedSummary = {
  readonly title: string;
  readonly subtitle?: string;
  readonly standings?: readonly {
    readonly playerId: GamePlayerId;
    readonly score?: number;
    readonly rank?: number;
  }[];
};

export type GameSetup<Settings> = {
  readonly players: readonly GamePlayer[];
  readonly settings: Settings;
  readonly seed?: number;
};

export type TvGameScreenProps<State> = {
  readonly state: State;
  readonly players: readonly GamePlayer[];
  readonly clockRemainingMs?: number;
  readonly hostNickname?: string;
};

export type PhoneSafeAreaInsets = {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
};

export type PhoneGameScreenProps<State, Event extends GameEvent> = {
  readonly state: State;
  readonly player: GamePlayer;
  readonly sendEvent: (event: Event) => void;
  readonly safeAreaInsets?: PhoneSafeAreaInsets;
  readonly hostChromeInsetTop?: number;
  readonly hostChromeInsetBottom?: number;
  readonly clockRemainingMs?: number;
  readonly isHost?: boolean;
  readonly hostNickname?: string;
  readonly players?: readonly GamePlayer[];
  readonly feedback?: (kind: PhoneFeedback) => void;
};

export type PhoneFeedback = 'select' | 'success' | 'error';

export interface GameLogic<
  State = unknown,
  Event extends GameEvent = GameEvent,
  Settings = unknown,
> {
  readonly stateVersion: number;
  decodeState(value: unknown): State;
  decodeEvent(value: unknown): Event;
  readonly metadata: GameMetadata;
  readonly settingsSchema: GameSettingsSchema;
  readonly settingsPresentation?: GameSettingsPresentation;
  createInitialState(setup: GameSetup<Settings>): State;
  reduce(state: State, event: Event): State;
  deadline?(state: State): GameDeadline<Event> | undefined;
  redactStateFor(state: State, viewer: GamePlayerId | undefined): State;
  isFinished?(state: State): boolean;
  finishedSummary?(state: State): FinishedSummary;
}

export interface GameModule<State = unknown, Event extends GameEvent = GameEvent> {
  readonly metadata: GameMetadata;
  readonly settingsSchema: GameSettingsSchema;
  readonly settingsPresentation?: GameSettingsPresentation;
  finishedSummary?(state: State): FinishedSummary;
  isFinished?(state: State): boolean;
  readonly screens: {
    tv(props: TvGameScreenProps<State>): ReactNode;
    phone(props: PhoneGameScreenProps<State, Event>): ReactNode;
  };
}

export type GameRegistry = readonly GameModule[];

export type GameLogicRegistry = readonly GameLogic[];
