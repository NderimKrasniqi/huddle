# Huddle runtime image assets

Artwork that ships **inside** the apps. Design references that must never reach a
bundle live in `docs/design/reference/` instead.

Source: the approved Soft Minimal asset package (`HUDDLE ASSETS`, 2026-08-08).
Files are committed at the resolution they were delivered at.

## Status: staged, not yet wired

Nothing here is imported by a screen yet. The Soft Minimal token swap is the
change that consumes it. Two directories additionally need **regenerated art**
before they can be used at all — see the defects below.

## `avatars/`

Per `docs/design/soft-minimal/HANDOFF-SOURCE.md` §9, each character ships twice:
a square asset for phone pickers and roster rows, a circular one for player
presence and the TV strip.

Naming is `<character>-<square|circle>.png`, and the character segment is the
avatar's stable id — the value stored on a player, so it may never be renamed
once a room has used it.

**Defect — the delivered five are not usable as-is:**

1. The `-circle` files are 1024×1536 portrait illustrations with a soft radial
   glow, transparent to the frame edge on all five. There is no circular cutout
   to mask; a round frame crops the character's body or letterboxes it.
2. `-square` framing is inconsistent: the art inset is 0px on bunny and fox,
   9px on alien, ~20px on purple-owl and 38px on blue-robot, so characters sit
   at visibly different scales in a grid. Corners are opaque `#FDFDFD`, which
   reads as pale wedges against the `#FFF7F2` canvas, and the corner radius is
   baked into the pixels rather than tracking the `radius` token.
3. Only five characters exist. `ROOM_PLAYER_CAP` is 10 and avatars are
   exclusive, so a full room needs at least 10 — 12 is the target, which is
   also a clean 4×3 picker grid.
4. 17MB for five characters. The largest rendered size is the 128px hero on the
   waiting screen, so 512×512 is ample.

Required spec for the full set of 12:

| | Square | Circle |
|---|---|---|
| Canvas | 512×512 | 512×512 |
| Bleed | full, all four edges | character on a centred disc touching all edges |
| Alpha | none | transparent outside the disc, no white ring |
| Radius | none — the UI applies it | n/a |
| Framing | identical across the set: head centred, same cap height, shoulders cropped at the bottom edge |

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
`-01` is warmer, `-02` cooler and greyer.

Their base is `#FAF1E9` / `#F8F1EA` — **not** the `#FFF7F2` canvas token. Use
the image as the TV canvas rather than compositing it over a solid fill, or the
seam will show. 1672px also upscales soft on a 4K panel; the TV design surface
is 1280×720, so it holds for now.

## `app-icons/`

**Defect — none of the four are shippable.** iOS and Android want a full-bleed
square with no baked corner radius; the OS applies the mask. All four bake in a
rounded rect and surround it:

| File | Surround |
|---|---|
| `huddle-app-icon-dark.png` | pure black `#000000` |
| `huddle-app-icon-light-01.png` | pure black `#000000`, icon floats with a drop shadow |
| `huddle-app-icon-light-02.png` | near-white `#FDFDFE` |
| `huddle-app-icon-light-03.png` | near-white `#FDFEFE` |

Shipped as-is, each renders with dark or pale corners on the home screen. They
are staged here for reference until regenerated as 1024×1024 full-bleed with no
radius. Neither `app.json` references them.
