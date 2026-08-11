#!/usr/bin/env python3
"""Validate the app boundaries that TypeScript alone cannot express.

The validator deliberately works on source paths rather than importing the
apps. That keeps it runnable before dependencies are installed and makes the
same checks useful against isolated fixture apps in the Python test suite.
"""

from __future__ import annotations

import re
import json
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
SHARED_RENDERER_IMPORT = re.compile(r"['\"]@huddle/ui/(?:kit|native)['\"]")
SERVER_CONTENT_IMPORT = re.compile(
    r"(?:curated-pack|questions|server|node:[a-z0-9_/]+)", re.IGNORECASE
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

            if entrypoint.name == "index.ts":
                validate_transitive_renderer_free(entrypoint, root, "pure entrypoint")

    for models in (src / "models",):
        if not models.is_dir():
            fail(f"missing app models layer: {relative(models, root)}")
        for path in source_files(models):
            if renderer_import(COMMENTS.sub("", path.read_text(encoding="utf-8"))):
                fail(f"model entrypoint exposes renderer code: {relative(path, root)}")

    ui = src / "ui"
    if not (ui / "index.ts").is_file():
        fail(f"missing public UI entrypoint: {relative(ui / 'index.ts', root)}")


def renderer_import(source: str) -> re.Match[str] | None:
    """Return a renderer import, including a renderer-bearing UI seam."""

    return RENDERER_IMPORT.search(source) or SHARED_RENDERER_IMPORT.search(source)


def validate_transitive_renderer_free(entrypoint: Path, root: Path, label: str) -> None:
    """Ensure a pure entrypoint cannot hide a renderer behind a re-export."""

    pending = [entrypoint]
    visited: set[Path] = set()
    while pending:
        source = pending.pop()
        if source in visited or not source.is_file():
            continue
        visited.add(source)
        text = COMMENTS.sub("", source.read_text(encoding="utf-8"))
        if renderer_import(text):
            fail(f"{label} transitively imports renderer code: {relative(source, root)}")
        for match in MODULE_REFERENCE.finditer(text):
            target = resolve_import(source, match.group("path"))
            if target is not None:
                pending.append(target)


def export_values(value: object) -> list[str]:
    """Flatten conditional/package export declarations into target strings."""

    if isinstance(value, str):
        return [value]
    if isinstance(value, dict):
        result: list[str] = []
        for child in value.values():
            result.extend(export_values(child))
        return result
    if isinstance(value, list):
        result = []
        for child in value:
            result.extend(export_values(child))
        return result
    return []


def package_manifests(root: Path) -> list[Path]:
    return sorted(
        path
        for path in root.rglob("package.json")
        if "node_modules" not in path.parts and ".git" not in path.parts
    )


def package_kind(path: Path, root: Path) -> str:
    rel = path.parent.relative_to(root).parts
    if not rel:
        return "root"
    if rel[0] == "apps":
        return "app"
    if rel[0] == "convex":
        return "convex"
    if rel[:2] == ("packages", "game-core"):
        return "core"
    if rel[:2] == ("packages", "game-registry"):
        return "registry"
    if rel[:2] == ("packages", "ui"):
        return "ui"
    if rel[:2] == ("packages", "games"):
        return "game"
    return "package"


def validate_package_boundaries(root: Path = ROOT) -> None:
    """Validate package export targets and workspace dependency direction."""

    manifests = package_manifests(root)
    by_name: dict[str, Path] = {}
    payloads: dict[Path, dict[str, object]] = {}
    for manifest in manifests:
        try:
            payload = json.loads(manifest.read_text(encoding="utf-8"))
        except json.JSONDecodeError as error:
            fail(f"invalid package manifest: {relative(manifest, root)} ({error})")
        if not isinstance(payload, dict):
            fail(f"package manifest must be an object: {relative(manifest, root)}")
        payloads[manifest] = payload
        name = payload.get("name")
        if isinstance(name, str):
            by_name[name] = manifest

        exports = payload.get("exports")
        if exports is not None:
            for target in export_values(exports):
                if not target.startswith("."):
                    continue
                resolved = manifest.parent / target
                if "*" in target:
                    resolved = Path(str(resolved).split("*", 1)[0])
                if not resolved.exists():
                    fail(
                        f"package export target missing: {relative(manifest, root)} -> {target}"
                    )

    allowed: dict[str, set[str]] = {
        "app": {"core", "registry", "game", "ui", "convex"},
        "convex": {"core", "registry"},
        "registry": {"core", "game"},
        "game": {"core", "ui"},
        "ui": {"core"},
        "core": set(),
        "package": set(),
        "root": {"app", "convex", "core", "registry", "game", "ui", "package"},
    }
    for manifest, payload in payloads.items():
        source_kind = package_kind(manifest, root)
        dependencies: dict[str, object] = {}
        for field in ("dependencies", "devDependencies", "optionalDependencies", "peerDependencies"):
            value = payload.get(field)
            if isinstance(value, dict):
                dependencies.update(value)
        for dependency, version in dependencies.items():
            if not isinstance(version, str) or not version.startswith("workspace:"):
                continue
            target_manifest = by_name.get(dependency)
            if target_manifest is None:
                fail(
                    f"workspace dependency has no package: {relative(manifest, root)} -> {dependency}"
                )
            target_kind = package_kind(target_manifest, root)
            if target_kind not in allowed.get(source_kind, set()):
                fail(
                    f"forbidden workspace dependency direction: {relative(manifest, root)} -> {dependency}"
                )

    # Rules-only and client-safe exports are intentionally renderer-free and
    # cannot reach the server/content graph through an accidental re-export.
    for manifest, payload in payloads.items():
        exports = payload.get("exports")
        if not isinstance(exports, dict):
            continue
        for key, declaration in exports.items():
            if not isinstance(key, str) or key == ".":
                continue
            targets = export_values(declaration)
            is_rules = key in {"./logic", "./rules"} or key.endswith("/logic")
            is_client_safe = "client" in key or key.endswith("/categories")
            if not (is_rules or is_client_safe):
                continue
            for target in targets:
                if not target.startswith("."):
                    continue
                entrypoint = manifest.parent / target
                if is_rules:
                    validate_transitive_renderer_free(entrypoint, root, "rules-only entrypoint")
                if is_client_safe:
                    pending = [entrypoint]
                    visited: set[Path] = set()
                    while pending:
                        source = pending.pop()
                        if source in visited or not source.is_file():
                            continue
                        visited.add(source)
                        text = COMMENTS.sub("", source.read_text(encoding="utf-8"))
                        if SERVER_CONTENT_IMPORT.search(text):
                            fail(
                                f"client-safe entrypoint reaches server/content code: {relative(source, root)}"
                            )
                        for match in MODULE_REFERENCE.finditer(text):
                            child = resolve_import(source, match.group("path"))
                            if child is not None:
                                pending.append(child)


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
    validate_package_boundaries(ROOT)

    print("App architecture validation passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
