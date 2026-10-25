export type Disc = {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
  readonly radius: number;
  readonly mass: number;
  readonly lastTouchedBy?: string;
};

export type DiscWorld = {
  readonly discs: readonly Disc[];
  readonly friction: number;
  readonly restitution: number;
};

export type DiscFrame = Readonly<Record<string, { readonly x: number; readonly y: number }>>;

export type DiscRun = {
  readonly frames: readonly DiscFrame[];
  readonly final: readonly Disc[];
};

export const STEP_SECONDS = 1 / 60;
const REST_SPEED = 0.002;

type Mutable = { id: string; x: number; y: number; vx: number; vy: number; radius: number; mass: number; lastTouchedBy?: string };

function settle(discs: readonly Mutable[], restitution: number): void {
  for (let i = 0; i < discs.length; i += 1) {
    for (let j = i + 1; j < discs.length; j += 1) {
      const a = discs[i]!;
      const b = discs[j]!;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const reach = a.radius + b.radius;
      const squared = dx * dx + dy * dy;
      if (squared >= reach * reach || squared === 0) continue;
      const distance = Math.sqrt(squared);
      const nx = dx / distance;
      const ny = dy / distance;
      const overlap = reach - distance;
      const total = a.mass + b.mass;
      a.x -= nx * overlap * (b.mass / total);
      a.y -= ny * overlap * (b.mass / total);
      b.x += nx * overlap * (a.mass / total);
      b.y += ny * overlap * (a.mass / total);
      const closing = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
      if (closing <= 0) continue;
      a.lastTouchedBy = b.id;
      b.lastTouchedBy = a.id;
      const impulse = ((1 + restitution) * closing) / total;
      a.vx -= impulse * b.mass * nx;
      a.vy -= impulse * b.mass * ny;
      b.vx += impulse * a.mass * nx;
      b.vy += impulse * a.mass * ny;
    }
  }
}

export function runDiscs(world: DiscWorld, steps: number, frameEvery = 2): DiscRun {
  const discs: Mutable[] = [...world.discs].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)).map((disc) => ({ ...disc }));
  const keep = Math.max(0, 1 - world.friction * STEP_SECONDS);
  const frames: DiscFrame[] = [snapshot(discs)];
  for (let step = 1; step <= steps; step += 1) {
    for (const disc of discs) {
      disc.x += disc.vx * STEP_SECONDS;
      disc.y += disc.vy * STEP_SECONDS;
      disc.vx *= keep;
      disc.vy *= keep;
      if (disc.vx * disc.vx + disc.vy * disc.vy < REST_SPEED * REST_SPEED) {
        disc.vx = 0;
        disc.vy = 0;
      }
    }
    settle(discs, world.restitution);
    if (step % frameEvery === 0 || step === steps) frames.push(snapshot(discs));
  }
  return { frames, final: discs.map((disc) => ({ ...disc })) };
}

function snapshot(discs: readonly Mutable[]): DiscFrame {
  const frame: Record<string, { x: number; y: number }> = {};
  for (const disc of discs) frame[disc.id] = { x: disc.x, y: disc.y };
  return frame;
}
