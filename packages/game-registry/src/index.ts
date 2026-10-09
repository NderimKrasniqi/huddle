// The Registry: what the hub renders instead of knowing any game by name.
//
// The rules-only view the Convex server reads is `@huddle/game-registry/logic`,
// kept separate so that a server never imports a game's screens — see `./logic`.
// The carousel the Host browses and the TV follows: an index into the ordered
// Registry, so "the third card" means the same thing on both.
export {
  browsingIndex,
  type CarouselWindow,
  carouselWindow,
  nextIndex,
  previousIndex,
} from './carousel';
export { GAME_REGISTRY } from './registry';
// What a client draws for the room's running game — the client-side half of
// rendering purely from the Registry.
export {
  gameModuleById,
  type RunningGameScreen,
  type RunningGameResponse,
  runningGameScreen,
} from './running';
