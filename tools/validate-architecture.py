#!/usr/bin/env python3
"""Validate the app boundaries that TypeScript alone cannot express.

The validator deliberately works on source paths rather than importing the
apps. That keeps it runnable before dependencies are installed and makes the
same checks useful against isolated fixture apps in the Python test suite.
"""

from __future__ import annotations

import hashlib
import re
import json
import struct
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
APP_NAMES = ("phone", "tv")
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
PHONE_JOIN_RENDERER = Path("apps/phone/src/features/join/join-room-screen.tsx")
TV_ROOM_RENDERER = Path("apps/tv/src/features/room/room-invitation-screen.tsx")
TV_BOOT_RENDERER = Path("apps/tv/src/features/boot/tv-creating-room-screen.tsx")
TV_RESTORE_RENDERER = Path("apps/tv/src/features/boot/tv-restoring-room-screen.tsx")
TV_RESTORE_INDICATOR = Path("apps/tv/src/features/boot/tv-restore-indicator.tsx")
TV_BOOT_RENDERERS = frozenset(
    (TV_BOOT_RENDERER, TV_RESTORE_RENDERER, TV_RESTORE_INDICATOR)
)
TV_GAME_FLOW_RENDERERS = frozenset(
    (
        Path("apps/tv/src/features/game-flow/game-carousel-screen.tsx"),
        Path("apps/tv/src/features/game-flow/game-art-reveal-screen.tsx"),
        Path("apps/tv/src/features/game-flow/game-setup-screen.tsx"),
        Path("apps/tv/src/features/game-flow/game-ready-screen.tsx"),
    )
)
APPROVED_ILLUSTRATED_RENDERERS = frozenset(
    (PHONE_JOIN_RENDERER, TV_ROOM_RENDERER, *TV_BOOT_RENDERERS, *TV_GAME_FLOW_RENDERERS)
)
TV_SVG_RENDERERS = frozenset(
    (TV_ROOM_RENDERER, *TV_BOOT_RENDERERS)
)
TV_QR_DEPENDENCIES = {
    "react-native-qrcode-svg": "^6.3.21",
    "react-native-svg": "15.15.4",
}
TV_ROOM_ASSET_SPECS = {
    "tv-lobby-background.png": (
        (1672, 941),
        "cd081ff609284c6a1d748852245002faaed972d340c468676d1524ce5b5717cc",
    ),
    "tv-lobby-empty.png": (
        (1672, 941),
        "a19a82be3258b72a8188484d77bf8083d6906944ab31f495d3d3da32755cc64e",
    ),
    "tv-lobby-phone-icon.png": (
        (1254, 1254),
        "e801f7e7893f365fe450fc1663e850389e391cf9184527d8f3ae62b4af411da0",
    ),
}
TV_GAME_FLOW_ASSET_SPECS = {
    "backgrounds": {
        "huddle-playroom-1080p.png": (
            (1920, 1080),
            "9e040761d707a96fed6be9ff05b5117571e625c0fe30558faf5aee22b2c33635",
        ),
    },
    "brand": {
        "huddle-mark.png": (
            (2048, 2048),
            "f61064f28e47abac020e688cdda532d1aacc60c50bece922e4888bfbf3988df8",
        ),
    },
    "carousel-cards": {
        "trivia-card-source.png": (
            (1086, 1448),
            "950e64f06d7de68d6e133b1af754688ff968b4cc5069e95db24c681337094848",
        ),
        "voting-card-source.png": (
            (1086, 1448),
            "86b2278465ef3384e65605bbb6592dc38808f58478c679568e28cc8cfcc153c5",
        ),
        "word-battle-card-source.png": (
            (1086, 1448),
            "44f0b3c898ba37a5ce1df45a08ed852179902b60a920fe8f0378e8bfbe29f578",
        ),
        "more-games-card-source.png": (
            (1086, 1448),
            "3ab63a5ac47059df0c7a4629beecf83b5b23437311f14132e4842d1cdc036fb9",
        ),
    },
    "game-art": {
        "trivia-game-art-1080p.png": (
            (1920, 1080),
            "8ccd2cc0309521bb2186fc0144988ea12b5f40c78ee02b8120a94792e0a3fcf9",
        ),
        "voting-game-art-1080p.png": (
            (1920, 1080),
            "650f08c663cc60805547aa84a37f98c89aa93fad233d5ec94f131cdf94003a92",
        ),
    },
    "setup-icons": {
        "questions.png": (
            (512, 512),
            "d823d9c6b1d4d67580b355e4e3504bd93b418b5f485ac14dce1d9a84a88194e6",
        ),
        "rounds.png": (
            (512, 512),
            "78b782ec1ea3e2ec89131bd58cc39395c762f77f6e7acba1e993cb08459cc2f6",
        ),
    },
}


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
        if not path.name.endswith(".d.ts") and "node_modules" not in path.parts
    )


def is_approved_illustrated_renderer(path: Path, root: Path = ROOT) -> bool:
    """Allow artwork only in the Phone, TV Room, TV boot, and TV game-flow seams."""

    return any(path.resolve() == (root / approved).resolve() for approved in APPROVED_ILLUSTRATED_RENDERERS)


def is_approved_interactive_renderer(path: Path, root: Path = ROOT) -> bool:
    """Compatibility name retained for isolated validator callers."""

    return is_approved_illustrated_renderer(path, root)


def validate_presentation_renderer_scope(
    source: Path, clean_source: str, root: Path = ROOT
) -> None:
    """Keep artwork and native presentation APIs inside their app-owned seams."""

    resolved = source.resolve()
    svg_renderers = {(root / renderer).resolve() for renderer in TV_SVG_RENDERERS}
    room_renderer = (root / TV_ROOM_RENDERER).resolve()
    boot_renderers = {(root / renderer).resolve() for renderer in TV_BOOT_RENDERERS}
    game_flow_renderers = {(root / renderer).resolve() for renderer in TV_GAME_FLOW_RENDERERS}

    if re.search(r"\breact-native-qrcode-svg\b", clean_source) and resolved != room_renderer:
        fail(f"QR renderer import is outside TV Room: {relative(source, root)}")
    if re.search(r"\breact-native-svg\b", clean_source) and resolved not in svg_renderers:
        fail(f"SVG renderer import is outside approved TV renderers: {relative(source, root)}")

    # The boot treatment is display-only. Animated/Image/SVG are intentionally
    # allowed there, but controls, inputs, dialogs, and progress widgets are
    # not part of this narrow presentation exception.
    if resolved in boot_renderers or resolved in game_flow_renderers:
        display_only_forbidden_names = (
            r"Pressable|TextInput|CameraView|QRCode|Modal|ScrollView|"
            r"Button|TouchableOpacity|TouchableWithoutFeedback"
        )
        if resolved == (root / TV_BOOT_RENDERER).resolve():
            display_only_forbidden_names += r"|ActivityIndicator"
        if re.search(rf"\b(?:{display_only_forbidden_names})\b", clean_source):
            label = "TV boot" if resolved in boot_renderers else "TV game-flow"
            fail(f"{label} renderer must remain display-only: {relative(source, root)}")


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
        src = (app / "src").resolve()
        if target is None or not target.is_relative_to(src):
            fail(f"route adapter bypasses src ownership: {relative(route, root)}")


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
    if rel[:2] == ("packages", "contracts"):
        return "contracts"
    if rel[:2] == ("packages", "domain"):
        return "domain"
    if rel[:2] == ("packages", "design-tokens"):
        return "tokens"
    if rel[:2] == ("packages", "game-registry"):
        return "registry"
    if rel[:2] == ("packages", "ui"):
        return "ui"
    if rel[0] == "games":
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
        "app": {"contracts", "domain", "tokens", "registry", "game", "ui", "convex"},
        "convex": {"contracts", "domain", "registry"},
        "registry": {"contracts", "domain", "game"},
        "game": {"contracts", "domain", "ui"},
        "ui": {"contracts", "tokens"},
        "domain": {"contracts"},
        "contracts": set(),
        "tokens": set(),
        "package": set(),
        "root": {"app", "convex", "contracts", "domain", "tokens", "registry", "game", "ui", "package"},
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


def validate_qr_dependency_scope(root: Path = ROOT) -> None:
    """Keep QR/SVG packages exact and local to the TV application."""

    tv_manifest = (root / "apps" / "tv" / "package.json").resolve()
    found_on_tv: dict[str, str] = {}
    for manifest in package_manifests(root):
        payload = json.loads(manifest.read_text(encoding="utf-8"))
        for field in ("dependencies", "devDependencies", "optionalDependencies", "peerDependencies"):
            declared = payload.get(field, {})
            if not isinstance(declared, dict):
                continue
            for dependency, expected_version in TV_QR_DEPENDENCIES.items():
                if dependency not in declared:
                    continue
                if manifest.resolve() != tv_manifest or field != "dependencies":
                    fail(
                        f"QR/SVG dependency is outside the TV renderer: "
                        f"{relative(manifest, root)} -> {dependency}"
                    )
                actual_version = declared[dependency]
                if actual_version != expected_version:
                    fail(
                        f"TV QR/SVG dependency has wrong version: {dependency} "
                        f"({actual_version}, expected {expected_version})"
                    )
                found_on_tv[dependency] = str(actual_version)

    missing = set(TV_QR_DEPENDENCIES).difference(found_on_tv)
    if missing:
        fail(f"TV QR/SVG dependency missing: {sorted(missing)[0]}")


def validate_png_asset_set(
    asset_root: Path,
    specs: dict[str, tuple[tuple[int, int], str]],
    label: str,
    root: Path = ROOT,
) -> None:
    """Validate one supplied PNG set by exact names, dimensions, and digests."""

    if not asset_root.is_dir():
        fail(f"{label} asset directory missing: {relative(asset_root, root)}")
    actual_assets = {path.name for path in asset_root.iterdir() if path.is_file()}
    if actual_assets != set(specs):
        fail(f"{label} assets must contain only the approved PNGs")

    for name, (expected_dimensions, expected_digest) in specs.items():
        path = asset_root / name
        payload = path.read_bytes()
        if payload[:8] != b"\x89PNG\r\n\x1a\n":
            fail(f"{label} asset is not PNG: {relative(path, root)}")
        actual_dimensions = struct.unpack(">II", payload[16:24])
        if actual_dimensions != expected_dimensions:
            fail(
                f"{label} asset has wrong dimensions: {relative(path, root)} "
                f"({actual_dimensions}, expected {expected_dimensions})"
            )
        if hashlib.sha256(payload).hexdigest() != expected_digest:
            fail(f"{label} asset differs from supplied PNG: {relative(path, root)}")


def validate_tv_room_assets(root: Path = ROOT) -> None:
    validate_png_asset_set(
        root / "apps" / "tv" / "assets" / "room-invitation",
        TV_ROOM_ASSET_SPECS,
        "TV Room Invitation",
        root,
    )


def validate_tv_game_flow_assets(root: Path = ROOT) -> None:
    """Keep the TV game-flow bundle on the approved optimized asset set."""

    base = root / "apps" / "tv" / "assets" / "game-flow"
    expected_paths: set[Path] = set()
    for directory, specs in TV_GAME_FLOW_ASSET_SPECS.items():
        validate_png_asset_set(base / directory, specs, f"TV Game Flow {directory}", root)
        expected_paths.update((base / directory / name).resolve() for name in specs)

    actual_paths = {
        path.resolve()
        for path in base.rglob("*")
        if path.is_file() and path.suffix.lower() in {".png", ".jpg", ".jpeg", ".svg"}
    }
    if actual_paths != expected_paths:
        extras = sorted(relative(path, root) for path in actual_paths - expected_paths)
        missing = sorted(relative(path, root) for path in expected_paths - actual_paths)
        fail(
            "TV Game Flow asset set differs from the approved optimized bundle: "
            f"extras={extras}, missing={missing}"
        )


def validate_reference_composite_exclusion(root: Path = ROOT) -> None:
    """The baked empty-room composite is reference-only and cannot enter Metro."""

    source_root = root / "apps" / "tv" / "src"
    if not source_root.is_dir():
        return
    for source in source_files(source_root):
        if "tv-lobby-empty.png" in source.read_text(encoding="utf-8"):
            fail(
                f"TV Room reference composite is imported at runtime: {relative(source, root)}"
            )


def validate_consolidation(root: Path = ROOT) -> None:
    """Guard the clean-slate baseline, illustrated exceptions, identity, and assets."""

    forbidden_paths = [root / "apps" / "controller", root / "packages" / "game-core", root / "packages" / "games"]
    for path in forbidden_paths:
        if path.exists():
            fail(f"superseded package path exists: {relative(path, root)}")

    phone = json.loads((root / "apps" / "phone" / "app.json").read_text(encoding="utf-8"))["expo"]
    if phone.get("slug") != "huddle-phone":
        fail("Phone Expo slug must be huddle-phone")
    if phone.get("ios", {}).get("bundleIdentifier") != "tv.huddle.phone":
        fail("Phone iOS identity must be tv.huddle.phone")
    if phone.get("android", {}).get("package") != "tv.huddle.phone":
        fail("Phone Android identity must be tv.huddle.phone")

    removed_setup = [
        root / "apps" / app / name
        for app in APP_NAMES
        for name in (
            "babel.config.cjs",
            "metro.config.cjs",
            "tailwind.config.cjs",
            "global.css",
            "nativewind-env.d.ts",
        )
    ]
    for path in removed_setup:
        if path.exists():
            fail(f"superseded presentation setup remains: {relative(path, root)}")

    forbidden_modules = re.compile(
        r"(?:nativewind|react-native-css-interop|expo-image|react-native-reanimated|"
        r"react-native-worklets|lucide-react-native|@react-native-community/netinfo|"
        r"@huddle/ui/(?:kit|fonts))"
    )
    forbidden_renderers = re.compile(
        r"\b(?:Pressable|TextInput|CameraView|QRCode|Modal|Animated|Image|ImageBackground|"
        r"ScrollView|ActivityIndicator|Button|TouchableOpacity|TouchableWithoutFeedback)\b"
    )
    for base in (root / "apps", root / "packages" / "ui", root / "games"):
        for source in source_files(base):
            if "future" in source.parts or ".test." in source.name:
                continue
            clean = COMMENTS.sub("", source.read_text(encoding="utf-8"))
            if forbidden_modules.search(clean):
                fail(f"superseded presentation dependency remains: {relative(source, root)}")
            validate_presentation_renderer_scope(source, clean, root)
            if forbidden_renderers.search(clean) and not is_approved_illustrated_renderer(source, root):
                fail(f"interactive/artwork renderer remains: {relative(source, root)}")

    purpose = root / "packages" / "ui" / "src" / "native" / "purpose-screen.tsx"
    if not purpose.is_file():
        fail("PurposeScreen renderer is missing")
    purpose_source = COMMENTS.sub("", purpose.read_text(encoding="utf-8"))
    if "export function PurposeScreen" not in purpose_source:
        fail("PurposeScreen renderer is not exported")
    if re.search(r"\b(?:children|StyleProp|Pressable|TextInput)\b", purpose_source):
        fail("PurposeScreen must accept no children, style overrides, or controls")

    manifests = [root / "apps" / app / "package.json" for app in APP_NAMES]
    manifests.extend(
        [
            root / "packages" / "ui" / "package.json",
            root / "packages" / "game-registry" / "package.json",
            *(root / "games" / name / "package.json" for name in ("trivia", "voting")),
        ]
    )
    banned_dependencies = {
        "nativewind",
        "tailwindcss",
        "react-native-css-interop",
        "expo-image",
        "react-native-reanimated",
        "react-native-worklets",
        "lucide-react-native",
        "@react-native-community/netinfo",
        "@expo-google-fonts/inter",
        "@expo-google-fonts/nunito",
    }
    for manifest in manifests:
        payload = json.loads(manifest.read_text(encoding="utf-8"))
        for field in ("dependencies", "devDependencies", "optionalDependencies", "peerDependencies"):
            declared = payload.get(field, {})
            if isinstance(declared, dict):
                found = banned_dependencies.intersection(declared)
                if found:
                    fail(f"removed presentation dependency remains: {relative(manifest, root)} -> {sorted(found)[0]}")
    validate_qr_dependency_scope(root)

    asset_specs = {
        "huddle-app-icon-light.png": (1024, 1024),
        "huddle-app-icon-dark.png": (1024, 1024),
        "huddle-android-legacy.png": (1024, 1024),
        "huddle-android-tv-icon.png": (1024, 1024),
        "huddle-android-adaptive-foreground.png": (1024, 1024),
        "huddle-android-monochrome.png": (1024, 1024),
        "huddle-splash.png": (1024, 1024),
        "huddle-android-tv-banner.png": (640, 360),
    }
    asset_root = root / "packages" / "ui" / "assets" / "app-icons"
    for name, expected in asset_specs.items():
        path = asset_root / name
        if not path.is_file():
            fail(f"neutral native asset missing: {relative(path, root)}")
        with path.open("rb") as handle:
            header = handle.read(24)
        if header[:8] != b"\x89PNG\r\n\x1a\n":
            fail(f"native asset is not PNG: {relative(path, root)}")
        actual = struct.unpack(">II", header[16:24])
        if actual != expected:
            fail(f"native asset has wrong dimensions: {relative(path, root)} ({actual}, expected {expected})")

    join_asset_specs = {
        "huddle-brand-icon.png": (
            (1254, 1254),
            "418219f8a51365b86cc8cc2624cb48f8b4ffa94302e9d2d9d4ba05886ef5dc05",
        ),
        "join-room-background.png": (
            (941, 1672),
            "9882f6929f62345e0ba49aa753eca43b9ecb86ebbd12d0d65f2f49c17dedfd01",
        ),
        "qr-code-icon.png": (
            (1254, 1254),
            "bd3575c9e144db67ecefb9b726ea88519de8effd8aa608b0a6bab0622b00da35",
        ),
    }
    validate_png_asset_set(
        root / "apps" / "phone" / "assets" / "join-room",
        join_asset_specs,
        "Phone Join Room",
        root,
    )
    validate_tv_room_assets(root)
    validate_tv_game_flow_assets(root)
    validate_reference_composite_exclusion(root)

    forbidden_asset_dirs = ("avatars", "game-art", "icons", "logo", "phone-backgrounds", "tv-backgrounds")
    for name in forbidden_asset_dirs:
        path = root / "packages" / "ui" / "assets" / name
        if path.exists():
            fail(f"superseded artwork directory exists: {relative(path, root)}")

    neutral_names = set(asset_specs)
    for app in APP_NAMES:
        config_path = root / "apps" / app / "app.json"
        config = json.loads(config_path.read_text(encoding="utf-8"))["expo"]
        if config.get("backgroundColor") != "#FFFFFF":
            fail(f"{app} native background must be white")
        encoded = json.dumps(config)
        referenced = set(re.findall(r"huddle-[a-z0-9-]+\.png", encoded))
        if not referenced.issubset(neutral_names):
            fail(f"{app} config references a non-neutral asset")
        if "huddle-splash.png" not in referenced:
            fail(f"{app} config must reference the neutral splash asset")

    if not (root / "apps" / "phone" / "app.json").read_text(encoding="utf-8").__contains__("expo-camera"):
        fail("Phone Expo Camera configuration must remain")

    stale = re.compile(r"apps/controller|@huddle/controller|packages/games|@huddle/game-core")
    for base in (root / "apps", root / "packages", root / "games", root / "convex", root / "tools"):
        for source in source_files(base):
            if stale.search(source.read_text(encoding="utf-8")):
                fail(f"superseded platform/package term remains: {relative(source, root)}")


def main() -> int:
    for name in APP_NAMES:
        validate_app(ROOT / "apps" / name)
    validate_package_boundaries(ROOT)
    validate_consolidation(ROOT)

    print("App architecture validation passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
