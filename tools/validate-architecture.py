#!/usr/bin/env python3
"""Validate app boundaries that ordinary TypeScript imports cannot express."""

from __future__ import annotations

import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
APP_NAMES = ("controller", "tv")
IMPORT = re.compile(r"\bfrom\s+['\"](?P<path>[^'\"]+)['\"]")
IMPORT_LINE = re.compile(r"^\s*import\b", re.MULTILINE)


def fail(message: str) -> None:
    raise SystemExit(message)


def validate_route_adapters(app: Path) -> None:
    for route in sorted((app / "app").rglob("*.tsx")):
        if route.name == "_layout.tsx":
            continue

        source = route.read_text(encoding="utf-8")
        if IMPORT_LINE.search(source):
            fail(f"route adapter imports implementation: {route.relative_to(ROOT)}")
        if "export { default } from" not in source:
            fail(f"route adapter must only re-export its screen: {route.relative_to(ROOT)}")


def validate_public_entrypoints(app: Path) -> None:
    src = app / "src"
    for boundary in ("features", "platform"):
        root = src / boundary
        for module in sorted(path for path in root.iterdir() if path.is_dir()):
            if not (module / "index.ts").is_file():
                fail(f"missing public entrypoint: {(module / 'index.ts').relative_to(ROOT)}")

    ui = src / "ui"
    if not (ui / "index.ts").is_file():
        fail(f"missing public entrypoint: {(ui / 'index.ts').relative_to(ROOT)}")

    for screen in sorted((src / "screens").glob("*.tsx")):
        source = screen.read_text(encoding="utf-8")
        for match in IMPORT.finditer(source):
            imported = match.group("path")
            if imported.startswith("../features/") and imported.count("/") != 2:
                fail(f"screen deep-imports a feature: {screen.relative_to(ROOT)} -> {imported}")
            if imported.startswith("../platform/") and imported.count("/") != 2:
                fail(f"screen deep-imports platform code: {screen.relative_to(ROOT)} -> {imported}")
            if imported.startswith("../ui/"):
                fail(f"screen bypasses the UI entrypoint: {screen.relative_to(ROOT)} -> {imported}")


def main() -> int:
    for name in APP_NAMES:
        app = ROOT / "apps" / name
        validate_route_adapters(app)
        validate_public_entrypoints(app)

    print("App architecture validation passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
