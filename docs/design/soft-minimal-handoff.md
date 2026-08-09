# Handoff: Huddle — Soft Minimal

The visual source of truth for both apps, replacing Boardwalk
(`design-handoff.md`, retained until the swap lands).

This document reconciles the approved Soft Minimal package against the platform
**as built**. The design board was drawn against the original Boardwalk §1–§8
spec, so its seven screens are neither the same set nor the same shape as the
app's. Where the two disagree, this file records which one wins and why.

## Source material

| What | Where |
|---|---|
| Vendored handoff, tokens, theme files | `soft-minimal/` (verbatim, lint-exempt) |
| Approved screen board | `reference/boards/approved-soft-minimal-screen-board.png` |
| Screen exports | `reference/screens/` |
| Brand guide | `reference/brand/huddle-brand-guide.png` |
| Runtime artwork | `packages/ui/assets/` |

**The package's own §14 priority list points at a board that is not approved.**
It ranks `design-system/reference/huddle-soft-minimal-ui-board.png` above the
screen exports, but that file is an earlier exploration and is **wrong** — its
screen 2 is a "You're in (player)" step carrying a `YOUR COLOR` swatch row that
the approved flow does not have. It is deliberately not vendored here, so
nothing can be built from it by mistake. Ignore §14's ordering and read
`approved-soft-minimal-screen-board.png` as the board.

## Palette

Approved brand values, exact:

| Token | Hex | Use |
|---|---|---|
| Brand orange | `#FF6B4A` | Primary actions, selected and focused states, host |
| Soft peach | `#FFE9DE` | Accent surfaces, avatar wells |
| Warm off-white | `#FFF7F2` | Canvas |
| Deep navy | `#0F172A` | Text, headings, icons, wordmark |
| Sage | `#A7B3A6` | Decorative accent |
| Warm grey | `#E9E6E2` | Borders, dividers, inactive surfaces |

Status colors (`online #34A853`, `justJoined #2D9CDB`, `away #A0A4AA`) are
implementation values, not brand.

Boardwalk's cobalt, tangerine, punch and yellow have no successor: Soft Minimal
carries one accent.

## Typography

**Inter**, in four weights, across both apps. The package shipped no font — §5
states the family was never locked and the theme files fall back to the platform
system sans — and the boards could not settle it either: the phone body text is
set in a neo-grotesque and the TV headings in a geometric sans, which is what
AI-rendered mockups look like rather than a two-family system. So it was chosen
rather than identified.

| Role | Weight |
|---|---|
| Screen titles | Inter Bold / 700 |
| Section headings, buttons, room-code characters | Inter SemiBold / 600 |
| Player names, small uppercase labels | Inter Medium / 500 |
| Body and status text | Inter Regular / 400 |

There is no display face. The one thing that genuinely needed a second family
was the wordmark, and §5 is explicit that it ships as brand artwork.

Baselines are per platform — the TV is not a scaled phone:

| | Phone | TV |
|---|---|---|
| Display | — | 56/64 bold |
| Title / heading | 32/40, 24/32 bold | 40/48 bold |
| Body | 16/24 | 22/30 |
| Label | 13/18 semibold | 18/24 semibold |
| Caption | 12/16 | 16/22 |

Spacing `4 8 12 16 24 32 40 48 64 80`. Radius: chips 8–12, controls 12–16, cards
18–24, pills 999. Phone content padding 24, controls ≥48 high. TV safe margin
64, focus = orange border + 1.04 scale, never scale alone.

The floors moved with the scale. `minBodyFontSize` was Boardwalk's 14 (phone)
and 18 (TV); Soft Minimal's own caption sizes are 12 and 16, *under both*, so
keeping them would have made the design system illegal in its own repo. They now
sit on the scale's smallest sizes — which also retired the lint rule's escape
hatch, since nothing the handoff specifies needs exempting any more.

## Contrast: white on orange

**White on `#FF6B4A` measures 2.82:1.** That is under WCAG AA for body text
(4.5:1) and under the 3:1 allowance for large text as well. Navy on the same
orange is 6.34:1.

§8 asks for white on orange and that stands where it is about — the primary CTA,
one high-intent button a player is looking for and cannot miss. It is recorded
here rather than quietly changed, because it is a brand decision.

It was not left to spread, though. A game's answer options are four blocks read
at speed and at distance, so they take navy, and `accent-face.test.ts` holds a
3:1 floor that would catch the next surface reaching for white on orange.

## The TV canvas is an image

`tv-backgrounds/` is not decoration layered onto a screen — it **is** the TV
canvas, on every TV screen. Nothing paints a flat colour behind it.

That matters for `TvStage`, which today fills the 1280×720 stage with a solid
`colors.screen`. The image replaces that fill and scales with the stage, so the
plants stay at the edges at any panel size.

Two things it does not change:

- **The letterbox bars stay a solid warm off-white.** They are what a non-16:9
  window leaves over, and the background is a 16:9 composition — tiling or
  stretching it into the bars would put a second pair of plants beside the
  first.
- **The clear centre is load-bearing.** §11 puts decoration near the edges
  precisely so the room code, the QR, the player strip and the game cards never
  sit on top of it. A screen that needs the middle of the canvas is a screen
  that has outgrown this background, not a reason to move the plants.

Two variants ship: `-01` is warmer, `-02` cooler and greyer. The board does not
clearly assign one per screen and the difference is subtle enough that sampling
the exports could not settle it, so **`-01` is the default for both TV screens**
until told otherwise.

Their base is `#FAF1E9`/`#F8F1EA` rather than the `#FFF7F2` canvas token, which
is exactly why nothing composites them over a fill: the two are close enough to
look like a mistake and far enough apart to show a seam.

## Screen inventory

The platform's real surfaces. Three have no design in the package and are marked.

Three more used to be listed here and are now deleted rather than undesigned:
the About panel and the unknown-game screen on each surface. The package draws
none of them, and the platform no longer holds them — a game this build lacks
resolves to the lobby (see `packages/game-registry/src/running.ts`).

Every board named below is in `docs/design/reference/screens/`, flat — the
`tv-screens/` and `phone-screens/` prefixes this table used to carry named
directories that have never existed.

### TV

| Surface | Component | Design | Notes |
|---|---|---|---|
| Room | `RoomStage` | `01-room.png` | Code, QR and roster on one screen |
| Lobby / carousel | `CarouselStage` | `02-game-carousel.png` | Games only — no roster, no code chip |
| Game frame | `GameStage` | **none** | Needs design |

### Phone

| Surface | Component | Design | Notes |
|---|---|---|---|
| Join | `JoinForm` | `01-join-room.png` | Now carries avatar selection |
| Lobby (host) | `YoureInScreen` | `02-your-room-host`, `04-pick-a-game` | Two states of one screen |
| Lobby (player) | `YoureInScreen` | `05-waiting-player.png` | — |
| Manage player | `ManagePlayerSheet` | `03-manage-player-host.png` | — |
| End room | `EndRoomSheet` | **none** | Board shows a "Leave" affordance instead |
| Game frame | `InGameScreen` | **none** | Needs design |

## Decisions

**Avatars replace colors.** The join screen carries a 4×3 avatar picker; the
`YOUR COLOR` swatch row is deleted. This removes `players.claimColor`,
`color-picker.ts`, `color-rejection.ts`, `player-colors.ts` and `accent-face.ts`,
and turns the roster's `color` field into an avatar id.

It also moves the choice earlier. Color was claimed *after* joining, against a
live roster that could grey out taken swatches; the avatar is picked *before*,
on a form with no room subscription until the code resolves. So: the picker
greys taken avatars the moment four letters resolve to a room, and a collision
inside a round trip returns as another join rejection — `join-rejection.ts`
already has that shape, so it gains a case rather than a path.

This is also why the final board drops "You're in (player)". That screen existed
to claim a color; with the choice made on the join form it has nothing left to
do. The player lobby survives as `05-waiting-player.png`.

**The lobby stays one screen.** The board draws "Your room" and "Pick a game" as
separate screens, which is the old §-per-screen shape. `YoureInScreen` already
switches between roster and picker on one surface and keeps host settings alive
across a game; splitting it would reintroduce the problem that merge solved.

**Ten seats, not twelve.** `ROOM_PLAYER_CAP` is 10. The board's 12-seat grid and
"of 12 joined" line are the old number.

**"Leave" is not End Room.** The board's header affordance has no backend behind
it. The built host-ends-room flow with its confirm sheet stands; the sheet needs
a Soft Minimal treatment.

**TV pairing lost its roster switch.** *(Settled; this entry used to defer it.)*
Boardwalk showed the code large while the room was empty and switched to the
carousel at the first join, code demoted to a header chip. The board draws code,
QR and a full roster on one screen, and that is now what ships: the Room stands
until the Host starts browsing, so the second player and everyone after them can
still read the code off the television.

That needed one backend change. `games.browsing` used to flatten an unbrowsed
room to card zero, which is the right card to draw and the wrong answer to "has
the Host started picking"; it now returns `null` for a room nobody has browsed
in. Every client that only wants a card writes `?? 0` and is unchanged.

**The Room is measured off the board, at 1:1.** The mockup's pixels are square —
its QR bitmap is 95×93, and a QR is square by construction — so a board pixel is
a design point and every size and gap on that screen is the board's own number,
not a reinterpretation. `apps/tv/src/roster.ts` holds the vertical stack as
`roomLayout` / `roomScreenHeight()` so the total is testable rather than
described in a comment.

What does *not* carry over is the frame. **The mockup's TV screen is 1272×768 —
an aspect of 1.656, not 16:9.** Its layout runs to y 725 where the stage has 720,
so five points come out of the largest gap on the screen (`gridGap`) and nothing
else moves. Verified on a simulator: every vertical landmark lands within 12pt of
the board, and everything above the roster within 4pt.

**The in-stage 64pt TV safe margin is not applied to the Room.** `TvStage`
already scales the whole 1280×720 composition into the title-safe inner 90%
(`tvSafeStageScale`), so the entire design surface is clear of the bezel and a
second inset inside it is belt *and* braces. Here that second inset had a cost:
the board's own element sizes do not fit a 16:9 stage inside a further 64pt, and
the board is the design. `roomScreenHeight()` is held against the stage instead,
with 10pt to spare.

**The title is 40/48, which is the scale, not the board's ~33.** The board draws
`Grab your phone!` noticeably smaller than the TV Title step above. The scale
wins: a one-off size on one screen is how a type scale stops being one. Recorded
rather than silently resolved, because it is the board that is off-system here.

**`AWAY` is grey on the TV, not the board's blue.** Blue is the system's one
informational colour and `JUST JOINED!` already means it. The two share a seat's
status slot, so drawing both blue would make the loudest thing on the grid
ambiguous — and `colors.away` exists for exactly this, and is what the Host's own
roster already uses to say the same thing about the same player.

**Ten seats, 5×2.** The board's grid is 6×2. At `ROOM_PLAYER_CAP = 10` that
leaves four stragglers under a row of six, so the TV draws five and five. Empty
places are dashed circles carrying their own number, as the board draws them.

**The QR loses its caption.** Boardwalk captioned it "or scan to join". The board
draws a bare QR card, and the line under the tiles ("Open Huddle on your phone
and enter this code") already says what to do. The space it freed is the space
the roster grew into.

**The avatar pop-in went back onto a face.** The handoff hangs the ~300ms spring
on the arriving player's avatar. Boardwalk had no TV seat with a player in it, so
the spring had been rehomed onto the carousel's footer line — one greeting at a
time, since a line has one slot. The Room's grid restores it, and two phones
landing together are now both greeted.

## Open

1. **Two more avatars, and re-art on `yellow-robot`.** The cleaned batch landed
   ten usable characters — exactly `ROOM_PLAYER_CAP`, so a full room leaves the
   last player no choice. `yellow-robot`'s background is the canvas colour, so
   it draws no disc at all. See `packages/ui/assets/README.md`. Circle art is no
   longer needed: the circular avatar is the square under `borderRadius`.
2. **Nothing in `packages/ui/assets/` is wired yet.** The tokens are swapped, but
   the avatars, game art, TV background, logo and app icons are all still
   staged. Wiring them needs Metro's cross-package asset resolution proved
   first — worth a `prebuild` before trusting it.
3. **Avatars have not replaced colors yet.** That is a schema change, not a
   palette one. `player-colors.ts` is holding ten Boardwalk values as literals
   until it lands, and says so.
4. **Three screens need designing** — both game frames and the End Room sheet.
   It was six; the unknown-game pair and the About panel were deleted instead.
5. **Game art coverage** — `voting` has none; Draw Battle and Word Sneak have art
   but no game.
6. **`accent-face` is interim.** A game's answer options still need a cycle of
   distinguishable colours, and the package designs no game screen, so its four
   faces are a holding pattern rather than a decision.
