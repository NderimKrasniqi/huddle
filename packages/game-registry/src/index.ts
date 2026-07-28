// The Registry: what the hub renders instead of knowing any game by name.
//
// The rules-only view the Convex server reads is `@huddle/game-registry/logic`,
// kept separate so that a server never imports a game's screens — see `./logic`.
export { GAME_REGISTRY } from './registry';
