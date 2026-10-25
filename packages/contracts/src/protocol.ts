import { z } from 'zod';

import { AVATAR_IDS } from './avatar';
import type { HostControlRejection } from './host-control-rejection';
import type { JoinRejection } from './join-rejection';
import {
  GAME_SETUP_MODES,
  type GameLifecycleRejection,
  type GameSetupRejection,
  type RateLimitRejection,
} from './room-contracts';

/**
 * The Room Protocol: what a phone and the TV's room host say to each other
 * over any transport (ADR-01, ADR-02). The TV is always the host, so the
 * protocol only runs between a phone and the host; the TV's own screens read
 * the host in-process.
 *
 * A connection opens with `hello` and `welcome`. It is anonymous until
 * `joinRoom` or `resumeSession` binds it to one seat, and every later command
 * acts as that seat — which is why no command carries a Session Token. Command
 * and view names are the room's own actions and projections. Presence is the transport's `ping`, so there is no heartbeat
 * command.
 *
 * Bump `PROTOCOL_VERSION` for any change an older peer would misread. A host
 * answers a different version with `incompatible` and closes, and the phone
 * shows "Update Huddle".
 */
export const PROTOCOL_VERSION = 1;

/** Largest frame either side accepts, in UTF-16 code units of the raw text. */
export const MAX_FRAME_LENGTH = 256 * 1024;

const id = z.string().min(1).max(64);
const text = z.string().max(256);
const avatar = z.enum(AVATAR_IDS);
const mode = z.enum(GAME_SETUP_MODES);
const settings = z.record(z.string().max(64), z.string().max(64));

// ---------------------------------------------------------------- commands

const noArgs = z.object({});

/** Every command's arguments, by command name. */
export const COMMAND_ARGS = {
  joinAvailability: z.object({ code: text }),
  previewSeat: z.object({ code: text, previewKey: text, nickname: text, avatar: text }),
  clearSeatPreview: z.object({ previewKey: text }),
  joinRoom: z.object({ code: text, nickname: text, avatar: text, guestId: text.optional() }),
  resumeSession: z.object({ sessionToken: text }),
  leaveRoom: noArgs,
  transferHost: z.object({ playerId: id }),
  removePlayer: z.object({ playerId: id }),
  browseGame: z.object({ index: z.number().int() }),
  selectGame: z.object({ gameId: id, mode: mode.optional() }),
  configureGame: z.object({ gameId: id.optional(), settings, mode: mode.optional() }),
  finalizeGameSetup: noArgs,
  setGameReady: z.object({ ready: z.boolean() }),
  reopenGameSetup: noArgs,
  cancelGameSetup: noArgs,
  startGame: z.object({ gameId: id.optional(), settings: settings.optional(), mode: mode.optional() }),
  startCountdown: noArgs,
  stopCountdown: noArgs,
  endGame: noArgs,
  continueAfterDisconnect: noArgs,
  sendEvent: z.object({ event: z.unknown() }),
} as const;

export type CommandName = keyof typeof COMMAND_ARGS;
export type CommandArgs<Name extends CommandName> = z.infer<(typeof COMMAND_ARGS)[Name]>;

/** Commands a connection may send before it holds a seat. */
export const ANONYMOUS_COMMANDS: ReadonlySet<CommandName> = new Set([
  'joinAvailability',
  'previewSeat',
  'clearSeatPreview',
  'joinRoom',
  'resumeSession',
]);

// ------------------------------------------------------------------- views

const session = z.object({
  playerId: id,
  roomId: id,
  code: z.string(),
  nickname: z.string(),
  avatar,
});

const seatedSession = session.extend({ sessionToken: z.string() });

/** Every view's value, by view name. A host pushes a view whenever it changes. */
export const VIEW_VALUES = {
  session: session.nullable(),
  roster: z.array(
    z.object({ playerId: id, nickname: z.string(), away: z.boolean(), host: z.boolean(), avatar }),
  ),
  setup: z
    .object({
      gameId: id,
      settings,
      mode,
      stage: z.enum(['configuring', 'ready', 'countdown']),
      readyPlayerIds: z.array(id),
      /** Milliseconds left on the countdown when the host sent this view. */
      countdownRemainingMs: z.number().nonnegative().optional(),
    })
    .nullable(),
  browsing: z.number().int().nullable(),
  running: z
    .discriminatedUnion('kind', [
      z.object({
        kind: z.literal('running'),
        gameId: id,
        state: z.unknown(),
        settings: settings.optional(),
        mode: mode.optional(),
        clockRemainingMs: z.number().nonnegative().optional(),
      }),
      z.object({
        kind: z.literal('paused'),
        gameId: id,
        reason: z.enum(['tvDisconnected', 'playerDisconnected']),
      }),
      z.object({ kind: z.literal('unavailable'), gameId: id }),
    ])
    .nullable(),
  connection: z.object({ away: z.boolean() }).nullable(),
  /** Seats being typed on join forms; only the TV's own screens read these. */
  arrivals: z.array(z.object({ previewId: id, nickname: z.string(), avatar })),
} as const;

export type ViewName = keyof typeof VIEW_VALUES;
export type ViewValue<Name extends ViewName> = z.infer<(typeof VIEW_VALUES)[Name]>;

/** The views a seated phone receives; `arrivals` stays on the TV. */
export const PHONE_VIEWS: readonly ViewName[] = ['session', 'roster', 'setup', 'browsing', 'running', 'connection'];

// ----------------------------------------------------------------- results

/** What a successful command returns; commands not listed return `null`. */
export const COMMAND_RESULTS = {
  joinAvailability: z.object({ full: z.boolean(), takenAvatarIds: z.array(avatar) }).nullable(),
  joinRoom: seatedSession,
  resumeSession: session.nullable(),
} as const satisfies Partial<Record<CommandName, z.ZodType>>;

export type CommandResult<Name extends CommandName> = Name extends keyof typeof COMMAND_RESULTS
  ? z.infer<(typeof COMMAND_RESULTS)[Name]>
  : null;

/** Protocol-level refusals, beside the room's own rejection unions. */
export type ProtocolRejection =
  | { readonly kind: 'badMessage' }
  | { readonly kind: 'notJoined' }
  | { readonly kind: 'sessionNotFound' }
  /** The game's own code failed to deal or decode its opening state. */
  | { readonly kind: 'gameUnavailable'; readonly gameId: string }
  /** The host hit an unexpected error; the command changed nothing. */
  | { readonly kind: 'hostError' };

export type RoomRejection =
  | ProtocolRejection
  | JoinRejection
  | HostControlRejection
  | GameLifecycleRejection
  | GameSetupRejection
  | RateLimitRejection;

/**
 * A command the room refused, as every room client throws it, whatever the
 * transport. Code that shows refusals reads `rejection.kind`, never a message.
 */
export class RoomRefusal extends Error {
  constructor(readonly rejection: RoomRejection) {
    super(`Room refused the command: ${rejection.kind}`);
    this.name = 'RoomRefusal';
  }
}

/** The rejection a room client threw, or `undefined` for any other failure. */
export function refusalOf(error: unknown): RoomRejection | undefined {
  return error instanceof RoomRefusal ? error.rejection : undefined;
}

/**
 * A rejection is checked for shape only. Its `kind` is matched against the
 * unions above by the code that shows it, which already handles a kind it
 * does not know.
 */
const rejection = z.looseObject({ kind: z.string().max(64) });

// ---------------------------------------------------------------- messages

const commandMessage = z.object({
  type: z.literal('command'),
  /** Chosen by the phone; the host echoes it on the result. */
  requestId: z.number().int().nonnegative(),
  name: z.enum(Object.keys(COMMAND_ARGS) as [CommandName, ...CommandName[]]),
  args: z.unknown(),
});

const clientMessage = z.discriminatedUnion('type', [
  z.object({ type: z.literal('hello'), protocol: z.number().int(), appVersion: z.string().max(32).optional() }),
  commandMessage,
  z.object({ type: z.literal('ping'), sentAt: z.number() }),
]);

const hostMessage = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('welcome'),
    protocol: z.number().int(),
    tvInstanceId: id,
    roomCode: z.string(),
  }),
  z.object({ type: z.literal('incompatible'), protocol: z.number().int() }),
  z.discriminatedUnion('ok', [
    z.object({ type: z.literal('result'), requestId: z.number().int(), ok: z.literal(true), value: z.unknown() }),
    z.object({ type: z.literal('result'), requestId: z.number().int(), ok: z.literal(false), rejection }),
  ]),
  z.object({ type: z.literal('view'), name: z.enum(Object.keys(VIEW_VALUES) as [ViewName, ...ViewName[]]), value: z.unknown() }),
  z.object({ type: z.literal('pong'), sentAt: z.number() }),
  z.object({ type: z.literal('closed'), reason: z.enum(['roomClosed', 'removed', 'replaced']) }),
]);

export type ClientMessage =
  | { readonly type: 'hello'; readonly protocol: number; readonly appVersion?: string }
  | {
      readonly [Name in CommandName]: {
        readonly type: 'command';
        readonly requestId: number;
        readonly name: Name;
        readonly args: CommandArgs<Name>;
      };
    }[CommandName]
  | { readonly type: 'ping'; readonly sentAt: number };

export type HostMessage =
  | { readonly type: 'welcome'; readonly protocol: number; readonly tvInstanceId: string; readonly roomCode: string }
  | { readonly type: 'incompatible'; readonly protocol: number }
  | { readonly type: 'result'; readonly requestId: number; readonly ok: true; readonly value: unknown }
  | { readonly type: 'result'; readonly requestId: number; readonly ok: false; readonly rejection: RoomRejection }
  | {
      readonly [Name in ViewName]: { readonly type: 'view'; readonly name: Name; readonly value: ViewValue<Name> };
    }[ViewName]
  | { readonly type: 'pong'; readonly sentAt: number }
  | { readonly type: 'closed'; readonly reason: 'roomClosed' | 'removed' | 'replaced' };

export type Decoded<Message> =
  | { readonly ok: true; readonly message: Message }
  | { readonly ok: false; readonly rejection: { readonly kind: 'badMessage' } };

const BAD_MESSAGE = { ok: false, rejection: { kind: 'badMessage' } } as const;

function parseFrame(raw: string): unknown {
  if (raw.length > MAX_FRAME_LENGTH) return undefined;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}

/** Decodes a frame from a phone, including the command's own arguments. */
export function decodeClientMessage(raw: string): Decoded<ClientMessage> {
  const parsed = clientMessage.safeParse(parseFrame(raw));
  if (!parsed.success) return BAD_MESSAGE;
  const message = parsed.data;
  if (message.type !== 'command') return { ok: true, message };
  const args = COMMAND_ARGS[message.name].safeParse(message.args);
  if (!args.success) return BAD_MESSAGE;
  return { ok: true, message: { ...message, args: args.data } as ClientMessage };
}

/** Decodes a frame from the host, including a view's value. */
export function decodeHostMessage(raw: string): Decoded<HostMessage> {
  const parsed = hostMessage.safeParse(parseFrame(raw));
  if (!parsed.success) return BAD_MESSAGE;
  const message = parsed.data;
  if (message.type !== 'view') return { ok: true, message: message as HostMessage };
  const value = VIEW_VALUES[message.name].safeParse(message.value);
  if (!value.success) return BAD_MESSAGE;
  return { ok: true, message: { ...message, value: value.data } as HostMessage };
}

/** Checks a successful command's value against what that command returns. */
export function decodeCommandResult<Name extends CommandName>(
  name: Name,
  value: unknown,
): CommandResult<Name> | undefined {
  const schema: z.ZodType | undefined = (COMMAND_RESULTS as Partial<Record<CommandName, z.ZodType>>)[name];
  if (schema === undefined) return (value === null ? null : undefined) as CommandResult<Name> | undefined;
  const parsed = schema.safeParse(value);
  return parsed.success ? (parsed.data as CommandResult<Name>) : undefined;
}

export function encodeMessage(message: ClientMessage | HostMessage): string {
  return JSON.stringify(message);
}
