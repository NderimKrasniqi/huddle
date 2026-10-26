#!/usr/bin/env python3

from __future__ import annotations

import shutil
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "packages" / "ui" / "assets" / "app-icons"
CANVAS = (0xF9, 0xF1, 0xE6)

APPLE_TV = {
    "huddle-tv-icon-1280x768.png": (1280, 768),
    "huddle-tv-icon-400x240.png": (400, 240),
    "huddle-tv-icon-800x480.png": (800, 480),
    "huddle-tv-top-shelf-1920x720.png": (1920, 720),
    "huddle-tv-top-shelf-3840x1440.png": (3840, 1440),
    "huddle-tv-top-shelf-wide-2320x720.png": (2320, 720),
    "huddle-tv-top-shelf-wide-4640x1440.png": (4640, 1440),
}

def flattened(image: Image.Image) -> Image.Image:

    rgba = image.convert("RGBA")
    base = Image.new("RGBA", rgba.size, CANVAS + (255,))
    return Image.alpha_composite(base, rgba).convert("RGB")

def save(image: Image.Image, name: str) -> None:
    path = OUT / name
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, format="PNG", optimize=False)
    print(f"wrote {path.relative_to(ROOT)} {image.size[0]}x{image.size[1]}")

def main() -> int:
    if len(sys.argv) != 2:
        print(__doc__)
        return 2
    source = Path(sys.argv[1]).expanduser()
    ios_icon = Image.open(source / "app-icon-ios.png")
    foreground = source / "app-icon-android-foreground.png"
    monochrome = source / "app-icon-android-monochrome.png"
    splash = Image.open(source / "splash-logo.png")
    banner = flattened(Image.open(source / "app-banner-android-tv.png"))

    icon = flattened(ios_icon)
    for name in (
        "huddle-app-icon-light.png",

        "huddle-app-icon-dark.png",
        "huddle-android-legacy.png",
        "huddle-android-tv-icon.png",
    ):
        save(icon, name)

    for supplied, name in (
        (foreground, "huddle-android-adaptive-foreground.png"),
        (monochrome, "huddle-android-monochrome.png"),
    ):
        shutil.copyfile(supplied, OUT / name)
        print(f"copied {name}")
    save(flattened(splash), "huddle-splash.png")
    save(banner.resize((640, 360), Image.Resampling.LANCZOS), "huddle-android-tv-banner.png")

    for name, (width, height) in APPLE_TV.items():
        scale = min(width / banner.width, height / banner.height)
        size = (round(banner.width * scale), round(banner.height * scale))
        canvas = Image.new("RGB", (width, height), CANVAS)
        canvas.paste(banner.resize(size, Image.Resampling.LANCZOS), ((width - size[0]) // 2, (height - size[1]) // 2))
        save(canvas, f"apple-tv/{name}")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
