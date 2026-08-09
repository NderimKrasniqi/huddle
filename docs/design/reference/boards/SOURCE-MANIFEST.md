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
2. `screens/02-your-room-host-reference-crop.png` — exact crop from the approved final screen board. A separate full-resolution standalone export was not present in the original generated batch.
3. `screens/03-manage-player-host.png` — original standalone export.
4. `screens/04-pick-a-game-host.png` — original standalone export.
5. `screens/05-waiting-player.png` — original standalone export.

The earlier “You’re in (player)” screen is intentionally not part of this final set because it was removed from the approved phone flow before the final board.

## TV app

1. `screens/01-room.png` — Room screen, combining pairing/join information with the current room roster and 12-seat layout.
2. `screens/02-game-carousel.png` — Game carousel.

Both were re-exported on 2026-08-09, replacing the originals. The originals were
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

`brand/huddle-brand-guide.png` is the approved identity reference.
