#!/usr/bin/env python3
"""Turn a delivered avatar batch into the runtime assets in packages/ui/assets/avatars.

Usage:  python3 tools/prepare-avatars.py <batch-dir> [--check]

`<batch-dir>` is a delivered batch holding a `squares/` directory. With
`--check`, nothing is written and the script reports what it would change —
which is how the delivered art gets inspected without a round trip through git.

## Only the squares are used

A batch also ships `circles/`, and those files are not runtime assets. They are
1024x1536 portraits: the character sits on a pale disc but breaks out of it at
the shoulders and dissolves into a soft glow, and the disc's diameter and centre
drift by ~80px across characters. Masking one to a circle cuts the body on a
hard edge at a different place for every avatar.

The square asset does not have that problem. It is full-bleed, the character is
framed identically across the set, and the background is already the character's
own colour family — so a circle inscribed in it is a better circular avatar than
the delivered circle, and it is one the UI can produce with `borderRadius`
alone. One asset, two shapes, and no way for the two to drift apart.

## The black stroke

`mint-cat` (14px) and `teal-bear` (8px) ship with a pure-black stroke baked
around the rounded square that the other eight do not have. Left in, those two
carry a dark rim nothing else has, and an inscribed circle picks it up at the
four points where it touches the edge.

It is removed by cropping the border away, not by recolouring and not by
eroding the alpha. Recolouring leaves a grey ghost, because the stroke is
anti-aliased into the art beneath it. Eroding the alpha does nothing at all
here, which is worth stating because it looks like the obvious fix: these
squares are full-bleed, so along the flat edges the alpha is already 255 out to
the boundary and there is no transition for an erode to bite on — it clears the
rounded corners and leaves the four sides exactly as black as they were.

Cropping costs the character growing by twice the stroke width relative to the
other eight: 2.4% at mint-cat's 14px, and less than that once 1254 becomes 640.

Detection is per-file and measured, not a hard-coded list of the two — a later
batch that fixes them needs no edit here, and one that introduces the stroke on
a third character is handled the same way.
"""

import sys
from pathlib import Path

from PIL import Image

# Large enough for every surface that draws an avatar: the phone's 173pt hero on
# the waiting screen is 519px at @3x, and a 72px TV seat is 216px on a 4K panel.
# The delivered 1254px is ~17MB across a batch for detail nothing can display.
RUNTIME_SIZE = 640

# A pixel belongs to a baked stroke if it is opaque and very dark. The art
# itself gets nowhere near this at the tile edge — the lightest background in
# the set measures 220 and the darkest 221.
DARK_LUMA = 90
OPAQUE = 200

# A stroke is a thin rim at 1254 — the widest measured is mint-cat's 14px. Past
# this a "run" is the artwork itself, and eroding would eat into the character.
# An over-limit run raises rather than reporting the file clean: the first
# version of this guard returned 0, which quietly passed mint-cat's 14px stroke
# through as if it had none.
MAX_STROKE = 24


def luma(pixel) -> float:
    r, g, b = pixel[:3]
    return 0.299 * r + 0.587 * g + 0.114 * b


def stroke_width(image: Image.Image) -> int:
    """How many px of baked dark stroke line the opaque edge, 0 if none.

    Probed from all four sides at the midpoint, taking the widest run: the
    stroke follows a rounded rect, so a side can be clear where another is not.
    """
    alpha = image.getchannel("A")
    width, height = image.size
    widest = 0

    def run(start, step) -> int:
        x, y = start
        dx, dy = step
        count = 0
        while 0 <= x < width and 0 <= y < height and count <= MAX_STROKE + 1:
            if alpha.getpixel((x, y)) <= OPAQUE:
                # Still outside the shape — walk on without counting.
                if count:
                    break
            elif luma(image.getpixel((x, y))) < DARK_LUMA:
                count += 1
            else:
                break
            x, y = x + dx, y + dy
        return count

    mid_x, mid_y = width // 2, height // 2
    for start, step in (
        ((0, mid_y), (1, 0)),
        ((width - 1, mid_y), (-1, 0)),
        ((mid_x, 0), (0, 1)),
        ((mid_x, height - 1), (0, -1)),
    ):
        widest = max(widest, run(start, step))

    if widest > MAX_STROKE:
        raise ValueError(
            f"dark run of {widest}px exceeds the {MAX_STROKE}px stroke limit — "
            "this is artwork, not a baked rim, and eroding it would cut into "
            "the character. Inspect the file before raising the limit."
        )

    return widest


def trim_border(image: Image.Image, amount: int) -> Image.Image:
    """Crop `amount` px off all four sides, taking the baked stroke with it."""
    width, height = image.size
    return image.crop((amount, amount, width - amount, height - amount))


def main() -> int:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    check = "--check" in sys.argv

    if len(args) != 1:
        print(__doc__)
        return 2

    squares = Path(args[0]) / "squares"
    if not squares.is_dir():
        print(f"no squares/ directory under {args[0]}")
        return 1

    destination = Path(__file__).resolve().parent.parent / "packages/ui/assets/avatars"
    if not check:
        destination.mkdir(parents=True, exist_ok=True)

    files = sorted(squares.glob("*-square.png"))
    if not files:
        print(f"no *-square.png in {squares}")
        return 1

    for source in files:
        name = source.name.removesuffix("-square.png")
        image = Image.open(source).convert("RGBA")
        stroke = stroke_width(image)

        if stroke:
            image = trim_border(image, stroke + 1)

        image = image.resize((RUNTIME_SIZE, RUNTIME_SIZE), Image.LANCZOS)
        target = destination / f"{name}.png"

        note = f"trimmed {stroke}px black stroke" if stroke else "clean"
        if check:
            print(f"{name:14} {note}")
        else:
            image.save(target, optimize=True)
            size_kb = target.stat().st_size // 1024
            print(f"{name:14} {note:26} -> {target.name} ({size_kb}KB)")

    print(f"\n{len(files)} avatars at {RUNTIME_SIZE}x{RUNTIME_SIZE}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
