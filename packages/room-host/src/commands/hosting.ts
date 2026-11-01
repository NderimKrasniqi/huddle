import { Refusal } from '../refusal';
import type { CommandTable, RoomCore } from '../core';

export function hostingCommands(core: RoomCore): Pick<CommandTable, 'transferHost' | 'removePlayer'> {
  return {
    transferHost: (connection, { playerId }) => {
      const actor = core.requireHost(connection, 'hostCommand');
      const target = core.targetSeat(actor, playerId);
      if (!core.beating(target)) throw new Refusal({ kind: 'targetAway' });
      core.room.hostPlayerId = target.playerId;
      return null;
    },

    removePlayer: (connection, { playerId }) => {
      const actor = core.requireHost(connection, 'hostCommand');
      const target = core.targetSeat(actor, playerId);
      core.room.seats = core.room.seats.filter((seat) => seat.playerId !== target.playerId);
      core.unseatConnections(target.playerId, 'removed');
      core.dropReady(target.playerId);
      core.reconcileCountdown();
      core.resumeWhenEveryoneReturns();
      return null;
    },
  };
}
