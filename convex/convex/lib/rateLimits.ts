import { MINUTE, RateLimiter, SECOND } from '@convex-dev/rate-limiter';
import type { RateLimitOperation } from '@huddle/domain';
import { ConvexError } from 'convex/values';

import { components } from '../_generated/api';
import type { MutationCtx } from '../_generated/server';

export const RATE_LIMITS = {
  roomOpen: { kind: 'token bucket' as const, rate: 10, period: MINUTE, capacity: 20 },
  joinGlobal: { kind: 'token bucket' as const, rate: 600, period: MINUTE, capacity: 1_200 },
  joinRoom: { kind: 'token bucket' as const, rate: 120, period: MINUTE, capacity: 240 },
  joinGuest: { kind: 'token bucket' as const, rate: 60, period: MINUTE, capacity: 120 },
  memberCommand: { kind: 'token bucket' as const, rate: 180, period: MINUTE, capacity: 360 },
  hostCommand: { kind: 'token bucket' as const, rate: 120, period: MINUTE, capacity: 240 },
  tvCommand: { kind: 'token bucket' as const, rate: 120, period: MINUTE, capacity: 240 },
  gameEvent: { kind: 'token bucket' as const, rate: 30, period: SECOND, capacity: 60 },
};

const limiter = new RateLimiter(components.rateLimiter, RATE_LIMITS);

async function consume(
  ctx: MutationCtx,
  name: keyof typeof RATE_LIMITS,
  key: string,
  operation: RateLimitOperation,
): Promise<void> {
  const status = await limiter.limit(ctx, name, { key });
  if (!status.ok) {
    throw new ConvexError({ kind: 'rateLimited', operation, retryAfterMs: status.retryAfter });
  }
}

export async function limitRoomOpen(ctx: MutationCtx): Promise<void> {
  await consume(ctx, 'roomOpen', 'global', 'roomOpen');
}

export async function limitJoin(ctx: MutationCtx, roomId: string, guestId: string | undefined): Promise<void> {
  await consume(ctx, 'joinGlobal', 'global', 'joinRoom');
  await consume(ctx, 'joinRoom', roomId, 'joinRoom');
  await consume(ctx, 'joinGuest', guestId ?? 'legacy-clients', 'joinRoom');
}

export async function limitMemberCommand(ctx: MutationCtx, credential: string): Promise<void> {
  await consume(ctx, 'memberCommand', credential, 'memberCommand');
}

export async function limitHostCommand(ctx: MutationCtx, credential: string): Promise<void> {
  await consume(ctx, 'hostCommand', credential, 'hostCommand');
}

export async function limitTvCommand(ctx: MutationCtx, credential: string): Promise<void> {
  await consume(ctx, 'tvCommand', credential, 'tvCommand');
}

export async function limitGameEvent(ctx: MutationCtx, credential: string): Promise<void> {
  await consume(ctx, 'gameEvent', credential, 'gameEvent');
}
