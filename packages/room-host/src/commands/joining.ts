import { generateSessionToken, isAvatarId, isGuestId, NICKNAME_MAX_LENGTH, normalizeRoomCode, ROOM_CODE_LENGTH, ROOM_PLAYER_CAP } from '@huddle/domain';

import { Refusal } from '../refusal';
import type { Seat } from '../state';
import { sessionOf } from '../views';
import type { CommandTable, HostCore } from '../core';

export function joiningCommands(core: HostCore): Pick<CommandTable, 'joinAvailability' | 'previewSeat' | 'clearSeatPreview' | 'joinRoom' | 'resumeSession' | 'leaveRoom'> {
  return {
    joinAvailability: (connection, { code }) => {
      const normalized = normalizeRoomCode(code);
      if (normalized.length !== ROOM_CODE_LENGTH || normalized !== core.room.code) return null;
      connection.watchingAvailability = true;
      return {
        full: core.room.seats.length >= ROOM_PLAYER_CAP,
        takenAvatarIds: core.room.seats.map((seat) => seat.avatar),
      };
    },

    previewSeat: (_connection, args) => {
      const code = normalizeRoomCode(args.code);
      if (code !== core.room.code || !isGuestId(args.previewKey) || !isAvatarId(args.avatar)) return null;
      core.limiter.consume('seatPreviewRoom', core.room.roomId);
      core.limiter.consume('seatPreviewKey', args.previewKey);
      const nickname = Array.from(args.nickname.trim()).slice(0, NICKNAME_MAX_LENGTH).join('');
      const now = core.ports.now();
      const existing = core.room.previews.find((preview) => preview.previewKey === args.previewKey);
      if (existing === undefined) {
        const held = new Set(core.room.seats.map((seat) => seat.avatar));
        const shown = core.room.previews.filter((preview) => !held.has(preview.avatar)).length;
        if (core.room.seats.length + shown >= ROOM_PLAYER_CAP) return null;
        core.room.previews.push({ previewId: core.newId('preview'), previewKey: args.previewKey, nickname, avatar: args.avatar, updatedAt: now });
        return null;
      }
      existing.nickname = nickname;
      existing.avatar = args.avatar;
      existing.updatedAt = now;
      return null;
    },

    clearSeatPreview: (_connection, { previewKey }) => {
      core.room.previews = core.room.previews.filter((preview) => preview.previewKey !== previewKey);
      return null;
    },

    joinRoom: (connection, args) => {
      const code = normalizeRoomCode(args.code);
      const nickname = args.nickname.trim();
      if (nickname === '' || [...nickname].length > NICKNAME_MAX_LENGTH) {
        throw new Refusal({ kind: 'nameUnusable', maxLength: NICKNAME_MAX_LENGTH });
      }
      if (!isAvatarId(args.avatar)) throw new Refusal({ kind: 'avatarUnknown', avatar: args.avatar });
      if (args.guestId !== undefined && !isGuestId(args.guestId)) throw new Refusal({ kind: 'guestIdInvalid' });
      if (code !== core.room.code) throw new Refusal({ kind: 'roomNotFound', code });
      core.limiter.consume('joinGlobal', 'global');
      core.limiter.consume('joinRoom', core.room.roomId);
      core.limiter.consume('joinGuest', args.guestId ?? 'legacy-clients');
      const seats = core.room.seats;
      if (seats.length >= ROOM_PLAYER_CAP) throw new Refusal({ kind: 'roomFull', cap: ROOM_PLAYER_CAP });
      if (seats.some((seat) => seat.nickname.trim().toLowerCase() === nickname.toLowerCase())) {
        throw new Refusal({ kind: 'nameTaken', nickname });
      }
      if (seats.some((seat) => seat.avatar === args.avatar)) throw new Refusal({ kind: 'avatarTaken', avatar: args.avatar });

      const seat: Seat = {
        playerId: core.newId('player'),
        nickname,
        sessionToken: generateSessionToken(core.ports.random),
        lastSeenAt: core.ports.now(),
        away: false,
        avatar: args.avatar,
        ...(args.guestId === undefined ? {} : { guestId: args.guestId }),
      };
      seats.push(seat);
      if (core.needsHost()) core.room.hostPlayerId = seat.playerId;
      core.reconcileCountdown();
      core.bind(connection, seat.playerId);
      return {
        playerId: seat.playerId,
        roomId: core.room.roomId,
        code: core.room.code,
        nickname,
        avatar: seat.avatar,
        sessionToken: seat.sessionToken,
      };
    },

    resumeSession: (connection, { sessionToken }) => {
      const seat = core.room.seats.find((candidate) => candidate.sessionToken === sessionToken);
      if (seat === undefined) return null;
      core.bind(connection, seat.playerId);
      core.touch(seat);
      return sessionOf(core.room, seat);
    },

    leaveRoom: (connection) => {
      const seat = core.requireSeat(connection);
      core.limiter.consume('memberCommand', seat.playerId);
      core.handOverRoom(seat, true);
      core.room.seats = core.room.seats.filter((candidate) => candidate.playerId !== seat.playerId);
      core.unseatConnections(seat.playerId, undefined);
      if (core.room.seats.length > 0) {
        core.dropReady(seat.playerId);
        core.reconcileCountdown();
        core.resumeWhenEveryoneReturns();
        return null;
      }
      core.stopGameClock();
      core.cancelCountdownTimer();
      core.room.hostPlayerId = undefined;
      core.room.game = undefined;
      core.room.setup = undefined;
      core.room.browsingGameIndex = undefined;
      return null;
    },
  };
}
