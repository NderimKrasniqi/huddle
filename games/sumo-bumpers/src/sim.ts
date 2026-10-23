import type { GamePlayerId } from '@huddle/domain';
import { runDiscs, type Disc, type DiscRun } from '@huddle/physics';

import type { Aim, Point } from './types';

export const BLOB_RADIUS = 0.1;
export const PUCK_RADIUS = 0.06;
export const MAX_SPEED = 2.2;
export const PUCK_SPEED = 2.0;
export const FRICTION = 1.5;
export const RESTITUTION = 0.85;
export const SIM_STEPS = 240;
const PUCK_MASS = 0.5;
const PUCK_PREFIX = 'puck:';

export function clampAim(aim: Aim): Aim {
  const length = Math.sqrt(aim.dx * aim.dx + aim.dy * aim.dy);
  if (length <= 1) return aim;
  return { dx: aim.dx / length, dy: aim.dy / length };
}

export function stopDistance(power: number): number {
  return (power * MAX_SPEED) / FRICTION;
}

export function puckId(playerId: GamePlayerId): string {
  return `${PUCK_PREFIX}${playerId}`;
}

export function puckOwner(discId: string): GamePlayerId | undefined {
  return discId.startsWith(PUCK_PREFIX) ? discId.slice(PUCK_PREFIX.length) : undefined;
}

export function puckStart(aim: Aim, arenaRadius: number): Point | undefined {
  const length = Math.sqrt(aim.dx * aim.dx + aim.dy * aim.dy);
  if (length === 0) return undefined;
  return { x: (aim.dx / length) * arenaRadius, y: (aim.dy / length) * arenaRadius };
}

export function simulateRound(
  start: Readonly<Record<GamePlayerId, Point>>,
  aims: Readonly<Record<GamePlayerId, Aim>>,
  arenaRadius: number,
): DiscRun {
  const discs: Disc[] = [];
  for (const [id, point] of Object.entries(start)) {
    const aim = clampAim(aims[id] ?? { dx: 0, dy: 0 });
    discs.push({ id, x: point.x, y: point.y, vx: aim.dx * MAX_SPEED, vy: aim.dy * MAX_SPEED, radius: BLOB_RADIUS, mass: 1 });
  }
  for (const [id, raw] of Object.entries(aims)) {
    if (start[id] !== undefined) continue;
    const aim = clampAim(raw);
    const from = puckStart(aim, arenaRadius);
    if (from === undefined) continue;
    discs.push({ id: puckId(id), x: from.x, y: from.y, vx: -aim.dx * PUCK_SPEED, vy: -aim.dy * PUCK_SPEED, radius: PUCK_RADIUS, mass: PUCK_MASS });
  }
  return runDiscs({ friction: FRICTION, restitution: RESTITUTION, discs }, SIM_STEPS);
}

export function isOut(point: Point, arenaRadius: number): boolean {
  return point.x * point.x + point.y * point.y > arenaRadius * arenaRadius;
}
