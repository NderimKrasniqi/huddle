import type { ViewName, ViewValue } from '@huddle/contracts/protocol';
import { browsingIndex } from '@huddle/game-registry/logic';

import { decodeStoredRuntime, projectRuntime, runtimeFailure } from './game-runtime';
import type { HostPorts } from './ports';
import type { RoomState, Seat } from './state';

export type Viewer = { readonly kind: 'tv' } | { readonly kind: 'player'; readonly playerId: string };

export type TvViews = {
  readonly roomId: string;
  readonly code: string;
  readonly roster: ViewValue<'roster'>;
  readonly setup: ViewValue<'setup'>;
  readonly browsing: ViewValue<'browsing'>;
  readonly running: ViewValue<'running'>;
  readonly connection: ViewValue<'connection'>;
  readonly arrivals: ViewValue<'arrivals'>;
};

export function sessionOf(room: RoomState, seat: Seat): NonNullable<ViewValue<'session'>> {
  return { playerId: seat.playerId, roomId: room.roomId, code: room.code, nickname: seat.nickname, avatar: seat.avatar };
}

export function viewOf<Name extends ViewName>(room: RoomState, name: Name, viewer: Viewer, now: number, log: HostPorts['log']): ViewValue<Name> {
  switch (name) {
    case 'session': {
      const seat = viewer.kind === 'player' ? room.seats.find((candidate) => candidate.playerId === viewer.playerId) : undefined;
      return (seat === undefined ? null : sessionOf(room, seat)) as ViewValue<Name>;
    }
    case 'roster':
      return room.seats.map((seat) => ({
        playerId: seat.playerId,
        nickname: seat.nickname,
        away: seat.away,
        host: seat.playerId === room.hostPlayerId,
        avatar: seat.avatar,
      })) as ViewValue<Name>;
    case 'setup': {
      const setup = room.setup;
      if (setup === undefined) return null as ViewValue<Name>;
      return {
        gameId: setup.gameId,
        settings: setup.settings,
        mode: setup.mode,
        stage: setup.stage,
        readyPlayerIds: [...setup.readyPlayerIds],
        ...(setup.stage === 'countdown' && setup.countdownEndsAt !== undefined
          ? { countdownRemainingMs: Math.max(0, setup.countdownEndsAt - now) }
          : {}),
      } as ViewValue<Name>;
    }
    case 'browsing':
      return (room.browsingGameIndex === undefined ? null : browsingIndex(room.browsingGameIndex)) as ViewValue<Name>;
    case 'running':
      return runningView(room, viewer, now, log) as ViewValue<Name>;
    case 'connection':
      return { away: room.tvAway } as ViewValue<Name>;
    case 'arrivals': {
      if (viewer.kind !== 'tv') return [] as ViewValue<Name>;
      const held = new Set(room.seats.map((seat) => seat.avatar));
      return room.previews
        .filter((preview) => !held.has(preview.avatar))
        .map((preview) => ({ previewId: preview.previewId, nickname: preview.nickname, avatar: preview.avatar })) as ViewValue<Name>;
    }
    default:
      return null as ViewValue<Name>;
  }
}

function runningView(room: RoomState, viewer: Viewer, now: number, log: HostPorts['log']): ViewValue<'running'> {
  const running = room.game;
  if (running === undefined) return null;
  const runtime = decodeStoredRuntime(log, room.roomId, running);
  if (runtime === undefined) return { kind: 'unavailable', gameId: running.gameId };
  if (room.tvAway) return { kind: 'paused', gameId: running.gameId, reason: 'tvDisconnected' };
  if (running.playerPaused === true) return { kind: 'paused', gameId: running.gameId, reason: 'playerDisconnected' };
  const state = projectRuntime(runtime, viewer.kind === 'tv' ? undefined : viewer.playerId);
  if (state === undefined) {
    runtimeFailure(log, room.roomId, running, 'projection');
    return { kind: 'unavailable', gameId: running.gameId };
  }
  return {
    kind: 'running',
    gameId: running.gameId,
    state,
    ...(running.settings === undefined ? {} : { settings: running.settings }),
    ...(running.mode === undefined ? {} : { mode: running.mode }),
    ...(running.deadlineAt === undefined ? {} : { clockRemainingMs: Math.max(0, running.deadlineAt - now) }),
  };
}

export function tvViewsOf(room: RoomState, now: number, log: HostPorts['log']): TvViews {
  const tv: Viewer = { kind: 'tv' };
  return {
    roomId: room.roomId,
    code: room.code,
    roster: viewOf(room, 'roster', tv, now, log),
    setup: viewOf(room, 'setup', tv, now, log),
    browsing: viewOf(room, 'browsing', tv, now, log),
    running: viewOf(room, 'running', tv, now, log),
    connection: viewOf(room, 'connection', tv, now, log),
    arrivals: viewOf(room, 'arrivals', tv, now, log),
  };
}

export function withoutClock(value: unknown): unknown {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return value;
  const { clockRemainingMs: _clock, countdownRemainingMs: _countdown, ...rest } = value as Record<string, unknown>;
  return rest;
}
