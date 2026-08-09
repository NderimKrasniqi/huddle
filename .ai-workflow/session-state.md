# Session State

Written 2026-08-09 as a handoff. The agent that wrote it is out of budget; the
next one starts cold. Everything needed to continue is here or cited by path —
do not assume any of it is remembered.

## Where the repo is

`main`, clean, no open branches. The Soft Minimal screen replacement is finished
and merged (PRs #25, #26), and `docs/implementation-plan.md` is fully checked.
The most recent merge is **PR #27**, this session's work.

## What this session did

**Swapped the two TV design boards** and worked out what that revealed.

`docs/design/reference/screens/01-room.png` and `02-game-carousel.png` were
1448×1086 renders of each screen sitting inside a television mockup — bezel,
stand, a "TV screen" caption. They are now 1672×941 exports of the screen
alone, at the stage's own 16:9 and the exact size of
`packages/ui/assets/tv-backgrounds/`.

Two exports landed on the same day; the second is the one in the repo. The first
had the QR taller than the code tiles, which contradicted `roomHeroHeight()`'s
stated reason for measuring the tile column and would have returned a hero 15pt
short. **The second restores it — QR 87 against the tiles' 89.** If a third
export ever arrives, measure that relationship first; two points is the whole of
the margin.

Also fixed `docs/design/reference/boards/SOURCE-MANIFEST.md`, whose paths named
the delivered package's directories (`tv-screens/`, `phone-screens/`) rather than
the flat `screens/` the repo has. `docs/design/soft-minimal/PACKAGE-README.txt`
was deliberately **left alone** — it is the delivered zip's own README and its
prefixes are correct about the zip.

## The open decision, which is the main thing to pick up

**The new board and the shipping layout disagree, and nothing was changed to
match.** The full table is in `docs/design/soft-minimal-handoff.md` under "The
2026-08-09 TV re-export". The short form, in design points:

| Measure | Shipping (`apps/tv/src/roster.ts`) | Board |
|---|---|---|
| Wordmark top | 32 | 32 |
| Title line | `titleTop` 55, overlapping the wordmark | 78, clear of it |
| Code tile | 84 square | 105 × 89 |
| Avatar disc | 88 | 70 |
| Column pitch | 158 | 124 |
| Row pitch | 177 | 145 |
| Nickname / status line | 22 / 20 | 22 / 20 |

Four agree exactly — the wordmark's top, the title's 48pt line, and both text
lines in a seat. That is the tell that this is one design at two sizes rather
than two designs. The board spends the 16:9 frame's extra width on the hero and
buys it back from the grid.

**How the board was measured**, so a successor can reproduce or challenge it:
the board is 1672 px across a 1280 pt stage, so divide board pixels by
**1.30625**. Detection is by per-row/column difference from a background sample
taken at a fixed x well clear of the content; the canvas is flat at about
(249, 241, 235) and the code tiles are only ~5–20 RGB levels off it, so
thresholds below about 6 are noise and above about 10 miss the tiles.

**It was not adopted because nobody had seen it drawn.** The reconciliation
below adopts it as the shipping geometry; the remaining hardware check is
limited to release verification on the target Philips set.

## The simulator run (2026-08-09) — baseline findings before reconciliation

The notes in this section describe the pre-reconciliation render and are kept
as evidence for the six findings. The completion section below supersedes their
open/defect status.

The TV app was built and run on the Apple TV 4K (3rd gen, at 1080p) simulator,
udid `091BC127-357A-4104-8321-EE294BEF1311`, against the cloud dev deployment.

**Newly proven, having never been verified for this app before:**

- **`pod install` succeeds with `react-native-svg` in the TV app.** There was no
  `Podfile.lock` and no `Pods/`, so everything compiled from scratch: Build
  Succeeded, installed, launched. This is the gate `expo export` cannot run — it
  bundles JavaScript and never touches CocoaPods.
- **The TV background artwork renders as the canvas.** In the baseline render,
  plants and edge decoration were inset with the content by the title-safe
  transform. The reconciliation moved the artwork to a full-viewport `cover`
  layer and left the title-safe transform on content only. The binary already
  resident on the device predated that wiring and drew flat off-white, which is
  worth knowing because it looks like a regression and is not.

**Three differences from the board that are not about size**, all confirmed on
crops rather than eyeballed at scale:

1. **No crown on the host.** The board draws a gold crown above the host's disc.
   The app draws bare orange `HOST` text and no crown. `packages/ui/src/icons.ts`
   line 31 says the crown is kept precisely because it is "a glyph *inside* the
   HOST chip" — a third account again. Three descriptions, no two agreeing. The
   geometry is a judgment call; this one is just wrong somewhere.
2. **No people glyph on the count line.** The board leads with one; the app
   starts at the orange numeral.
3. **`AWAY` is grey, where the board's is pale blue.**

Plus copy: the app says "enter **this** code", the board "enter **the** code".

**Two things in the screenshots that are artifacts of seeding, not defects:**
every player reads AWAY because a CLI-seeded player never heartbeats and goes
away after ~13s; and the host lands on a late joiner rather than the first,
because `handOverRoom` correctly walks the join order handing the room to the
longest-connected seat still beating as each earlier one falls silent.

Screenshots from the run are in this session's scratchpad and are **not** in the
repo. Re-take them rather than hunting for them.

## Visual defects found by looking at the running app

The user reviewed the running TV screen and named six. All six are real; five
have root causes established below, and one (the AWAY colour) is a reasoned
decision rather than a bug. **These were found by looking, after every test passed — which is the point.**

### 1. The background does not cover the television

Confirmed in pixels: on the 1920×1080 render the flat `colors.screen` fill runs
x 0–95 and the artwork starts at x 96 — exactly 5% on every edge.

**Cause:** `apps/tv/src/tv-stage.tsx` puts the screen's children *inside* the
`ImageBackground` and applies `tvSafeStageScale` to that whole node, so the
title-safe inset shrinks the canvas along with the content. Its own comment
argues this is correct ("the artwork is inset with the content and its edges
stay where the composition puts them").

**That reasoning is worth reversing.** Overscan crops the outer ~5% of a
television, and a background is precisely the thing you want sacrificed to it —
inset it and you guarantee a visible border on every set instead of avoiding one.
The fix is to render the artwork at full window size and scale only the content.
Note the letterbox comment in the same file also depends on this, so both need
rewriting together.

### 2. The avatars have a ring around them — the cause is in the assets

Each avatar PNG is a square containing a **pale outer field with a darker disc
painted inside it**. `borderRadius: size / 2` rounds the square, which keeps the
pale field as a ring around the artist's disc — two concentric circles where the
board draws one.

The inset is different for every character, so the ring's thickness is too:

| Avatar | Outer field | Disc begins |
|---|---|---|
| `pink-bunny` | `#FDFDFE` | 1.2% |
| `green-alien` | `#D9F2C8` | 9.7% |
| `teal-bear` | `#D4EBE4` | 10.2% |
| `mint-cat` | `#DCF1EA` | 11.1% |
| `fox` | `#FDE1D1` | 11.7% |
| `yellow-robot` | `#FAF5F1` | 12.8% |

**This falsifies a claim in `packages/ui/assets/README.md`**, which says the
square's background "is already the character's own colour family, so the
circular avatar is just the square under `borderRadius`". It is not a flat
field. Fix in `tools/prepare-avatars.py` — crop each square to its baked disc so
the disc *is* the frame — rather than in the component, so a later batch is
handled too. That also explains the README's separate `yellow-robot` complaint:
its outer field is `#FAF5F1`, which is essentially the canvas, so what reads as
"no disc" is really the ring having swallowed it.

### 3. The code tiles are pure white; the board's are warm

App tile interior is `#FFFFFF`, the board's is `#FDFAF9`. The tiles take
`colors.surface`, which is defined as pure `#FFFFFF` in
`packages/ui/src/colors.ts:24`. Against a `#FFF7F2` warm canvas a pure-white card
reads cold and cut out. The board's cards are warm off-white — close to the
canvas, not a different temperature from it.

Check before fixing whether `surface` is used anywhere the phone needs true
white; if so this wants a new warm-card token rather than a redefinition.

### 4. The caption's colour is blue, and `Huddle` cannot be bold

Two separate faults in one line.

**Colour:** the caption renders `colors.mutedText`, `#64748B` — a blue slate.
The board's caption is a neutral grey, sampled at `#8A8E95`. On a warm canvas the
slate reads distinctly cool.

**Weight:** the board sets **Huddle** in bold inside the sentence. The app cannot
— `RoomCaption` (`apps/tv/app/index.tsx:641`) renders `caption.text` as a single
flat string, so no word inside it can be styled.

The fix has a precedent in this codebase: `RoomCountLine` in
`apps/tv/src/roster.ts` deliberately returns its parts separately rather than a
finished sentence, with the comment that a screen forced to find the number
inside a finished string "would be parsing its own copy". `roomOpeningCaption()`
should return parts the same way.

### 5. The wordmark is too small

`roomLayout.wordmark` is 39; the board draws 47. This is one row of the geometry
table above, but the user identified it independently by eye — which is a point
in favour of the board's sizes being right where they differ.

### 6. The pills — mixed, and one is not a defect

- **`AWAY` grey vs the board's blue is deliberate and reasoned.** See the comment
  at `apps/tv/app/index.tsx:365`: blue is the system's one informational colour
  and `JUST JOINED!` already owns it; the two share a slot, so both in blue would
  make the loudest thing on the grid ambiguous. **Do not "fix" this without
  answering that argument** — take it to the user as a design question.
- **`HOST` is bare orange text; the board draws a gold crown above the disc.**
  And `packages/ui/src/icons.ts:31` says the crown is kept because it is "a glyph
  *inside* the HOST chip" — a third account. At least one of the three is wrong.
- **The count line has no people glyph**, which the board leads with.

## How to run the TV app (the traps, in order)

```bash
cd apps/tv && EXPO_TV=1 LC_ALL=en_US.UTF-8 \
  REACT_NATIVE_NODE_MODULES_DIR="$PWD/node_modules" \
  npx expo run:ios --device 091BC127-357A-4104-8321-EE294BEF1311
```

- **A booted device is not a visible one.** `simctl` boots headlessly and needs
  no window; `open -a Simulator` is what makes it visible to a human. A user
  saying "I don't see the simulator" usually means exactly this.
- **Screenshot the Apple TV with `xcrun simctl io <udid> screenshot`.** The
  iOS-Simulator MCP cannot: tvOS presents its display as `TVOut` (screenID 2)
  and every MCP screenshot fails with `Could not find the Main Screen Surface`.
  `attach` *succeeds* and reports 1920×1080, which makes it look like a broken
  machine rather than a tvOS limitation. The MCP is fine for iPhone.
- **Ports:** TV is 8081, Controller 8082. `expo run:ios` silently skips starting
  its dev server if the port is busy and then bakes in whatever it built with.
- **Backend:** `convex/.env.local` must point `CONVEX_DEPLOYMENT` at
  `dev:colorful-viper-224`. It currently does. Without it, live verification is
  blocked — the Convex CLI here is in anonymous mode and `convex login` is an
  interactive flow a headless session cannot complete.
- **Seeding a room:** the TV mints its own room code on launch, so read the code
  off the screen first and seat into *that*:

```bash
cd convex && npx convex run players:joinRoom '{"code":"XXXX","nickname":"Sam","avatar":"fox"}'
```

  Avatar ids are the filename stems in `packages/ui/assets/avatars/`.

## Checks

Run the scripts CI runs, **by name**, from `.github/workflows/`: `pnpm
typecheck`, `pnpm lint`, `pnpm test:unit`, `pnpm test:integration`, `pnpm
validate:packs`. As of the final reconciliation: typecheck clean, **768 tests
pass across 65 files**.

`pnpm typecheck` is not `pnpm -r typecheck`. The root script is `tsc --noEmit &&
pnpm -r typecheck`, and the root half is the only thing covering files belonging
to no package (`eslint-rules/`, `test/`). Running only the recursive half left CI
red on eight consecutive commits once.

## Visual reconciliation completed (2026-08-09)

The six visual findings from this session are resolved in the implementation:

1. `huddle-tv-background-01.png` now covers the full viewport; only the
   1280×720 content layer is title-safe scaled, so no background border appears.
2. All ten avatars are regenerated from the authoritative square batch by the
   painted-disc crop pipeline; the exact source/runtime ID set is enforced and
   no pale outer ring remains.
3. Room code tiles and the QR use the warm `#FDFAF9` surface, and the caption
   uses neutral `#8A8E95` with semibold **Huddle** and the corrected “enter the
   code” invitation.
4. The Room uses the approved wordmark/title/hero/grid geometry and a centred
   5×2 layout that fits ten seats through content bottom 689.
5. The existing vector crown is gold above every Host avatar (including during
   `JUST JOINED!`), and the `player-count` vector leads the joined-player footer.
6. `AWAY` is the approved blue chip (`#EAF5FF` / `#2587C8`); phone roster away
   dots remain grey.

Android TV launcher artwork and the required Leanback metadata are also wired
   and verified by prebuild resource inspection. The Soft Minimal handoff and
   asset README record these decisions and exclude the unused 4K, Expo, circle,
   raster-badge, mobile-only, and Apple TV source files.

## Next action

The implementation and automated checks are complete. The remaining release
check is physical verification on the 75″ Philips Android TV: launcher artwork,
sofa-distance legibility, QR scanning, overscan/title-safe framing, full-bleed
background scaling, and the ten generated avatar crops.
