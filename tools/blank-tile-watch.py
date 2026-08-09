#!/usr/bin/env python3
"""Catch the blank Room Code tile on tvOS.

The plan's task says: don't start from a theory, start by catching it. So this
does cold launch -> screenshot -> decide, and keeps only the frames that look
wrong. It reports per-tile ink coverage so a hole is a number, not a judgement
of a thumbnail.

A Room Code tile is a white rounded card on the TV's Room screen. A drawn letter
covers a few percent of the card in navy; a blank tile is white all the way
across. We find the four cards by scanning for wide white runs on the tile row,
then measure non-white coverage inside each.

Usage:

    blank-tile-watch.py [runs] [--keep LABEL]

`--keep` is the A/B mode the task's AC asks for: every launch keeps the *same*
fixed crop of the tile row — the same pixel rectangle before and after a fix,
since the fix is not allowed to move the row — under `blank-watch/LABEL-NN.png`,
whether or not the frame was judged blank. Run it either side of the change and
compare the crops and the per-tile numbers, rather than trusting one screenshot
that looks right.

It also reports the tile boxes *before* the code arrives beside the boxes after,
which is the no-reflow check: the tiles are drawn empty so the screen does not
move when the code lands, and `pre==post` is that claim measured.
"""

import subprocess
import sys
import time
from pathlib import Path

from PIL import Image

TV_UDID = "071FB022-581E-4454-94FF-7F10727D5B81"
BUNDLE = "tv.huddle.hub"
OUT = Path(__file__).parent / "blank-watch"

# The tile row, as a fraction of the tvOS frame.
#
# Retuned for Soft Minimal's Room screen, where the tiles are 84x84 high on the
# screen rather than Boardwalk's 148x176 in the middle of it. The old band
# (0.36-0.60) sits entirely below the new row, so this tool had quietly stopped
# finding any tiles at all and would have reported "not the pairing screen?"
# forever while claiming to guard the blank-`I` regression.
#
# The band is deliberately loose, because two frames have to fall inside it: this
# branch draws the stage edge to edge, while `main` insets the whole composition
# to the title-safe inner 90% (`tvSafeStageScale`), which pulls every fraction
# 10% toward the centre. The tiles land at 0.17-0.29 of the frame uninset and
# 0.20-0.33 inset; 0.14-0.36 holds both. The right edge stops short of the QR
# card, which is white too and would otherwise read as a fifth tile.
ROW_TOP, ROW_BOTTOM = 0.14, 0.36
ROW_LEFT, ROW_RIGHT = 0.24, 0.63

# A drawn letter covers ~20% of its tile — the glyph shrank less than the tile
# did, so coverage went up from Boardwalk's ~16% — and an empty tile keeps only
# its hairline border, well under 3% now that the border is warm grey rather
# than 4px of ink. Anything under this is a hole.
#
# Unlike the numbers above, this threshold has not been re-verified against a
# synthetically blanked frame since the retune; it is derived from the tile and
# glyph sizes. It is also further from both populations than it was before, so
# the arithmetic erring would have to be large to matter.
BLANK_BELOW = 0.08


def is_white(p):
    return p[0] > 235 and p[1] > 232 and p[2] > 225


def tiles_in(img):
    """Bounding boxes of the white tile cards on the code row."""
    w, h = img.size
    px = img.load()
    y0, y1 = int(h * ROW_TOP), int(h * ROW_BOTTOM)
    x0, x1 = int(w * ROW_LEFT), int(w * ROW_RIGHT)
    # Scan above the glyphs, not through them: on the middle line a letter
    # splits its own tile into two short white runs and the width filter then
    # throws both away.
    mid = y0 + (y1 - y0) // 6

    runs, start = [], None
    for x in range(x0, x1):
        white = is_white(px[x, mid])
        if white and start is None:
            start = x
        elif not white and start is not None:
            if x - start > w * 0.04:  # a tile is wide; ignore specks
                runs.append((start, x))
            start = None
    if start is not None and x1 - start > w * 0.04:
        runs.append((start, x1))
    return [(a, y0, b, y1) for a, b in runs]


def ink_fraction(img, box):
    """Share of non-white pixels inside a tile — the drawn letter."""
    a, y0, b, y1 = box
    px = img.load()
    total = ink = 0
    for y in range(y0, y1, 2):
        for x in range(a, b, 2):
            total += 1
            if not is_white(px[x, y]):
                ink += 1
    return ink / total if total else 0.0


def row_crop(img):
    """The tile row as a fixed rectangle — the same pixels in every frame."""
    w, h = img.size
    return img.crop((int(w * ROW_LEFT), int(h * ROW_TOP),
                     int(w * ROW_RIGHT), int(h * ROW_BOTTOM)))


def one_launch(n, keep=None):
    subprocess.run(["xcrun", "simctl", "terminate", TV_UDID, BUNDLE],
                   capture_output=True)
    time.sleep(1)
    subprocess.run(["xcrun", "simctl", "launch", TV_UDID, BUNDLE],
                   capture_output=True)

    OUT.mkdir(exist_ok=True)
    shot = OUT / f"launch-{n:03d}.png"

    # Wait for the pairing screen to actually arrive. A dev build refetches its
    # bundle on every cold launch, and a white loading screen reads as one
    # enormous "tile" — which is a measurement failure, not a blank tile. Judge
    # only once four cards are on screen.
    # The four white cards paint before the glyphs inside them, so "four cards
    # are present" is NOT settled — it catches a mid-paint frame where every
    # tile reads empty. Wait for two consecutive readings to agree instead. A
    # genuinely blank tile is stable and still reported; a half-drawn frame is
    # not, and gets another look.
    img, boxes, inks, last, pre_boxes = None, [], [], None, None
    deadline = time.time() + 45
    while time.time() < deadline:
        time.sleep(2)
        subprocess.run(["xcrun", "simctl", "io", TV_UDID, "screenshot", str(shot)],
                       capture_output=True)
        if not shot.exists():
            continue
        img = Image.open(shot).convert("RGB")
        boxes = tiles_in(img)
        if len(boxes) != 4:
            last = None
            continue
        inks = [ink_fraction(img, b) for b in boxes]
        # All four empty is the room code not having arrived yet — the QR card
        # is empty in those frames too. That is a legitimate waiting state, not
        # a hole, so keep waiting rather than reporting four blanks. It is also
        # the frame the no-reflow check wants: where the tiles sat before the
        # code landed.
        if all(f < BLANK_BELOW for f in inks):
            if pre_boxes is None:
                pre_boxes = boxes
            last = None
            continue
        rounded = [round(f, 3) for f in inks]
        if last is not None and rounded == last:
            break
        last = rounded

    if img is None:
        print(f"{n:3d}  SCREENSHOT FAILED")
        return False
    inks = [ink_fraction(img, b) for b in boxes]
    blanks = [i for i, f in enumerate(inks) if f < BLANK_BELOW]

    pretty = " ".join(f"{f*100:5.2f}%" for f in inks)
    reflow = ""
    if pre_boxes is not None and len(boxes) == 4:
        moved = [i for i in range(4) if pre_boxes[i] != boxes[i]]
        reflow = "  row moved: " + str(moved) if moved else "  row held"
    if keep is not None:
        crop = OUT / f"{keep}-{n:02d}.png"
        row_crop(img).save(crop)
        pretty += f"  {crop.name}"

    if len(boxes) != 4:
        print(f"{n:3d}  tiles={len(boxes)} (not the pairing screen?)  {pretty}")
        shot.unlink(missing_ok=True)
        return False
    if blanks:
        print(f"{n:3d}  *** BLANK TILE at {blanks} ***  {pretty}{reflow}  KEPT {shot.name}")
        return True
    print(f"{n:3d}  ok   {pretty}{reflow}")
    shot.unlink(missing_ok=True)
    return False


if __name__ == "__main__":
    args = sys.argv[1:]
    keep = None
    if "--keep" in args:
        at = args.index("--keep")
        if at + 1 >= len(args):
            sys.exit("--keep needs a label: blank-tile-watch.py [runs] --keep before-900")
        keep = args[at + 1]
        args = args[:at] + args[at + 2:]
    runs = int(args[0]) if args else 10

    caught = 0
    for n in range(1, runs + 1):
        if one_launch(n, keep=keep):
            caught += 1
    print(f"\n{runs} launches, {caught} with a blank tile.")
