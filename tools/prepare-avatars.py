#!/usr/bin/env python3
"""Turn a delivered avatar batch into the runtime assets in packages/ui/assets/avatars.

Usage:  python3 tools/prepare-avatars.py <batch-dir> [--check]

`<batch-dir>` is a delivered batch holding a `squares/` directory. With
`--check`, nothing is written and the script reports what it would change —
which is how the delivered art gets inspected without a round trip through git.

## Only the squares are used

A batch also ships `circles/`, and those files are not runtime assets. They are
1024x1536 portraits: the character sits on a pale disc but breaks out of it at
the shoulders and dissolves into a soft glow. The square files are the
authoritative source: each has an outer tile and a painted disc behind the
character. The runtime crop is measured from that inner disc rather than from
the tile or from the portrait exports.

## The black stroke

`mint-cat` (14px) and `teal-bear` (8px) ship with a pure-black stroke baked
around the rounded square that the other eight do not have. Left in, those two
carry a dark rim nothing else has, and a crop that reaches the tile edge picks
it up at the four points where it touches the edge.

It is removed by cropping the border away before the painted-disc bounds are
measured, not by recolouring and not by eroding the alpha. Recolouring leaves a
grey ghost, because the stroke is anti-aliased into the art beneath it. Eroding
the alpha does nothing at all here, which is worth stating because it looks like
the obvious fix: these squares are full-bleed, so along the flat edges the alpha
is already 255 out to the boundary and there is no transition for an erode to
bite on — it clears the rounded corners and leaves the four sides exactly as
black as they were.

Cropping costs the character growing by twice the stroke width relative to the
other eight: 2.4% at mint-cat's 14px, and less than that once 1254 becomes 640.

Detection is per-file and measured, not a hard-coded list of the two — a later
batch that fixes them needs no edit here, and one that introduces the stroke on
a third character is handled the same way.
"""

import math
import statistics
import sys
from pathlib import Path
from typing import Optional

from PIL import Image

# Large enough for every surface that draws an avatar: the phone's 173pt hero on
# the waiting screen is 519px at @3x, and a 72px TV seat is 216px on a 4K panel.
# The delivered 1254px is ~17MB across a batch for detail nothing can display.
RUNTIME_SIZE = 640

# Keep the delivered batch in lockstep with the runtime/game contract. A
# missing or renamed file must abort the whole regeneration rather than leave a
# plausible-looking but incomplete asset set behind.
AVATAR_IDS = (
    "fox",
    "green-alien",
    "pink-bunny",
    "blue-robot",
    "purple-owl",
    "yellow-robot",
    "red-robot",
    "teal-bear",
    "mint-cat",
    "puppy",
)

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

# The square exports contain a painted disc, but its edge is not encoded in
# alpha (the outer tile is opaque too). These bounds are therefore measured
# from colour transitions. The detector deliberately uses only deterministic
# scanlines and rejects a source when the transitions do not agree.
DISC_EDGE_THRESHOLD = 15.0
DISC_EDGE_MIN_RUN = 3
DISC_EDGE_WINDOW = 8
DISC_EDGE_GAP = 2
DISC_LINE_OFFSETS = (-0.06, -0.03, 0.0, 0.03, 0.06)
DISC_VERTICAL_FRACTIONS = (0.70, 0.75, 0.80)
DISC_MIN_RADIUS_RATIO = 0.12
DISC_MAX_RADIUS_RATIO = 0.49
DISC_ASPECT_TOLERANCE = 0.18
DISC_CENTER_TOLERANCE_RATIO = 0.04
DISC_EDGE_SPREAD_RATIO = 0.025


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


def _colour_mean(pixels) -> tuple[float, float, float]:
    count = len(pixels)
    return tuple(sum(pixel[index] for pixel in pixels) / count for index in range(3))


def _colour_distance(first, second) -> float:
    return math.sqrt(sum((first[index] - second[index]) ** 2 for index in range(3)))


def _edge_measure(
    image: Image.Image,
    axis: str,
    fixed: int,
    position: int,
    direction: int,
    window: int,
    gap: int,
) -> float:
    """Measure the colour change across one candidate edge position.

    `direction` points from the outer tile towards the centre. Pixels sampled
    on the negative side of that direction are the tile; pixels on the
    positive side are the painted disc (or artwork inside it).
    """
    pixels = image.load()
    outer = []
    inner = []
    for distance in range(gap + 1, gap + window + 1):
        outer_position = position - direction * distance
        inner_position = position + direction * distance
        if axis == "x":
            outer.append(pixels[outer_position, fixed][:3])
            inner.append(pixels[inner_position, fixed][:3])
        else:
            outer.append(pixels[fixed, outer_position][:3])
            inner.append(pixels[fixed, inner_position][:3])
    return _colour_distance(_colour_mean(outer), _colour_mean(inner))


def _edge_runs(values: list[tuple[int, float]]) -> list[tuple[int, float, int]]:
    """Return sustained colour transitions in outer-to-inner scan order."""
    transitions = []
    index = 0
    while index < len(values):
        if values[index][1] < DISC_EDGE_THRESHOLD:
            index += 1
            continue

        start = index
        while index + 1 < len(values) and values[index + 1][1] >= DISC_EDGE_THRESHOLD:
            index += 1
        length = index - start + 1
        if length >= DISC_EDGE_MIN_RUN:
            best_position, best_strength = max(values[start : index + 1], key=lambda item: item[1])
            transitions.append((best_position, best_strength, length))
        index += 1
    return transitions


def _scan_axis(image: Image.Image, axis: str, fixed: int, direction: int) -> list[tuple[int, float, int]]:
    """Scan from a tile edge towards the image midpoint for disc transitions."""
    size = image.width if axis == "x" else image.height
    midpoint = size // 2
    margin = max(12, round(size * 0.025))
    inner_margin = max(12, round(size * 0.025))
    window = max(3, round(DISC_EDGE_WINDOW * size / 1254))
    gap = max(1, round(DISC_EDGE_GAP * size / 1254))

    distances = range(margin, midpoint - inner_margin)
    positions = [distance if direction == 1 else size - 1 - distance for distance in distances]
    values = [
        (position, _edge_measure(image, axis, fixed, position, direction, window, gap))
        for position in positions
    ]
    return _edge_runs(values)


def _first_edge(
    image: Image.Image,
    axis: str,
    fixed: int,
    side: str,
    lower: Optional[float] = None,
    upper: Optional[float] = None,
) -> tuple[int, float, int]:
    direction = 1 if side in ("left", "top") else -1
    transitions = _scan_axis(image, axis, fixed, direction)
    for transition in transitions:
        position = transition[0]
        if lower is not None and position < lower:
            continue
        if upper is not None and position > upper:
            continue
        return transition
    qualifier = " in the expected range" if lower is not None or upper is not None else ""
    raise ValueError(f"painted-disc edge not found on {side} scan{qualifier}")


def crop_to_painted_disc(image: Image.Image):
    """Crop a square around the measured painted disc.

    The horizontal edges are measured on five nearby scanlines. Vertical edges
    are then measured on both sides of the character at three offsets and
    reconciled as an ellipse. A source with missing, scattered, asymmetric, or
    off-centre bounds raises `ValueError` instead of producing a guessed asset.
    """
    width, height = image.size
    if width != height:
        raise ValueError(f"source is {width}x{height}; the square batch must be square")

    midpoint = width // 2
    line_offsets = [round(width * ratio) for ratio in DISC_LINE_OFFSETS]
    horizontal = []
    horizontal_errors = []
    for offset in line_offsets:
        fixed = max(0, min(height - 1, midpoint + offset))
        try:
            left = _first_edge(image, "x", fixed, "left")
            right = _first_edge(image, "x", fixed, "right")
        except ValueError as error:
            horizontal_errors.append(str(error))
            continue
        horizontal.append((left[0], right[0]))

    minimum_support = max(3, (len(line_offsets) + 1) // 2)
    if len(horizontal) < minimum_support:
        detail = horizontal_errors[0] if horizontal_errors else "no scanlines qualified"
        raise ValueError(f"uncertain painted-disc bounds ({detail})")

    left_positions = [bounds[0] for bounds in horizontal]
    right_positions = [bounds[1] for bounds in horizontal]
    spread_limit = max(20.0, width * DISC_EDGE_SPREAD_RATIO)
    if max(left_positions) - min(left_positions) > spread_limit:
        raise ValueError("painted-disc left bound is inconsistent across scanlines")
    if max(right_positions) - min(right_positions) > spread_limit:
        raise ValueError("painted-disc right bound is inconsistent across scanlines")

    left = statistics.median(left_positions)
    right = statistics.median(right_positions)
    centre_x = (left + right) / 2
    radius_x = (right - left) / 2
    minimum_radius = max(16.0, width * DISC_MIN_RADIUS_RATIO)
    maximum_radius = width * DISC_MAX_RADIUS_RATIO
    if radius_x < minimum_radius or radius_x > maximum_radius:
        raise ValueError(f"painted-disc radius {radius_x:.1f}px is outside the expected range")

    centre_tolerance = max(24.0, width * DISC_CENTER_TOLERANCE_RATIO)
    if abs(centre_x - midpoint) > centre_tolerance:
        raise ValueError(
            f"painted-disc centre x={centre_x:.1f}px is too far from the square midpoint"
        )

    # The outer tile can have its own edge (the yellow robot is the clear
    # example). Limit vertical candidates to the radius band implied by the
    # horizontal disc, which also keeps character details out of the estimate.
    minimum_distance = radius_x * 0.30
    maximum_distance = radius_x * 1.20
    vertical = []
    for fraction in DISC_VERTICAL_FRACTIONS:
        offset = fraction * radius_x
        for sign in (-1, 1):
            fixed = round(centre_x + sign * offset)
            top_lower = midpoint - maximum_distance
            top_upper = midpoint - minimum_distance
            bottom_lower = midpoint + minimum_distance
            bottom_upper = midpoint + maximum_distance
            try:
                top = _first_edge(image, "y", fixed, "top", top_lower, top_upper)
                bottom = _first_edge(image, "y", fixed, "bottom", bottom_lower, bottom_upper)
            except ValueError:
                continue
            scale = math.sqrt(1 - fraction**2)
            vertical.append(
                {
                    "fraction": fraction,
                    "top": top[0],
                    "bottom": bottom[0],
                    "centre": (top[0] + bottom[0]) / 2,
                    "radius": (bottom[0] - top[0]) / (2 * scale),
                }
            )

    if len(vertical) < max(4, len(DISC_VERTICAL_FRACTIONS)):
        raise ValueError("uncertain painted-disc bounds on vertical scanlines")

    vertical_centres = [entry["centre"] for entry in vertical]
    vertical_radii = [entry["radius"] for entry in vertical]
    if max(vertical_centres) - min(vertical_centres) > spread_limit:
        raise ValueError("painted-disc vertical centre is inconsistent across scanlines")
    if max(vertical_radii) - min(vertical_radii) > spread_limit:
        raise ValueError("painted-disc vertical radius is inconsistent across scanlines")

    centre_y = statistics.median(vertical_centres)
    radius_y = statistics.median(vertical_radii)
    if abs(centre_y - midpoint) > centre_tolerance:
        raise ValueError(
            f"painted-disc centre y={centre_y:.1f}px is too far from the square midpoint"
        )
    if radius_y < minimum_radius or radius_y > maximum_radius:
        raise ValueError(f"painted-disc vertical radius {radius_y:.1f}px is outside the expected range")

    aspect_delta = abs(radius_x - radius_y) / max(radius_x, radius_y)
    if aspect_delta > DISC_ASPECT_TOLERANCE:
        raise ValueError("painted-disc bounds are too elliptical to crop deterministically")

    side = math.ceil(2 * max(radius_x, radius_y)) + 2
    origin_x = round(centre_x - side / 2)
    origin_y = round(centre_y - side / 2)
    end_x = origin_x + side
    end_y = origin_y + side
    if origin_x < 0 or origin_y < 0 or end_x > width or end_y > height:
        raise ValueError("painted-disc crop would extend beyond the source square")

    bounds = {
        "left": left,
        "top": centre_y - side / 2,
        "right": right,
        "bottom": centre_y + side / 2,
        "centre_x": centre_x,
        "centre_y": centre_y,
        "side": side,
    }
    return image.crop((origin_x, origin_y, end_x, end_y)), bounds


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

    files = sorted(squares.glob("*-square.png"))
    if not files:
        print(f"no *-square.png in {squares}")
        return 1

    delivered_ids = {source.name.removesuffix("-square.png") for source in files}
    expected_ids = set(AVATAR_IDS)
    missing_ids = [avatar_id for avatar_id in AVATAR_IDS if avatar_id not in delivered_ids]
    extra_ids = sorted(delivered_ids - expected_ids)
    if missing_ids or extra_ids:
        details = []
        if missing_ids:
            details.append(f"missing: {', '.join(missing_ids)}")
        if extra_ids:
            details.append(f"extra: {', '.join(extra_ids)}")
        print(f"avatar batch IDs do not match AVATAR_IDS ({'; '.join(details)})", file=sys.stderr)
        return 1

    files = [squares / f"{avatar_id}-square.png" for avatar_id in AVATAR_IDS]

    destination = Path(__file__).resolve().parent.parent / "packages/ui/assets/avatars"
    prepared = []
    for source in files:
        name = source.name.removesuffix("-square.png")
        try:
            image = Image.open(source).convert("RGBA")
            stroke = stroke_width(image)
            if stroke:
                image = trim_border(image, stroke + 1)
            cropped, bounds = crop_to_painted_disc(image)
        except (OSError, ValueError) as error:
            print(f"{source.name}: {error}", file=sys.stderr)
            return 1

        image = cropped.resize((RUNTIME_SIZE, RUNTIME_SIZE), Image.LANCZOS)
        prepared.append((name, image, stroke, bounds))

    if not check:
        destination.mkdir(parents=True, exist_ok=True)

    for name, image, stroke, bounds in prepared:
        target = destination / f"{name}.png"
        note = f"trimmed {stroke}px black stroke" if stroke else "clean"
        if check:
            print(
                f"{name:14} {note:26} disc "
                f"centre=({bounds['centre_x']:.1f},{bounds['centre_y']:.1f}) "
                f"crop={bounds['side']}px"
            )
        else:
            image.save(target, optimize=True)
            size_kb = target.stat().st_size // 1024
            print(
                f"{name:14} {note:26} disc {bounds['side']}px "
                f"-> {target.name} ({size_kb}KB)"
            )

    print(f"\n{len(files)} avatars at {RUNTIME_SIZE}x{RUNTIME_SIZE}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
