// The React Native half of the Boardwalk design system, kept behind its own
// entry point (`@huddle/ui/native`) so the token half stays plain TypeScript.
// That separation is what lets the tokens — and the guard that enforces them —
// run under Node with no renderer, which is why `react-native` is a peer
// dependency here rather than a dependency of the package.
export { StickerSurface, type StickerSurfaceProps } from './sticker-surface';
