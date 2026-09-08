import type { GameSettingsMode } from '@huddle/domain';

export type SetupReadinessInput = {
  readonly stage: 'configuring' | 'ready';
  readonly playerRange: { readonly min: number; readonly max: number };
  readonly roster: readonly { readonly playerId: string; readonly away: boolean }[];
  readonly readyPlayerIds: readonly string[];
  readonly playerId: string;
};

export type SetupReadiness = {
  readonly allPresent: boolean;
  readonly allReady: boolean;
  readonly canStart: boolean;
  readonly readyCount: number;
  readonly currentReady: boolean;
};

/**
 * The local readiness preview shown by the Phone before `startGame` validates
 * the same facts atomically. It keeps Host and guest copies of the setup
 * screen aligned while the server remains the authority against races.
 */
export function setupReadiness({
  stage,
  playerRange,
  roster,
  readyPlayerIds,
  playerId,
}: SetupReadinessInput): SetupReadiness {
  const allPresent = roster.length >= playerRange.min
    && roster.length <= playerRange.max
    && roster.every((seat) => !seat.away);
  const allReady = roster.length > 0 && roster.every((seat) => readyPlayerIds.includes(seat.playerId));

  return {
    allPresent,
    allReady,
    canStart: stage === 'ready' && allPresent && allReady,
    readyCount: roster.filter((seat) => readyPlayerIds.includes(seat.playerId)).length,
    currentReady: readyPlayerIds.includes(playerId),
  };
}

export type PickerControlInput = {
  readonly youAreHost: boolean;
  readonly focusedPlaceholder: boolean;
  readonly busy: boolean;
};

export type PickerControlState = {
  /** A card tap only moves the shared browse index. */
  readonly cardAction: 'browse' | null;
  /** Selecting the focused installed card is a separate action. */
  readonly selectEnabled: boolean;
  readonly guestWaiting: boolean;
};

/** Capabilities for the shared picker, including the guest's passive view. */
export function pickerControlState({
  youAreHost,
  focusedPlaceholder,
  busy,
}: PickerControlInput): PickerControlState {
  const interactive = youAreHost && !busy;

  return {
    cardAction: interactive ? 'browse' : null,
    selectEnabled: interactive && !focusedPlaceholder,
    guestWaiting: !youAreHost,
  };
}

export type PickerVisibilityInput = {
  readonly youAreHost: boolean;
  /** Local optimism while the Host's first browse mutation is settling. */
  readonly pickerOpen: boolean;
  /** Shared room index; once present, the picker is the room's pre-game state. */
  readonly browsingAt: number | null | undefined;
  readonly hasSetup: boolean;
};

/**
 * Whether a lobby should remain on the shared picker. A browse index has no
 * clearing mutation, so a local Back action must not put only one phone back in
 * a room view while every other client remains on the carousel.
 */
export function pickerVisibility({
  youAreHost,
  pickerOpen,
  browsingAt,
  hasSetup,
}: PickerVisibilityInput): boolean {
  return hasSetup || browsingAt !== null && browsingAt !== undefined || youAreHost && pickerOpen;
}

/** Keeps setup mode labels available to pure render seams without guessing a game. */
export function setupModeLabel(mode: GameSettingsMode): string {
  return mode.slice(0, 1).toUpperCase() + mode.slice(1);
}
