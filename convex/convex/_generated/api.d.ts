/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as games from "../games.js";
import type * as lib_authorization from "../lib/authorization.js";
import type * as lib_game_clock from "../lib/game-clock.js";
import type * as lib_game_runtime from "../lib/game-runtime.js";
import type * as lib_presence from "../lib/presence.js";
import type * as lib_room_lifecycle from "../lib/room-lifecycle.js";
import type * as players from "../players.js";
import type * as rooms from "../rooms.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  games: typeof games;
  "lib/authorization": typeof lib_authorization;
  "lib/game-clock": typeof lib_game_clock;
  "lib/game-runtime": typeof lib_game_runtime;
  "lib/presence": typeof lib_presence;
  "lib/room-lifecycle": typeof lib_room_lifecycle;
  players: typeof players;
  rooms: typeof rooms;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
};
