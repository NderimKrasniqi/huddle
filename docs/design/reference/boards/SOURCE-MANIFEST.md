# Huddle Approved Screen Manifest

This file records the approved Soft Minimal screen set used for the Expo phone
and TV apps.

Paths below are the repo's, relative to `docs/design/reference/`. Every screen
lives flat in `screens/` — the `phone-screens/` and `tv-screens/` prefixes this
manifest used to carry were the delivered package's directories (see
`docs/design/soft-minimal/PACKAGE-README.txt`, which is kept verbatim), and
have never existed here.

## Phone app

1. `screens/01-join-room.png` — original standalone export.
2. `screens/02-your-room-host.png` — standalone full-resolution export of the Host's room state.
3. `screens/03-manage-player-host.png` — original standalone export.
4. `screens/04-pick-a-game-host.png` — original standalone export.
5. `screens/05-waiting-player.png` — original standalone export.
6. `screens/06-game-settings-host-standard.png` — Host game-settings state with the Standard preset.
7. `screens/07-game-settings-host-quick.png` — Host game-settings state with the Quick preset.
8. `screens/08-game-settings-host-custom.png` — Host game-settings state with custom options.
9. `screens/09-game-finished-player.png` — player post-game state while waiting for the Host's next choice.
10. `screens/10-game-finished-host.png` — Host post-game results and next-action state.

The earlier “You’re in (player)” screen is intentionally not part of this final set because it was removed from the approved phone flow before the final board.

## TV app

1. `screens/01-room.png` — Room screen, combining pairing/join information with the roster and its historical 12-seat mock layout; the product cap is reconciled to 10 in the active handoff.
2. `screens/02-game-carousel.png` — Game carousel.
3. `screens/03-game-setup.png` — Trivia setup state while the Host prepares the game.

The first two were re-exported on 2026-08-09, replacing the originals. Those
originals were
1448×1086 renders of the screen inside a television mockup — bezel, stand and a
title caption around a 4:3 canvas. These are 1672×941 (16:9): the screen content
alone, at the aspect ratio a television actually has, so a measurement taken off
one is a measurement of the surface rather than of the photograph around it.
1672×941 is also the size of the TV backgrounds in `packages/ui/assets/`, so a
board and the canvas it sits on now share one coordinate space.

## Source reference

`boards/approved-soft-minimal-screen-board.png` is the final approved overview
used to verify the screen set and visual relationships. It was delivered as
`screens-reference/SCREEN-MANIFEST.md`'s companion board.

`boards/approved-phone-settings-flow.png` is the approved phone settings branch,
covering Standard, Quick, Custom, and category-picker states.

`boards/tv-screen-flow.png` is the approved TV flow overview: Join Room → Browse
Games → Game Setup. The phone controls each transition while the TV displays the
shared state.

`brand/huddle-brand-guide.png` is the approved identity reference.
