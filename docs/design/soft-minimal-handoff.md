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

## Typography — unresolved

The package ships no font. §5 states the family was never locked and the theme
files fall back to the platform system sans, but the boards are plainly set in a
geometric sans. Shipping the tokens as written produces an app that does not
match its own reference.

Boardwalk currently loads Bungee + Space Grotesk through `@expo-google-fonts`,
so the loading path in both root layouts already exists and is reusable
whichever family is chosen. **This blocks the token swap and needs a decision.**

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

The platform's real surfaces. Six had no design in the package and are marked.

### TV

| Surface | Component | Design | Notes |
|---|---|---|---|
| Pairing | `PairingStage` | `tv-screens/01-room.png` | Merge conflict, below |
| Lobby / carousel | `CarouselStage` | `tv-screens/02-game-carousel.png` | — |
| Unknown game | `UnknownGameStage` | **none** | Needs design |
| About panel | `AboutPanel` | **none** | Needs design; the TV's only remote-reachable control |
| Game frame | `GameStage` | **none** | Needs design |

### Phone

| Surface | Component | Design | Notes |
|---|---|---|---|
| Join | `JoinForm` | `phone-screens/01-join-room.png` | Now carries avatar selection |
| Lobby (host) | `YoureInScreen` | `02-your-room-host`, `04-pick-a-game` | Two states of one screen |
| Lobby (player) | `YoureInScreen` | `05-waiting-player.png` | — |
| Manage player | `ManagePlayerSheet` | `03-manage-player-host.png` | — |
| End room | `EndRoomSheet` | **none** | Board shows a "Leave" affordance instead |
| Game frame | `InGameScreen` | **none** | Needs design |
| Unknown game | `UnknownGameScreen` | **none** | Needs design |

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

**TV pairing keeps its roster switch — for now.** The board draws code, QR and a
full roster on one screen. The app shows the code large while the room is empty
and switches to the carousel at the first join, code demoted to a header chip
(`apps/tv/src/roster.ts`). Worth revisiting on the merits — the board's version
keeps the code reachable for latecomers — but it is a behavioural change, not
something the board settles, and it is out of scope for the token swap.

## Open

1. **Font family** — blocks the swap.
2. **Two more avatars, and re-art on `yellow-robot`.** The cleaned batch landed
   ten usable characters — exactly `ROOM_PLAYER_CAP`, so a full room leaves the
   last player no choice. `yellow-robot`'s background is the canvas colour, so
   it draws no disc at all. See `packages/ui/assets/README.md`. Circle art is no
   longer needed: the circular avatar is the square under `borderRadius`.
3. **Six screens need designing** — the unknown-game pair, both game frames, the
   About panel, the End Room sheet.
4. **Game art coverage** — `voting` has none; Draw Battle and Word Sneak have art
   but no game.
