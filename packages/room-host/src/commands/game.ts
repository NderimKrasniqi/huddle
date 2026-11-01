import type { CommandTable, RoomCore } from '../core';

export function gameCommands(core: RoomCore): Pick<CommandTable, 'endGame' | 'continueAfterDisconnect' | 'sendEvent'> {
  return {
    endGame: (connection) => {
      core.requireHost(connection, 'hostCommand');
      core.stopGameClock();
      core.cancelCountdownTimer();
      core.room.game = undefined;
      core.room.setup = undefined;
      core.room.browsingGameIndex = undefined;
      return null;
    },

    continueAfterDisconnect: (connection) => {
      core.requireHost(connection, 'hostCommand');
      const running = core.room.game;
      if (running?.playerPaused !== true) return null;
      const { playerPaused: _paused, ...continuing } = running;
      core.room.game = core.room.tvAway ? continuing : core.resumePausedGameClock(continuing);
      return null;
    },

    sendEvent: (connection, { event }) => {
      const seat = core.requireSeat(connection);
      core.limiter.consume('gameEvent', seat.playerId);
      if (core.room.tvAway || core.room.game?.playerPaused === true) return null;
      if (typeof event !== 'object' || event === null || Array.isArray(event)) return null;
      core.playGameEvent({ ...(event as object), playerId: seat.playerId });
      return null;
    },
  };
}
