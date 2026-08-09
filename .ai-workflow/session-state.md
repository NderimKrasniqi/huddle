# Session State

## Current task

**Soft Minimal screen replacement, Phase 2 — TV Room and carousel.** Complete on
branch `feat/soft-minimal-design-assets`, not yet committed at the time this was
written. The approved plan is
`~/.claude/plans/make-a-plan-to-enchanted-boole.md`; Phase 2 is marked DONE
there, with the four things the plan did not anticipate recorded against it.

## What this change did

- **`PairingStage` → `RoomStage`.** Code tiles, QR and the roster on one screen,
  under a `PLAYERS IN THE ROOM` divider: a 5×2 grid of avatars with names and a
  status slot (`HOST` / green dot / `AWAY` / `JUST JOINED!`), and a count line.
  Empty places are dashed circles carrying their own number.
- **The Room no longer vanishes at the first join.** `OpenRoomStage` switched on
  `roster.length > 0`; it now switches only when the Host has browsed, so the
  code stays readable for the second player and everyone after them.
- **`games.browsing` returns `number | null`.** It used to flatten an unbrowsed
  room to card zero, which made "has the Host started picking" unanswerable.
  Clients that only want a card write `?? 0` and are unchanged.
- **The carousel lost its roster machinery and its room chip.** Games, dots and
  the browsing sentence, as the board draws it.
- **The just-joined greeting went back onto the seat.** `arrivalToGreet` /
  `newestArrival` deleted; `just-joined.ts` gained a per-seat `isGreeting`. Two
  phones landing together are now both greeted — the single footer line could
  only ever greet one. The avatar pop-in spring moved with it.
- **Two pre-existing bugs fixed in passing.** `styles.screen` painted
  `colors.screen` over `TvStage`'s background image, so the TV artwork had never
  been visible. And `convex/convex/host-control.ts` → `hostControl.ts`: Convex
  rejects hyphens in module paths, so `npx convex dev` could not push at all.

## Checks

`pnpm -r typecheck` clean; `npx eslint . --max-warnings=0` clean; `npx vitest
run` green — **746 passed, 62 files**. `npx expo export --platform ios` in
`apps/tv` succeeds.

## Board fidelity

The first pass was a loose port. It was re-measured against
`docs/design/reference/screens/01-room.png` pixel by pixel and rebuilt to the
board's own numbers. Two measurement traps cost time and are worth not repeating:

- **The mockup's pixels are square** (its QR bitmap is 95×93). An early pass
  compressed every y-value by 720/768 on the assumption the mockup was stretched,
  which produced a bogus "the tile is portrait 86×95" finding. It is 86×84.
- **Threshold-based box finding does not work on this export.** The card fills
  and the canvas are ~4 levels apart and the soft shadows read as fill, which
  inflated the tile and QR boxes by 20–40%. Column/row *edge profiles* (looking
  for the sharp step) are reliable; flood-style tests are not.

Result: every vertical landmark within 12pt of the board, everything above the
roster within 4pt, tile row within 2pt horizontally, avatar pitch exact at 158.

Two decisions the user made when the board and the system disagreed:

- **Board element sizes win over the in-stage 64pt safe margin.** `TvStage`
  already insets the whole stage to the title-safe 90%, so the second margin was
  redundant and was costing fidelity. `roomScreenHeight()` is now held against
  the 720pt stage (lands at 710).
- **The handoff's type scale wins over the board on the title** — 40/48, not the
  board's ~33. Both recorded in the handoff.

Colour was checked and left alone: an early "HOST is `#E70000` red" reading was
JPEG ringing in the mockup export; direct sampling gives `#F96047`, which is the
`colors.accent` token. The palette is the handoff's throughout.

## Verified on hardware

Apple TV 4K (3rd gen, 1080p) simulator, against the cloud dev deployment:

- Room at 0, 5 and 10 players, code and QR up throughout. A full room fits with
  margin; long nicknames ("Christopher", "Wednesday") do not truncate.
- All four status slots seen: `HOST` orange, `AWAY` grey, `JUST JOINED!` blue,
  green dot.
- Two arrivals greeted simultaneously.
- The carousel appears only on the Host's first `browseGame`, with no roster.

Known and out of scope, now confirmed on screen: `yellow-robot`'s background is
the canvas colour, so it draws as a square rather than a disc.

## Not verified

Real TV hardware. Note this branch predates the merged overscan fix (PR #23 is
not in its history), so the simulator drew the stage edge-to-edge; on `main` the
whole stage is inset to the title-safe 90%, which only adds margin.

## Where the plan stands

Phases 1 and 2 of the screen replacement are done. **Phase 3 is next** — remove
the About panel and both unknown-game screens. Then Phase 4 (phone screens) and
Phase 5 (Leave).

Separately, from the MVP roadmap: 5.9 (keep `@huddle/packs` out of the
Controller bundle) merged as PR #24; nothing is outstanding there.

## Next action

Commit Phase 2 and push to PR #25. Then Phase 3.
