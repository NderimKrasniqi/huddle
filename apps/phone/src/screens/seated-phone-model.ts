import { readiness, type GameSettingsMode, type GameSetupStage } from '@huddle/domain';

type SetupReadinessInput = {
  readonly stage: GameSetupStage;
  readonly playerRange: { readonly min: number; readonly max: number };
  readonly roster: readonly { readonly playerId: string; readonly away: boolean }[];
  readonly readyPlayerIds: readonly string[];
  readonly playerId: string;
};

type SetupReadiness = {
  readonly allPresent: boolean;
  readonly allReady: boolean;
  readonly canStart: boolean;
  readonly readyCount: number;
  readonly currentReady: boolean;
};

export function setupReadiness({
  stage,
  playerRange,
  roster,
  readyPlayerIds,
  playerId,
}: SetupReadinessInput): SetupReadiness {
  const gate = readiness({ stage, seats: roster, readyPlayerIds, playerRange });

  return {
    allPresent: gate.inRange && gate.allPresent,
    allReady: gate.allReady,
    canStart: gate.complete,
    readyCount: gate.readyCount,
    currentReady: readyPlayerIds.includes(playerId),
  };
}

type PickerControlInput = {
  readonly youAreHost: boolean;
  readonly busy: boolean;
};

type PickerControlState = {
  readonly cardAction: 'browse' | null;
  readonly selectEnabled: boolean;
  readonly guestWaiting: boolean;
};

export function pickerControlState({
  youAreHost,
  busy,
}: PickerControlInput): PickerControlState {
  const interactive = youAreHost && !busy;

  return {
    cardAction: interactive ? 'browse' : null,
    selectEnabled: interactive,
    guestWaiting: !youAreHost,
  };
}

type PickerVisibilityInput = {
  readonly youAreHost: boolean;
  readonly pickerOpen: boolean;
  readonly browsingAt: number | null | undefined;
  readonly hasSetup: boolean;
};

export function pickerVisibility({
  youAreHost,
  pickerOpen,
  browsingAt,
  hasSetup,
}: PickerVisibilityInput): boolean {
  return hasSetup || browsingAt !== null && browsingAt !== undefined || youAreHost && pickerOpen;
}

export function setupModeLabel(mode: GameSettingsMode): string {
  return mode.slice(0, 1).toUpperCase() + mode.slice(1);
}
