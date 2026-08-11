#!/usr/bin/env python3
"""Validate the app boundaries that TypeScript alone cannot express.

The validator deliberately works on source paths rather than importing the
apps. That keeps it runnable before dependencies are installed and makes the
same checks useful against isolated fixture apps in the Python test suite.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
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
KEBAB_FILE = re.compile(
    r"^[a-z0-9]+(?:-[a-z0-9]+)*(?:\.(?:render\.)?test)?\.(?:ts|tsx)$"
)
KEBAB_DIR = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
RENDERER_IMPORT = re.compile(
    r"['\"](?:react|react-native(?:/[^'\"]*)?|convex/react|expo(?:/[^'\"]*)?)['\"]"
)


def relative(path: Path, root: Path = ROOT) -> str:
    try:
        return str(path.relative_to(root))
    except ValueError:
        return str(path)


def fail(message: str) -> None:
    raise SystemExit(message)


@dataclass(frozen=True)
class Owner:
    kind: str
    name: str
    root: Path


def source_files(src: Path) -> list[Path]:
    return sorted(
        path
        for suffix in ("*.ts", "*.tsx")
        for path in src.rglob(suffix)
        if not path.name.endswith(".d.ts")
    )


def owner_for(path: Path, src: Path) -> Owner | None:
    for kind, directory in (("feature", src / "features"), ("platform", src / "platform")):
        if path.is_relative_to(directory):
            parts = path.relative_to(directory).parts
            if parts:
                return Owner(kind, parts[0], directory / parts[0])
    if path.is_relative_to(src / "models"):
        return Owner("models", "models", src / "models")
    if path.is_relative_to(src / "ui"):
        return Owner("ui", "ui", src / "ui")
    if path.is_relative_to(src / "screens"):
        return Owner("screens", "screens", src / "screens")
    return None


def resolve_import(source: Path, imported: str) -> Path | None:
    if not imported.startswith("."):
        return None
    base = (source.parent / imported).resolve()
    candidates = [base]
    if base.suffix == "":
        candidates.extend(
            [base.with_suffix(".ts"), base.with_suffix(".tsx"), base / "index.ts", base / "native.ts"]
        )
    for candidate in candidates:
        if candidate.is_file():
            return candidate
    return None


def is_entrypoint(path: Path, owner: Owner) -> bool:
    return path == owner.root / "index.ts" or path == owner.root / "native.ts"


def validate_route_adapters(app: Path, root: Path = ROOT) -> None:
    app = app.resolve()
    for route in sorted((app / "app").rglob("*.tsx")):
        if route.name == "_layout.tsx":
            continue

        source = route.read_text(encoding="utf-8")
        exports = list(ROUTE_EXPORT.finditer(source))
        if len(exports) != 1:
            fail(f"route adapter must re-export exactly one screen: {relative(route, root)}")

        authored = COMMENTS.sub("", ROUTE_EXPORT.sub("", source))
        if authored.strip():
            fail(f"route adapter contains implementation: {relative(route, root)}")

        target = resolve_import(route, exports[0].group("path"))
        screens = (app / "src" / "screens").resolve()
        if target is None or not target.is_relative_to(screens):
            fail(f"route adapter bypasses screens: {relative(route, root)}")


def validate_filename_conventions(app: Path, root: Path = ROOT) -> None:
    src = (app / "src").resolve()
    for directory in sorted(path for path in src.rglob("*") if path.is_dir()):
        if directory.name.startswith("_"):
            continue
        if not KEBAB_DIR.fullmatch(directory.name):
            fail(f"authored directory must be kebab-case: {relative(directory, root)}")

    for path in source_files(src):
        if path.name.startswith("_") or not KEBAB_FILE.fullmatch(path.name):
            fail(f"authored filename must be kebab-case: {relative(path, root)}")


def validate_entrypoint_content(app: Path, root: Path = ROOT) -> None:
    src = (app / "src").resolve()
    owners = [
        *(Owner("feature", module.name, module) for module in sorted((src / "features").iterdir()) if module.is_dir()),
        *(Owner("platform", module.name, module) for module in sorted((src / "platform").iterdir()) if module.is_dir()),
    ]
    for owner in owners:
        index = owner.root / "index.ts"
        native = owner.root / "native.ts"
        if not index.is_file() and not native.is_file():
            fail(f"owner has no public entrypoint: {relative(owner.root, root)}")
        for entrypoint in (index, native):
            if not entrypoint.is_file():
                continue
            source = COMMENTS.sub("", entrypoint.read_text(encoding="utf-8")).strip()
            if not source:
                fail(f"empty public entrypoint: {relative(entrypoint, root)}")
            if entrypoint.name == "index.ts" and RENDERER_IMPORT.search(source):
                fail(f"pure entrypoint imports renderer code: {relative(entrypoint, root)}")

    for models in (src / "models",):
        if not models.is_dir():
            fail(f"missing app models layer: {relative(models, root)}")
        for path in source_files(models):
            if RENDERER_IMPORT.search(COMMENTS.sub("", path.read_text(encoding="utf-8"))):
                fail(f"model entrypoint exposes renderer code: {relative(path, root)}")

    ui = src / "ui"
    if not (ui / "index.ts").is_file():
        fail(f"missing public UI entrypoint: {relative(ui / 'index.ts', root)}")


def allowed_cross_boundary(source_owner: Owner, target_owner: Owner, target: Path) -> bool:
    if source_owner == target_owner:
        return True
    if source_owner.kind == "models":
        return False
    if source_owner.kind == "ui":
        return target_owner.kind == "ui"
    if source_owner.kind == "screens":
        return target_owner.kind in {"feature", "platform", "models", "ui"} and is_entrypoint(
            target, target_owner
        )
    if source_owner.kind == "feature":
        return target_owner.kind in {"platform", "models", "ui"} and is_entrypoint(
            target, target_owner
        )
    if source_owner.kind == "platform":
        return target_owner.kind in {"platform", "models"} and is_entrypoint(target, target_owner)
    return False


def validate_dependency_direction(app: Path, root: Path = ROOT) -> None:
    src = (app / "src").resolve()
    owners = [
        *(Owner("feature", module.name, module) for module in sorted((src / "features").iterdir()) if module.is_dir()),
        *(Owner("platform", module.name, module) for module in sorted((src / "platform").iterdir()) if module.is_dir()),
        Owner("models", "models", src / "models"),
        Owner("ui", "ui", src / "ui"),
        Owner("screens", "screens", src / "screens"),
    ]
    graph: dict[Path, set[Path]] = {path: set() for path in source_files(src)}

    def find_owner(path: Path) -> Owner | None:
        return next((owner for owner in owners if path.is_relative_to(owner.root)), None)

    for source in graph:
        source_owner = find_owner(source)
        if source_owner is None:
            continue
        text = source.read_text(encoding="utf-8")
        for match in MODULE_REFERENCE.finditer(text):
            target = resolve_import(source, match.group("path"))
            if target is None or not target.is_relative_to(src):
                continue
            graph[source].add(target)
            target_owner = find_owner(target)
            if target_owner is None or target_owner == source_owner:
                continue
            if not allowed_cross_boundary(source_owner, target_owner, target):
                fail(
                    f"forbidden dependency direction: {relative(source, root)} -> {match.group('path')}"
                )

    visiting: set[Path] = set()
    visited: set[Path] = set()

    def visit(node: Path) -> None:
        if node in visiting:
            fail(f"dependency cycle detected at: {relative(node, root)}")
        if node in visited:
            return
        visiting.add(node)
        for child in graph[node]:
            if child in graph:
                visit(child)
        visiting.remove(node)
        visited.add(node)

    for source in graph:
        visit(source)


def validate_public_entrypoints(app: Path, root: Path = ROOT) -> None:
    # Kept as a named compatibility seam for callers that used the original
    # validator function. The stricter checks now live alongside it.
    validate_entrypoint_content(app, root)


def validate_cross_boundary_imports(app: Path, root: Path = ROOT) -> None:
    # Kept as a named compatibility seam for isolated validator fixtures.
    validate_dependency_direction(app, root)


def validate_app(app: Path, root: Path = ROOT) -> None:
    validate_route_adapters(app, root)
    validate_filename_conventions(app, root)
    validate_public_entrypoints(app, root)
    validate_cross_boundary_imports(app, root)


def main() -> int:
    for name in APP_NAMES:
        validate_app(ROOT / "apps" / name)

    print("App architecture validation passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
