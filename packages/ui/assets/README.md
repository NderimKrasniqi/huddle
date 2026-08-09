# Huddle runtime image assets

Artwork that ships **inside** the apps. Design references that must never reach a
bundle live in `docs/design/reference/` instead.

Source: the approved Soft Minimal asset package (`HUDDLE ASSETS`, 2026-08-08),
plus the cleaned avatar batch delivered the same day.

## Status: wired

`avatars/`, `logo/`, `tv-backgrounds/` and `app-icons/` are all consumed by the
apps and proved through `expo export` / `expo prebuild`. `icons/` is consumed
differently — see its own section, which is the one folder here that is not a
bundle input. `game-art/` is the only set still staged, and only in part: it has
art for two games that do not exist and none for one that does.

## `avatars/`

Ten characters, generated from the delivered batch by
`tools/prepare-avatars.py` — which documents the transform and can be re-run
when a further batch arrives:

```bash
python3 tools/prepare-avatars.py <batch-dir>
```

One 640×640 file per character. The filename stem is the avatar's stable id —
the value stored on a player, so it may never be renamed once a room has used
it.

### One asset, two shapes

A batch ships `squares/` and `circles/`. **Only the squares are used.** The
delivered circles are 1024×1536 portraits where the character breaks out of the
disc at the shoulders and dissolves into a glow, with the disc's diameter and
centre drifting ~80px across characters — masking one to a circle cuts the body
at a different place for every avatar.

The square does not have that problem, and its background is already the
character's own colour family, so the circular avatar is just the square under
`borderRadius: size / 2`. That satisfies §9's "no white border" for free and
removes any way for the two shapes to drift apart.

**Do not commission more circle art.** It is not used.

### Fixed in the pipeline

`mint-cat` (14px) and `teal-bear` (8px) shipped with a pure-black stroke baked
around the rounded square that the other eight do not have. The script detects
and trims it per-file, so a later batch that fixes it upstream needs no change
here.

### Outstanding — needs re-art

**`yellow-robot`'s background is `#FAF6F2`**, which is the `#FFF7F2` canvas.
Every other avatar has a clearly tinted disc; this one has none, so on the TV
player strip and in the picker it reads as a robot floating with no avatar
behind it. It needs a pale yellow background in the character's own colour
family, like the other nine.

**Ten characters is exactly `ROOM_PLAYER_CAP`.** Avatars are exclusive, so a
full room consumes every one and the tenth player to join gets no choice at all.
Twelve is the target. The delivered batch README refers to a `batch-2/`, which
was not in the folder.

## `icons/`

The UI icon set (`Huddle UI Icons — Single Files`, 2026-08-09). **SVG sources
only**, and they are not loaded at runtime: `packages/ui/src/icons.ts`
transcribes each one's geometry into TypeScript, `native/icon.tsx` draws it with
`react-native-svg`, and `icons.test.ts` parses these files and fails if the two
ever disagree. So the files here are the provenance record and the thing the
test checks against, not a bundle input — the only folder under `assets/` that
works that way, which is why it says so.

One drawing per icon, at any size and in any colour. The package also delivered
each icon as a PNG twice — `dark/` for light surfaces and `white/` for coloured
ones — and **neither set was taken**: two rasters would be two things to keep in
step and still wrong on the third surface, where a path is sharp at 14pt on a
phone and 48pt on a television and takes its colour from a token at the call
site.

### Deliberately not taken

`badge_host.svg`, `badge_just-joined.svg` and the three status dots
(`online-dot`, `away-dot`, `coral-dot`) were delivered and are **not** here. A
badge is a bordered chip with a word in it and a dot is a filled circle; both
are drawn as ordinary React Native views so they scale with their own text and
take their colour from the palette. Shipping them as artwork would bake a font,
a radius and a colour into a bitmap that the phone and the television need at
different sizes. `crown.svg` *is* kept — it is a glyph inside the HOST chip, not
the chip.

## `game-art/`

Full-bleed 1254×1254, no alpha — matches §10 and needs no rework.

`trivia.png` maps to the built `trivia` module. `drawing.png` (Draw Battle) and
`word-game.png` (Word Sneak) have no game behind them, and the built `voting`
module has no art.

One consistency note, not a defect: these are photoreal 3D renders, where the
avatars and TV backgrounds are flat illustration. The two do not currently read
as one language.

## `tv-backgrounds/`

1672×941 (16:9), no alpha, clear centre with decoration at the edges per §11.

**This is the TV canvas**, on every TV screen — not decoration layered over one.
It replaces the solid `colors.screen` fill in `TvStage` and scales with the
stage. The letterbox bars a non-16:9 window leaves stay a solid warm off-white;
stretching a 16:9 composition into them would draw a second pair of plants.

`-01` is warmer, `-02` cooler and greyer. `-01` is the default for both screens
until the assignment is settled — see the handoff.

Their base is `#FAF1E9` / `#F8F1EA` rather than the `#FFF7F2` canvas token,
which is why nothing composites them over a fill: close enough to read as a
mistake, far enough apart to show a seam. 1672px also upscales soft on a 4K
panel; the TV design surface is 1280×720, so it holds for now.

## `app-icons/`

The production set, replacing the four staged earlier — those baked a corner
radius over a black or white surround and would have rendered with dark or pale
corners on the home screen. These are correct and verified:

| File | Check |
|---|---|
| `huddle-app-icon-light.png` | 1024², full-bleed `#FFF7F2`, no baked radius |
| `huddle-app-icon-dark.png` | 1024², full-bleed `#0F172A`, no baked radius |
| `huddle-android-legacy.png` | 1024², full-bleed `#FFF7F2` |
| `huddle-android-adaptive-foreground.png` | 1024², transparent, content at 49% of canvas |
| `huddle-android-monochrome.png` | 1024², transparent, Android 13+ themed icon |

Both backgrounds are the exact palette tokens, and the adaptive foreground sits
well inside Android's 66% safe zone, so the OS mask cannot clip the symbol.
**The Android adaptive background is `#FFF7F2`** — set it alongside the
foreground, since the foreground alone is transparent.

Not yet referenced by either `app.json`. One thing to settle when wiring: Expo
resolves `icon` relative to the app directory, so these need
`../../packages/ui/assets/…`, which reaches outside the app's project root.
Worth a `prebuild` before trusting it.

## `logo/`

The wordmark and symbol, transparent, in exact token colors:

| File | Content |
|---|---|
| `huddle-logo-light.png` | 1327×360, orange symbol + `#0F172A` wordmark, for light surfaces |
| `huddle-logo-dark.png` | 1327×360, orange symbol + `#FFF7F2` wordmark, for dark surfaces |
| `huddle-symbol-orange.png` | 1200×1234, standalone `#FF6B4A` symbol |

These replace the drawn `HUDDLE.` wordmark Boardwalk sets in Bungee — §5 of the
handoff is explicit that the wordmark should use supplied artwork rather than be
recreated from a text font, which also means the wordmark does not depend on the
unresolved font decision.
