# Huddle runtime image assets

Artwork that ships **inside** the apps. Design references that must never reach a
bundle live in `docs/design/reference/` instead.

Source: the approved Soft Minimal asset package (`HUDDLE ASSETS`, 2026-08-08),
plus the cleaned avatar batch delivered the same day.

## Status: staged, not yet wired

Nothing here is imported by a screen. The Soft Minimal token swap is the change
that consumes it.

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
