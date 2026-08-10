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
import type * as lib_gameClock from "../lib/gameClock.js";
import type * as lib_gameRuntime from "../lib/gameRuntime.js";
import type * as lib_presence from "../lib/presence.js";
import type * as lib_roomLifecycle from "../lib/roomLifecycle.js";
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
  "lib/gameClock": typeof lib_gameClock;
  "lib/gameRuntime": typeof lib_gameRuntime;
  "lib/presence": typeof lib_presence;
  "lib/roomLifecycle": typeof lib_roomLifecycle;
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
