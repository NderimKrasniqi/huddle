#!/usr/bin/env python3
"""Validate app boundaries that ordinary TypeScript imports cannot express."""

from __future__ import annotations

import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
APP_NAMES = ("controller", "tv")
MODULE_REFERENCE = re.compile(
    r"(?:\bfrom\s+|\bimport\s*\(\s*|\bimport\s+)['\"](?P<path>[^'\"]+)['\"]"
)
ROUTE_EXPORT = re.compile(
    r"^\s*export\s*\{\s*default\s*\}\s*from\s*['\"](?P<path>[^'\"]+)['\"];?\s*$",
    re.MULTILINE,
)
COMMENTS = re.compile(r"/\*.*?\*/|//[^\n]*", re.DOTALL)


def fail(message: str) -> None:
    raise SystemExit(message)


def validate_route_adapters(app: Path) -> None:
    for route in sorted((app / "app").rglob("*.tsx")):
        if route.name == "_layout.tsx":
            continue

        source = route.read_text(encoding="utf-8")
        exports = list(ROUTE_EXPORT.finditer(source))
        if len(exports) != 1:
            fail(f"route adapter must re-export exactly one screen: {route.relative_to(ROOT)}")

        authored = COMMENTS.sub("", ROUTE_EXPORT.sub("", source))
        if authored.strip():
            fail(f"route adapter contains implementation: {route.relative_to(ROOT)}")

        target = (route.parent / exports[0].group("path")).resolve()
        screens = (app / "src" / "screens").resolve()
        if not target.is_relative_to(screens):
            fail(f"route adapter bypasses screens: {route.relative_to(ROOT)}")
        if not target.is_file() and not target.with_suffix(".tsx").is_file():
            fail(f"route adapter screen is missing: {route.relative_to(ROOT)}")


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
        for match in MODULE_REFERENCE.finditer(source):
            imported = match.group("path")
            if imported.startswith("../features/"):
                parts = imported.split("/")
                if len(parts) not in (3, 4) or (len(parts) == 4 and parts[-1] != "native"):
                    fail(f"screen deep-imports a feature: {screen.relative_to(ROOT)} -> {imported}")
            if imported.startswith("../platform/") and imported.count("/") != 2:
                fail(f"screen deep-imports platform code: {screen.relative_to(ROOT)} -> {imported}")
            if imported.startswith("../ui/"):
                fail(f"screen bypasses the UI entrypoint: {screen.relative_to(ROOT)} -> {imported}")


def validate_cross_boundary_imports(app: Path) -> None:
    """Allow internals within an owner, but only entrypoints across owners."""

    src = app / "src"
    owners = [
        *(path for path in (src / "features").iterdir() if path.is_dir()),
        *(path for path in (src / "platform").iterdir() if path.is_dir()),
        src / "ui",
    ]

    for source in sorted((*src.rglob("*.ts"), *src.rglob("*.tsx"))):
        source_owner = next((owner for owner in owners if source.is_relative_to(owner)), None)

        for match in MODULE_REFERENCE.finditer(source.read_text(encoding="utf-8")):
            imported = match.group("path")
            if not imported.startswith("."):
                continue

            target = (source.parent / imported).resolve()
            target_owner = next((owner for owner in owners if target.is_relative_to(owner)), None)
            if target_owner is None or target_owner == source_owner:
                continue

            allowed = {target_owner.resolve()}
            if target_owner.parent.name == "features":
                allowed.add((target_owner / "native").resolve())

            if target not in allowed:
                fail(
                    f"cross-boundary deep import: {source.relative_to(ROOT)} -> {imported}"
                )


def main() -> int:
    for name in APP_NAMES:
        app = ROOT / "apps" / name
        validate_route_adapters(app)
        validate_public_entrypoints(app)
        validate_cross_boundary_imports(app)

    print("App architecture validation passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
