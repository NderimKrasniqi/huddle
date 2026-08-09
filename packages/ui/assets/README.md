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

Ten characters, generated from the authoritative
`HUDDLE ASSETS/avatars/squares/` batch by `tools/prepare-avatars.py` — which
documents the transform and can be re-run when a further batch arrives:

```bash
python3 tools/prepare-avatars.py <batch-dir>
```

One 640×640 RGBA file per character. The filename stem is the avatar's stable
id — the value stored on a player, so it may never be renamed once a room has
used it. The batch must contain exactly these ids: `fox`, `green-alien`,
`pink-bunny`, `blue-robot`, `purple-owl`, `yellow-robot`, `red-robot`,
`teal-bear`, `mint-cat`, and `puppy`.

### One asset, two shapes

The `squares/` files are authoritative; the delivered `circles/` files are not
used. Those 1024×1536 portraits vary in framing and glow between characters,
so masking them to a circle produces inconsistent crops and can expose their
outer field.

Each square is first measured for its centred painted disc. The preparation
script trims any baked black rim, rejects uncertain or off-centre bounds, crops
to the disc, and only then resizes to 640×640. Runtime rendering may round the
result with `borderRadius: size / 2`, but it no longer reveals a pale outer ring.
The script stages the complete batch before writing, so an invalid source never
partially replaces the runtime set.

**Do not commission more circle art or import the Expo-pack avatar crops.**
Neither source is part of the runtime batch.

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
different sizes. `crown.svg` *is* kept — it is the gold glyph rendered above a
Host avatar, not a bitmap badge.

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
`huddle-tv-background-01.png` renders full-viewport with `cover`, so the artwork
reaches every edge. `TvStage` applies `tvSafeStageScale` only to its 1280×720
content layer; `colors.screen` remains the loading fallback. On a non-16:9
panel, `cover` crops decorative edges rather than stretching the composition.

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

The mobile app configs reference the appropriate light/dark and Android icon
assets. Android TV additionally uses the supplied `huddle-android-tv-icon.png`
(1024²) and `huddle-android-tv-banner.png` (640×360) through
`@react-native-tvos/config-tv` with `androidTVRequired: true`; `expo prebuild`
verifies their generated resources and Leanback launcher metadata. Apple TV
remains a simulator target and has no separate production artwork wired here.

## `logo/`

The wordmark and symbol, transparent, in exact token colors:

| File | Content |
|---|---|
| `huddle-logo-light.png` | 1327×360, orange symbol + `#0F172A` wordmark, for light surfaces |
| `huddle-logo-dark.png` | 1327×360, orange symbol + `#FFF7F2` wordmark, for dark surfaces |
| `huddle-symbol-orange.png` | 1200×1234, standalone `#FF6B4A` symbol |

These replace the earlier drawn `HUDDLE.` wordmark Soft Minimal set in Bungee — §5 of the
handoff is explicit that the wordmark should use supplied artwork rather than be
recreated from a text font, which also means the wordmark does not depend on the
unresolved font decision.
