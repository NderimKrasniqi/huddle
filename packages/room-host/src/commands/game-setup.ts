import { COUNTDOWN_MS, settingsFrom, settingsRefusalForMode } from '@huddle/domain';
import { browsingIndex, GAME_LOGIC_REGISTRY, gameLogicById } from '@huddle/game-registry/logic';

import { Refusal } from '../refusal';
import { setupForGame, withoutCountdown } from '../setup';
import type { CommandTable, RoomCore } from '../core';

export function gameSetupCommands(core: RoomCore): Pick<CommandTable, 'browseGame' | 'selectGame' | 'configureGame' | 'finalizeGameSetup' | 'setGameReady' | 'reopenGameSetup' | 'cancelGameSetup' | 'startGame' | 'startCountdown' | 'stopCountdown'> {
  return {
    browseGame: (connection, { index }) => {
      core.requireHost(connection, 'hostCommand');
      if (core.room.tvAway) return null;
      core.room.browsingGameIndex = browsingIndex(index);
      return null;
    },

    selectGame: (connection, args) => {
      core.requireHost(connection, 'hostCommand');
      if (core.room.game !== undefined) throw new Refusal({ kind: 'setupAlreadyRunning' });
      const selected = setupForGame(args.gameId, args.mode, undefined);
      const index = GAME_LOGIC_REGISTRY.findIndex((entry) => entry.metadata.id === args.gameId);
      core.cancelCountdownTimer();
      core.room.setup = { gameId: args.gameId, settings: selected.settings, mode: selected.mode, stage: 'configuring', readyPlayerIds: [] };
      if (index >= 0) core.room.browsingGameIndex = browsingIndex(index);
      return null;
    },

    configureGame: (connection, args) => {
      core.requireHost(connection, 'hostCommand');
      if (core.room.game !== undefined) throw new Refusal({ kind: 'setupAlreadyRunning' });
      const setup = core.room.setup;
      const gameId = args.gameId ?? setup?.gameId;
      if (gameId === undefined) throw new Refusal({ kind: 'setupNotFound' });
      if (setup?.stage === 'ready' || setup?.stage === 'countdown') throw new Refusal({ kind: 'setupLocked' });
      const game = gameLogicById(gameId);
      if (game === undefined) throw new Refusal({ kind: 'gameNotInstalled', gameId });
      const merged = { ...setup?.settings, ...args.settings };
      const mode = args.mode ?? setup?.mode ?? 'custom';
      const refusal = settingsRefusalForMode(game.settingsSchema, game.settingsPresentation, merged, mode);
      if (refusal !== null) throw new Refusal(refusal);
      core.room.setup = { gameId, settings: settingsFrom(game.settingsSchema, merged), mode, stage: 'configuring', readyPlayerIds: [] };
      return null;
    },

    finalizeGameSetup: (connection) => {
      const host = core.requireHost(connection, 'hostCommand');
      const setup = core.room.setup;
      if (setup === undefined) throw new Refusal({ kind: 'setupNotFound' });
      setupForGame(setup.gameId, setup.mode, setup.settings);
      core.cancelCountdownTimer();
      core.room.setup = { ...withoutCountdown(setup), stage: 'ready', readyPlayerIds: [host.playerId] };
      return null;
    },

    setGameReady: (connection, { ready }) => {
      const seat = core.requireSeat(connection);
      core.limiter.consume('memberCommand', seat.playerId);
      const setup = core.room.setup;
      if (setup === undefined) throw new Refusal({ kind: 'setupNotFound' });
      if (setup.stage !== 'ready' && setup.stage !== 'countdown') throw new Refusal({ kind: 'setupNotReady' });
      const current = setup.readyPlayerIds;
      const readyPlayerIds = ready
        ? current.includes(seat.playerId) ? current : [...current, seat.playerId]
        : current.filter((playerId) => playerId !== seat.playerId);
      core.room.setup = { ...setup, readyPlayerIds };
      core.reconcileCountdown();
      return null;
    },

    reopenGameSetup: (connection) => {
      core.requireHost(connection, 'hostCommand');
      const setup = core.room.setup;
      if (setup === undefined) throw new Refusal({ kind: 'setupNotFound' });
      core.cancelCountdownTimer();
      core.room.setup = { ...withoutCountdown(setup), stage: 'configuring', readyPlayerIds: [] };
      return null;
    },

    cancelGameSetup: (connection) => {
      core.requireHost(connection, 'hostCommand');
      if (core.room.game === undefined) {
        core.cancelCountdownTimer();
        core.room.setup = undefined;
        core.room.browsingGameIndex = undefined;
      }
      return null;
    },

    startGame: (connection, args) => {
      core.requireHost(connection, 'hostCommand');
      core.startFromSetup(args);
      return null;
    },

    startCountdown: (connection) => {
      core.requireHost(connection, 'hostCommand');
      const setup = core.room.setup;
      if (setup?.stage === 'countdown') return null;
      core.validatedStart({});
      const endsAt = core.ports.now() + COUNTDOWN_MS;
      core.room.setup = { ...setup!, stage: 'countdown', countdownEndsAt: endsAt };
      core.armCountdown(endsAt, COUNTDOWN_MS);
      return null;
    },

    stopCountdown: (connection) => {
      core.requireHost(connection, 'hostCommand');
      const setup = core.room.setup;
      if (setup?.stage !== 'countdown') return null;
      core.cancelCountdownTimer();
      core.room.setup = withoutCountdown(setup);
      return null;
    },
  };
}
