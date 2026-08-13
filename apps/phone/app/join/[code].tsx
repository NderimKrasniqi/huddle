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
 * The phone's own camera opens the link; the Phone never asks for a camera
 * of its own, which is a permission prompt Huddle does not have to spend.
 */
export { default } from '../../src/screens/phone-screen';
