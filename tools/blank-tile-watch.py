#!/usr/bin/env python3
"""Catch the blank Room Code tile on tvOS.

The plan's task says: don't start from a theory, start by catching it. So this
does cold launch -> screenshot -> decide, and keeps only the frames that look
wrong. It reports per-tile ink coverage so a hole is a number, not a judgement
of a thumbnail.

A Room Code tile is a white rounded card on the pairing screen. A drawn letter
covers a few percent of the card in a saturated accent colour; a blank tile is
white all the way across. We find the four cards by scanning for wide white
runs on the tile row, then measure non-white coverage inside each.
"""

import subprocess
import sys
import time
from pathlib import Path

from PIL import Image

TV_UDID = "071FB022-581E-4454-94FF-7F10727D5B81"
BUNDLE = "tv.huddle.hub"
OUT = Path(__file__).parent / "blank-watch"

# The tile row, as a fraction of the 3840x2160 tvOS frame. Taken from a known
# good pairing screenshot: tiles occupy roughly the middle third vertically and
# the left half horizontally, beside the QR card.
ROW_TOP, ROW_BOTTOM = 0.36, 0.60
ROW_LEFT, ROW_RIGHT = 0.10, 0.65

# A drawn letter covers ~16% of its tile; an empty tile keeps only its border,
# ~3%. Anything under this is a hole. Calibrated on a real pairing frame and a
# synthetically blanked copy of it, so the detector is known to fire.
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


def one_launch(n):
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
    img, boxes, inks, last = None, [], [], None
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
        # a hole, so keep waiting rather than reporting four blanks.
        if all(f < BLANK_BELOW for f in inks):
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
    if len(boxes) != 4:
        print(f"{n:3d}  tiles={len(boxes)} (not the pairing screen?)  {pretty}")
        shot.unlink(missing_ok=True)
        return False
    if blanks:
        print(f"{n:3d}  *** BLANK TILE at {blanks} ***  {pretty}  KEPT {shot.name}")
        return True
    print(f"{n:3d}  ok   {pretty}")
    shot.unlink(missing_ok=True)
    return False


if __name__ == "__main__":
    runs = int(sys.argv[1]) if len(sys.argv) > 1 else 10
    caught = 0
    for n in range(1, runs + 1):
        if one_launch(n):
            caught += 1
    print(f"\n{runs} launches, {caught} with a blank tile.")
