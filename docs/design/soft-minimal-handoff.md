# Handoff: Huddle — Soft Minimal

The visual source of truth for both apps, replacing Boardwalk
(`legacy/boardwalk-handoff.md`, retained as historical provenance).

This document reconciles the approved Soft Minimal package against the platform
**as built**. The design board was drawn against the original Boardwalk §1–§8
spec, so its original seven screens are neither the same set nor the same shape
as the app's. Additional setup, settings, and finished-state references were
approved on 2026-08-11. Where any reference and the product disagree, this file
records which one wins and why.

## Source material

| What | Where |
|---|---|
| Vendored handoff, tokens, theme files | `soft-minimal/` (verbatim, lint-exempt) |
| Approved screen board | `reference/boards/approved-soft-minimal-screen-board.png` |
| Approved phone settings flow | `reference/boards/approved-phone-settings-flow.png` |
| Approved TV screen flow | `reference/boards/tv-screen-flow.png` |
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

`tv-backgrounds/` is not decoration layered onto a screen — it **is** the
default canvas on every implemented TV screen. Nothing currently paints a flat
colour behind it.

That matters for `TvStage`: `huddle-tv-background-01.png` renders full-viewport
with `cover`, while only the 1280×720 content layer receives
`tvSafeStageScale`. The plants therefore reach every edge without sacrificing
title-safe UI space; `colors.screen` remains the loading fallback.

Two things it does not change:

- **Non-16:9 panels crop the artwork, rather than letterboxing it.** `cover`
  keeps the 16:9 composition intact and sacrifices decorative outer edges when
  a panel is wider or taller. The content stage remains centred and title-safe;
  the warm `colors.screen` fill is only the loading fallback.
- **The clear centre is load-bearing.** §11 puts decoration near the edges
  precisely so the room code, the QR, the player strip and the game cards never
  sit on top of it. A screen that needs the middle of the canvas is a screen
  that has outgrown this background, not a reason to move the plants.

Two variants ship: `-01` is warmer, `-02` cooler and greyer. The board does not
clearly assign one per screen and the difference is subtle enough that sampling
the exports could not settle it, so **`-01` is the default for the Room and
carousel** until told otherwise.

Their base is `#FAF1E9`/`#F8F1EA` rather than the `#FFF7F2` canvas token, which
is exactly why nothing composites them over a fill: the two are close enough to
look like a mistake and far enough apart to show a seam.

## Screen inventory

The platform's real surfaces. Five implemented surfaces still have no approved
design and are marked. Newly approved references that do not yet match a
dedicated runtime surface are identified separately from those gaps.

Three more used to be listed here and are now deleted rather than undesigned:
the About panel and the unknown-game screen on each surface. The package draws
none of them, and the platform no longer holds them — a game this build lacks
resolves to the lobby (see `packages/game-registry/src/running.ts`).

Every screen named below is in `docs/design/reference/screens/`, flat — the
`tv-screens/` and `phone-screens/` prefixes this table used to carry were the
delivered package's directories, and have never existed here.

The two TV boards were re-exported on 2026-08-09 at 1672×941, the screen alone
rather than a render of it inside a television mockup. Any measurement quoted
below that predates that swap was taken off the mockup and is worth re-checking
before it is trusted to the pixel.

### TV

| Surface | Component | Design | Notes |
|---|---|---|---|
| Room | `RoomStage` | `01-room.png` | Code, QR and roster on one screen |
| Lobby / carousel | `CarouselStage` | `02-game-carousel.png` | Games only — no roster, no code chip |
| Game setup | **none yet** | `03-game-setup.png` | Approved TV flow's third state; dedicated runtime surface still needs implementation |
| Game frame | `GameStage` | **none** | Needs design |
| Recovery status | `TvRuntimeStatus` | **none** | Names disconnected players; says the Host may wait or continue |

### Phone

| Surface | Component | Design | Notes |
|---|---|---|---|
| Join | `JoinForm` | `01-join-room.png` | Now carries avatar selection |
| Lobby (host) | `SeatedScreen` | `02-your-room-host.png`, `04-pick-a-game-host.png` | Room and picker states |
| Lobby (player) | `SeatedScreen` | `05-waiting-player.png` | — |
| Manage player | `ManagePlayerSheet` | `03-manage-player-host.png` | — |
| Game settings (host) | `SettingsControls` in the picker | `06`–`08-game-settings-host-*` | New standalone Standard, Quick, and Custom layouts await navigation and visual adoption |
| Finished game | `InGameScreen` + module screen | `09-game-finished-player.png`, `10-game-finished-host.png` | New hub-level post-game actions await implementation; finished state currently remains module-owned until the Host chooses Back to lobby |
| Leave | `LeaveRoomSheet` | **none** | The board draws the pill, not the sheet |
| Game frame | `InGameScreen` | **none** | Needs design |
| Recovery status | `GameRuntimeStatusScreen` | **none** | Host gets secondary Wait + primary Continue; others see the pending Host decision |

### Reconciliation for the 2026-08-11 references

- **The room cap remains 10.** Any “12 players”, “6 of 12”, or “2–12” sample
  text in the new images is superseded by `ROOM_PLAYER_CAP` and the declared
  2–10 ranges of the installed games.
- **Game metadata and settings schemas remain authoritative.** The 15-minute
  estimate, preset names, values, and other mock content describe the proposed
  layout; they do not change a module's duration or supported settings until
  the module and registry adopt them.
- **The TV setup screen is a proposed new platform surface.** Its dark,
  full-bleed treatment conflicts with the default warm image canvas above, so
  adopting it requires an explicit per-screen canvas exception or a revised
  approved export—not an implicit palette change across existing TV screens.
- **Finished-game actions need product wiring.** “Play again”, “Choose another
  game”, and “Manage players” are approved visual direction, but the current
  platform exposes one generic Back to lobby action and lets each game render
  its own finished beat. Their exact lifecycle mapping must land with the UI.

## Icons

A set of fifteen 24×24 line glyphs, delivered 2026-08-09 (`Huddle UI Icons —
Single Files`) and held as **geometry, not artwork**: the SVG sources sit in
`packages/ui/assets/icons/` as the provenance record, `packages/ui/src/icons.ts`
transcribes each one's shapes, and `Icon` (`@huddle/ui/native`) draws them with
`react-native-svg` at a size and colour the call site gives it.

The package also shipped every icon as a PNG twice — a dark set for light
surfaces and a white set for coloured ones. **Neither was taken.** One path is
sharp at 14pt in a phone chip and at 48pt on a television, and takes its colour
from a palette token rather than from which folder it was imported out of; two
raster sets would be two things to keep in step and still wrong on the third
surface. `icons.test.ts` parses the sources and fails if the transcription
drifts from them.

**Badges and dots are components, not icons.** The set also held `badge_host`,
`badge_just-joined` and three status dots. A badge is a bordered chip with a
word in it and a dot is a filled circle, and both are drawn as ordinary React
Native views so they scale with their own text and take their colour from the
palette — the same rule that keeps room-code tiles, buttons, cards, page dots
and player slots out of the asset folder. Only `crown` survives from that group,
because it is a glyph *inside* the HOST chip rather than the chip.

The QR is generated at runtime (`react-native-qrcode-svg`) and has never been an
asset.

## Decisions

**Avatars replace colors.** The join screen carries a 4×3 avatar picker; the
`YOUR COLOR` swatch row is deleted. This removes `players.claimColor`,
`color-picker.ts`, `color-rejection.ts`, `player-colors.ts` and `accent-face.ts`,
and turns the roster's `color` field into an avatar id.

It also moves the choice earlier. Color was claimed *after* joining, against a
live roster that could grey out taken swatches; the avatar is picked *before*,
on a form with no room subscription until the code resolves. A collision
therefore returns as a join rejection — `join-rejection.ts` already had that
shape, so it gained a case rather than a path.

**Greying taken avatars did not ship.** This section used to promise the picker
would dim them the moment four letters resolved to a room. It does not: the
rejection is the whole of the collision handling, and the board draws no dimmed
tile. Worth doing — it turns a refused join into one the player never attempts —
but it is a live roster subscription on a form that deliberately has none, so it
is a decision rather than a detail, and it is recorded here as outstanding.

This is also why the final board drops "You're in (player)". That screen existed
to claim a color; with the choice made on the join form it has nothing left to
do. The player lobby survives as `05-waiting-player.png`.

**The lobby stays one component, and is now two states.** *(Settled; this entry
used to read "stays one screen".)* The board draws "Your room" and "Pick a game"
as separate screens and they now are — but as two states of `SeatedScreen`,
not two routes. That distinction is the whole entry: the seat, the roster
subscription, the running-game query and the Host's chosen settings all have to
survive moving between them and a route would remount every one, which is the
problem the original merge solved. What the merge got wrong was drawing both at
once: the roster carries news nothing else in the product carries, and it was
the section a Host scrolled past to reach the picker.

When the Host chooses **Back to lobby** after a game, it lands on **Your room**,
not on the picker the Host left. The newly approved finished-state actions may
add more destinations, but they do not silently change that existing path.

**Ten seats, not twelve.** `ROOM_PLAYER_CAP` is 10. The board's 12-seat grid and
"of 12 joined" line are the old number.

**"Leave" is Leave.** *(Settled; this entry used to record a placeholder.)* The
board's header affordance had no backend behind it, so Phase 4 drew the pill in
the slot the board gives it and labelled it `End room` — a pill saying Leave
that in fact deleted every seat was the one substitution in that rebuild that
could have cost somebody their party. `players.leaveRoom` landed in Phase 5 and
the label is now the board's own.

It is on the waiting screen too, which the board does not draw. The board shows
a bare wordmark there because it predates the decision that leaving is
everybody's; a player with no way out would make that decision false on the
screen most of the party is looking at.

The sheet behind it still needs a Soft Minimal treatment — it is the reused
`ConfirmSheet`, which is the manage sheet's surface.

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
not a reinterpretation. `apps/tv/src/features/room/roster.ts` holds the vertical stack as
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

## Reconciled decisions and remaining open items

1. **Resolved — complete avatar batch.** The authoritative
   `HUDDLE ASSETS/avatars/squares/` source now produces exactly the ten stable
   runtime ids. `tools/prepare-avatars.py` crops each centred painted disc,
   rejects uncertain bounds, and writes 640×640 assets only after the complete
   batch validates. Circle portraits and Expo-pack crops remain excluded.
2. **`packages/ui/assets/` is wired**, except `game-art/`. Avatars, the TV
   background, the logo, the mobile icons, and the Android TV launcher icon and
   banner are consumed and proved through `expo export` / `expo prebuild`.
   Game art is the one set still staged, and only in part — see 5.
3. **Avatars have replaced colors.** Done: the schema stores an avatar id, the
   join form is the picker, and `claimColor`, `player-colors.ts`,
   `color-picker.ts` and `color-rejection.ts` are deleted.
4. **Five implemented surfaces still need designs** — TV Game frame, TV
   recovery status, phone Leave sheet, phone Game frame, and phone recovery
   status. The former End Room sheet no longer exists because phones cannot
   close the TV-owned room.
5. **Game art coverage** — `voting` has none; Draw Battle and Word Sneak have art
   but no game.
6. **`accent-face` is interim.** A game's answer options still need a cycle of
   distinguishable colours, and the package designs no game screen, so its four
   faces are a holding pattern rather than a decision.
7. **Resolved — Room screen geometry adopted.** The implementation now uses the
   approved board landmarks recorded below, including the 5×2 ten-seat grid.
8. **New references await adoption.** TV Game setup, phone settings presets,
   and phone finished-game actions are approved references, but remain explicit
   implementation work as described in the screen inventory and reconciliation
   notes above.

## The 2026-08-09 TV re-export

`screens/01-room.png` and `screens/02-game-carousel.png` were replaced with
1672×941 exports of the screen alone. The originals were 1448×1086 renders of
that screen inside a television mockup — bezel, stand, caption — and the layout
constants in `apps/tv/src/features/room/roster.ts` were measured off the mockup, where a board
pixel happened to be a design point.

The replacement is a recomposition, not a rescale. At 1672 px across a 1280 pt
stage a board pixel is 1/1.30625 of a point, and the layout that emerges is not
the old one at a new size: the hero gained room and the roster lost it.

| Measure | Previous implementation | Approved board / adopted |
|---|---|---|
| Wordmark top | 32 | 32 |
| Wordmark height | 39 | 47 |
| Title line | `titleTop` 55, overlapping the wordmark | 78, clear of it |
| Title height | 48 | 48 |
| Code tile | 84 square | 105 × 89 |
| QR height | shorter than the tiles | 87 against the tiles' 89 — still shorter |
| Caption line | 30 | 22 |
| Divider gap | 24 | 21 |
| Avatar disc | 88 | 70 |
| Nickname line | 22 | 22 |
| Status line | 20 | 20 |
| Column pitch | 158 | 124 |
| Row pitch | 177 | 145 |
| Content bottom | 710 of 720 | 689 of 720 |

Four of those agree outright — the wordmark's top, the title's line, and both
text lines in a seat. That is the tell that this is one design rather than two:
where the board and the code disagree it is about *size*, not about what the
screen is made of.

The disagreement that remains is a consistent one. The hero is drawn larger than
the code draws it (tile 105 against 84) and the roster smaller (disc 70 against
88, pitch 124 against 158) — the board spends the 16:9 frame's extra width on
the code and buys it back from the grid, which is what a room of six across can
afford and a stage of 1.656 could not.

An earlier 1672×941 export, replaced on the same day, had the QR taller than the
tiles and so contradicted `roomHeroHeight()`'s stated reason for measuring the
tile column. This board does not: 87 against 89, shorter as designed. No stated
reason is now contradicted — only numbers.

The approved values are now the shipping geometry: wordmark top 32 and height
47; title top 78 with a 48pt line; code tiles 105×89; QR visual height 87;
caption line 22; divider gap 21; avatar disc 70; seat pitch 124 horizontally
and 145 vertically; nickname/status lines 22/20; and content bottom 689 or
less. Ten seats remain centred in a 5×2 grid.

The same reconciliation carries the board's supporting details into the Room:
the card and QR surfaces are `#FDFAF9`, the caption is neutral `#8A8E95`, the
Host crown is the existing vector rendered in `#F5A116`, `AWAY` is a blue chip
(`#EAF5FF` / `#2587C8`), and the existing `player-count` vector leads the
joined-player footer. The normal invitation is structured so **Huddle** is
semibold and the copy ends with “enter the code.” Host crown visibility is
independent of the transient `JUST JOINED!` status precedence.
