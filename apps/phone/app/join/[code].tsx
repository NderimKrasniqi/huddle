/**
 * Where a scanned Join Link lands: `huddle://join/KWRD` (see
 * `roomJoinLink` in game-core), which expo-router resolves to this file with
 * `KWRD` as the `code` param.
 *
 * It is the join screen itself rather than a screen of its own, because a
 * scanned join is not a different errand — it is the same screen arriving with
 * one of its two fields already answered. The screen reads `code` off
 * `useLocalSearchParams` either way, so the only thing this route adds is the
 * path the QR points at, and the name field takes the focus the code tiles
 * would have had.
 *
 * A phone can arrive here from the in-app QR scanner or an external camera.
 * Either way, the code is only a prefilled field; identity is still chosen on
 * the Join Room surface before the authoritative join mutation runs.
 */
export { default } from '../../src/screens/phone-screen';
