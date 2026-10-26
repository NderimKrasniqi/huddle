import type { RateLimitOperation } from '@huddle/domain';

import { Refusal } from './refusal';

const MINUTE = 60_000;
const SECOND = 1_000;

type Bucket = { readonly rate: number; readonly period: number; readonly capacity: number };

/** The limits the retired Convex backend enforced, kept unchanged. */
const RATE_LIMITS = {
  joinGlobal: { rate: 600, period: MINUTE, capacity: 1_200 },
  joinRoom: { rate: 120, period: MINUTE, capacity: 240 },
  joinGuest: { rate: 60, period: MINUTE, capacity: 120 },
  memberCommand: { rate: 180, period: MINUTE, capacity: 360 },
  hostCommand: { rate: 120, period: MINUTE, capacity: 240 },
  gameEvent: { rate: 30, period: SECOND, capacity: 60 },
  seatPreviewRoom: { rate: 600, period: MINUTE, capacity: 300 },
  seatPreviewKey: { rate: 120, period: MINUTE, capacity: 60 },
} as const satisfies Record<string, Bucket>;

export type LimitName = keyof typeof RATE_LIMITS;

const OPERATION: Record<LimitName, RateLimitOperation> = {
  joinGlobal: 'joinRoom',
  joinRoom: 'joinRoom',
  joinGuest: 'joinRoom',
  memberCommand: 'memberCommand',
  hostCommand: 'hostCommand',
  gameEvent: 'gameEvent',
  seatPreviewRoom: 'seatPreview',
  seatPreviewKey: 'seatPreview',
};

/** In-memory token buckets, one per limit and key. */
export class RateLimiter {
  private readonly buckets = new Map<string, { tokens: number; at: number }>();
  /** Bucket states before the current command, so a refused command spends nothing. */
  private journal: Map<string, { tokens: number; at: number } | undefined> | undefined;

  constructor(private readonly now: () => number) {}

  /** Takes one token or refuses with `rateLimited`. */
  consume(name: LimitName, key: string): void {
    const limit = RATE_LIMITS[name];
    const id = `${name}:${key}`;
    const now = this.now();
    const bucket = this.buckets.get(id) ?? { tokens: limit.capacity, at: now };
    const tokens = Math.min(limit.capacity, bucket.tokens + ((now - bucket.at) * limit.rate) / limit.period);
    if (tokens < 1) {
      const retryAfterMs = Math.ceil(((1 - tokens) * limit.period) / limit.rate);
      this.remember(id);
      this.buckets.set(id, { tokens, at: now });
      throw new Refusal({ kind: 'rateLimited', operation: OPERATION[name], retryAfterMs });
    }
    this.remember(id);
    this.buckets.set(id, { tokens: tokens - 1, at: now });
  }

  /**
   * Opens a command. The retired Convex backend ran each command as one
   * transaction, so a refused command (a taken name, not the Host) cost no
   * tokens; `rollback` keeps that, `commit` keeps what a command spent.
   */
  begin(): void {
    this.journal = new Map();
  }

  commit(): void {
    this.journal = undefined;
  }

  rollback(): void {
    for (const [id, previous] of this.journal ?? []) {
      if (previous === undefined) this.buckets.delete(id);
      else this.buckets.set(id, previous);
    }
    this.journal = undefined;
  }

  private remember(id: string): void {
    if (this.journal !== undefined && !this.journal.has(id)) this.journal.set(id, this.buckets.get(id));
  }

  /** Drops buckets that have refilled completely, so keys do not pile up. */
  prune(): void {
    const now = this.now();
    for (const [id, bucket] of this.buckets) {
      const limit = RATE_LIMITS[id.slice(0, id.indexOf(':')) as LimitName];
      if (bucket.tokens + ((now - bucket.at) * limit.rate) / limit.period >= limit.capacity) this.buckets.delete(id);
    }
  }
}
