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

**It was not adopted because nobody had seen it drawn.** That is now partly
answered — see below — but the call is still open and it is the user's.

## The simulator run (2026-08-09) — what it established

The TV app was built and run on the Apple TV 4K (3rd gen, at 1080p) simulator,
udid `091BC127-357A-4104-8321-EE294BEF1311`, against the cloud dev deployment.

**Newly proven, having never been verified for this app before:**

- **`pod install` succeeds with `react-native-svg` in the TV app.** There was no
  `Podfile.lock` and no `Pods/`, so everything compiled from scratch: Build
  Succeeded, installed, launched. This is the gate `expo export` cannot run — it
  bundles JavaScript and never touches CocoaPods.
- **The TV background artwork renders as the canvas.** Plants and edge
  decoration, inset with the content by the title-safe transform. The binary
  already resident on the device predated that wiring and drew flat off-white,
  which is worth knowing because it looks like a regression and is not.

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
validate:packs`. As of the last commit: typecheck clean, **764 tests pass across
64 files**.

`pnpm typecheck` is not `pnpm -r typecheck`. The root script is `tsc --noEmit &&
pnpm -r typecheck`, and the root half is the only thing covering files belonging
to no package (`eslint-rules/`, `test/`). Running only the recursive half left CI
red on eight consecutive commits once.

## Next action

The user's call, in this order of confidence:

1. **Fix the three non-geometry deltas** — crown, count-line glyph, AWAY colour.
   These are unambiguous: the board, the code and `icons.ts`'s own comment
   disagree with each other, so at least one is wrong regardless of which board
   wins.
2. **Decide the geometry.** The suggested test is to build the Room screen at
   the board's numbers on a branch and compare the two on the user's actual
   television — a 75" Philips Android TV, which they have. A 70pt disc against
   an 88pt one is a sofa-distance judgment, not a measurement.
3. Note for that test: the TV backgrounds are 1672×941 bitmaps and will upscale
   ~2.3× on a 4K panel. Everything drawn in code is resolution-independent; that
   one image is the exception, and a 75" panel is where it will show.
