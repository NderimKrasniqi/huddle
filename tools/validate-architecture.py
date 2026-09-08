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
import zlib
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
APP_NAMES = ("phone", "tv")
MODULE_REFERENCE = re.compile(
    r"(?:\bfrom\s+|\bimport\s*\(\s*|\bimport\s+)['\"](?P<path>[^'\"]+)['\"]"
)
TYPE_ONLY_DECLARATION = re.compile(
    r"\b(?:import|export)\s+type\b.*?;", re.DOTALL
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
    r"(?:curated-pack|questions|prompts|server|node:[a-z0-9_/]+)", re.IGNORECASE
)
PHONE_JOIN_RENDERER = Path("apps/phone/src/features/join/room-code-screen.tsx")
PHONE_IDENTITY_RENDERER = Path("apps/phone/src/screens/join-identity-screen.tsx")
PHONE_SCAN_RENDERER = Path("apps/phone/src/features/scan/scan-screen.tsx")
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
    (
        PHONE_JOIN_RENDERER,
        PHONE_IDENTITY_RENDERER,
        PHONE_SCAN_RENDERER,
        TV_ROOM_RENDERER,
        *TV_BOOT_RENDERERS,
        *TV_GAME_FLOW_RENDERERS,
    )
)
TV_SVG_RENDERERS = frozenset(
    (TV_ROOM_RENDERER, *TV_BOOT_RENDERERS)
)
TV_QR_DEPENDENCIES = {
    "react-native-qrcode-svg": "^6.3.21",
    "react-native-svg": "15.15.4",
}
HEARTBEAT_PALETTE = {
    "cream": "#F9F1E6",
    "espresso": "#2B1F17",
    "coral": "#FF6F61",
    "butter": "#FFD766",
    "mint": "#7FD2B6",
    "sky": "#7CC6FF",
    "lilac": "#C8B6FF",
    "dustyRose": "#E6A3B1",
}
HEARTBEAT_RUNTIME_ROOT = Path("packages/ui/assets/heartbeat")
# The original board is retained as a design reference, but runtime validation
# must not depend on a design manifest or source-master tree. Keep the runtime
# bundle contract here so a stale or incomplete drop fails on its own.
HEARTBEAT_RUNTIME_ASSET_SPECS = {
    "brand/huddle-display-mark.png": (
        (1302, 1208),
        True,
        "3a15f8a54750c994d5834428e2853d77435d7f673d461a4b3a9ac5857d847086",
    ),
    "brand/huddle-launcher-mark.png": (
        (1230, 1278),
        True,
        "9b0ce6cc0b45f8d00326f78e35547d5c2ae1ea8e038151fff8194ed26ac24fc5",
    ),
    "phone/camera-unavailable.png": (
        (1535, 1024),
        False,
        "a6b48aa67353e35b3df98a659c67b4b783d760f439670121281322c12746fdb0",
    ),
    "phone/game-finished.png": (
        (852, 1846),
        False,
        "375dedf497233a0cbec8e7d220c0a6657cd5d17d1541bc523a0fe4affebd2ce9",
    ),
    "phone/game-paused.png": (
        (852, 1846),
        False,
        "dce326b172686f77d88e051fb2f86b99d11b0b3fc9a53340bdd10dc81541786c",
    ),
    "phone/guest-waiting.png": (
        (1402, 1122),
        False,
        "cd3f3e045657e2242b667396d987cb24d22e95cc0ad0850e1c497613b88c4ec1",
    ),
    "phone/identity-environment.png": (
        (853, 1844),
        False,
        "2b89f27e32ac7efb84b1305928f97c0831b5f6096178add23f3678e364b646a6",
    ),
    "phone/identity-sunny-hero.png": (
        (1619, 972),
        False,
        "d8a645d4e614097ba11fd895a6640ba5c49b1b81cf3b02a7ef0f4d480b859cad",
    ),
    "phone/join-environment.png": (
        (853, 1844),
        False,
        "6973da00d287b4de019f8c035d718a382c5954f8d138fa454423290c2f8ba0d5",
    ),
    "phone/manual-join-room.png": (
        (852, 1846),
        False,
        "99161507ca37fc8361eea40862a89e724ec2c1fb54d6f1dbfec5645ade2feb29",
    ),
    "phone/scan-owl-phone.png": (
        (1536, 1024),
        False,
        "4c791bed287864a827d7e8b6d5360172b7340e43c831cbcff370e9f4e148d34e",
    ),
    "phone/seat-lost.png": (
        (852, 1846),
        False,
        "8f78beb04412469398f5947e61adc610403d875e1b9fdb745475caa5a9f453c2",
    ),
    "tv/device-unavailable.png": (
        (1672, 941),
        False,
        "98a7e92ebd59c1f04c8fc78379d887f4cf2835a7039575a69138e3f2aa44d892",
    ),
    "tv/platform-living-room.png": (
        (1672, 941),
        False,
        "6da8a6e181b189fb42d19b9df548a5591e7e1953ddc3ed6f2be5219794f644e5",
    ),
    "tv/platform-stage.png": (
        (1672, 941),
        False,
        "8ad35402c0c7fe4941163cbfe7ce2086a246fcfbdf159e5deb79eaf7f8c21528",
    ),
    "tv/setup-required.png": (
        (1672, 941),
        False,
        "950d0ce4adc47bb6ea5648d8700e47d1507660dfb1c7f3538e0d9f8a26d047a5",
    ),
    "game-cards/doodle-dash.png": (
        (1214, 1295),
        True,
        "387419afe21ef6bc9634bd1414f4a9efc9994099f7a3c3e1f7f24db3cae92681",
    ),
    "game-cards/hot-take.png": (
        (1219, 1290),
        True,
        "c0842f5e7e420593bd9c4d45cba93d1295eed3297d94875922c090f848a3d780",
    ),
    "game-cards/quick-poll.png": (
        (1312, 1199),
        True,
        "68de9640ff83660a252716383cdd344e8723be7ddadfcb3f72f0e0e32f06bab0",
    ),
    "game-cards/trivia.png": (
        (1156, 1360),
        True,
        "387972622160701d8e3f5c8b2b5f5724e4dfb627803c6fd1d4ba8dfe7b57eeab",
    ),
    "game-cards/voting.png": (
        (1214, 1295),
        True,
        "14704bdd2a347690b40479b857d1eeac4bfcdd6c47e87c8bc6d2dcfb75710a38",
    ),
    "game-worlds/trivia.png": (
        (1672, 941),
        False,
        "c6e8d4092a1f80bfb7b9dfb94fb1d04a1d3524747ec9906a5df5d80ed0fa0713",
    ),
    "game-worlds/voting.png": (
        (1672, 941),
        False,
        "2f9148e77527cf5745e46d543ec7087e9842f2c431d637b7f55923973346daab",
    ),
}

# Keep guards for files retired from runtime and design locations. They are
# presence checks only; the validator never requires the design tree to exist.
HEARTBEAT_OBSOLETE_PATHS = (
    Path("docs/design/heartbeat/brand/huddle-tv-banner.svg"),
    Path("docs/design/heartbeat/assets/tv/living-room.png"),
    Path("packages/ui/assets/heartbeat/tv/living-room.png"),
)
NATIVE_ASSET_SPECS = {
    "huddle-app-icon-light.png": (1024, 1024),
    "huddle-app-icon-dark.png": (1024, 1024),
    "huddle-android-legacy.png": (1024, 1024),
    "huddle-android-tv-icon.png": (1024, 1024),
    "huddle-android-adaptive-foreground.png": (1024, 1024),
    "huddle-android-monochrome.png": (1024, 1024),
    "huddle-splash.png": (1024, 1024),
    "huddle-android-tv-banner.png": (640, 360),
}
APPLE_TV_ASSET_SPECS = {
    "huddle-tv-icon-1280x768.png": ((1280, 768), False),
    "huddle-tv-icon-400x240.png": ((400, 240), False),
    "huddle-tv-icon-800x480.png": ((800, 480), False),
    "huddle-tv-top-shelf-1920x720.png": ((1920, 720), False),
    "huddle-tv-top-shelf-3840x1440.png": ((3840, 1440), False),
    "huddle-tv-top-shelf-wide-2320x720.png": ((2320, 720), False),
    "huddle-tv-top-shelf-wide-4640x1440.png": ((4640, 1440), False),
}
APPLE_TV_ASSET_DIGESTS = {
    "huddle-tv-icon-1280x768.png": "bb7701d5d5c8902f9caa2d1b7eb96c643de149e90e728001a0838496ed261892",
    "huddle-tv-icon-400x240.png": "4b0c4e2f08594503a41551e363e1f279c04ce82ba083be1e957cf95f28a7acd6",
    "huddle-tv-icon-800x480.png": "be2c2025cc8c446b493473cc949f68234b8f0448e955a9da93a51284f2941e02",
    "huddle-tv-top-shelf-1920x720.png": "a35d4303e28ae963b56f8d7268092a37064d6554417083904edadb520c6e5d29",
    "huddle-tv-top-shelf-3840x1440.png": "43c1d7c83b683cd1b85b21ebdeea98b6c3b6b3f4445b8834e23f7d647e95a214",
    "huddle-tv-top-shelf-wide-2320x720.png": "5a24772d630167b8ff8dd254232df3a9950f157ebd5bc009d9b1c6fc7e0726e2",
    "huddle-tv-top-shelf-wide-4640x1440.png": "db2ec9a6d91b64aa3f833b71e0849d6f045780ad6cf7dfe29d4a3caef583ccf1",
}
APPLE_TV_CONFIG_KEYS = {
    "icon": "huddle-tv-icon-1280x768.png",
    "iconSmall": "huddle-tv-icon-400x240.png",
    "iconSmall2x": "huddle-tv-icon-800x480.png",
    "topShelf": "huddle-tv-top-shelf-1920x720.png",
    "topShelf2x": "huddle-tv-top-shelf-3840x1440.png",
    "topShelfWide": "huddle-tv-top-shelf-wide-2320x720.png",
    "topShelfWide2x": "huddle-tv-top-shelf-wide-4640x1440.png",
}
ANDROID_DENSITY_SCALE = {
    "mdpi": 1,
    "hdpi": 3 / 2,
    "xhdpi": 2,
    "xxhdpi": 3,
    "xxxhdpi": 4,
}
AVATAR_ASSET_SPECS = {
    "fox.png": (
        (512, 512),
        "1571a4310d83580ec4c12d9168e9d6350a804a7319a6343c8b4e4583f2d59823",
    ),
    "green-alien.png": (
        (512, 512),
        "01fd1533e871a731c54a48240688b25b7fe8d0c36b938c1a91ac6a714b326bda",
    ),
    "pink-bunny.png": (
        (512, 512),
        "eb70730f12611f87ecff6015e4d6a89761b93af862a7bffaded90016c2541efa",
    ),
    "blue-robot.png": (
        (512, 512),
        "faee57422a3ee8616858866745c7684bd16537f3e876d7d4ba753d7a9b7f93fd",
    ),
    "purple-owl.png": (
        (512, 512),
        "e73d4417081ad3be05e71a500f1e650896b538732c496338bb1066502c2cc2a1",
    ),
    "yellow-robot.png": (
        (512, 512),
        "1bc5acdc850cdbcc800643c7e52f1f60275014317a35e04fb6e494c9af065475",
    ),
    "red-robot.png": (
        (512, 512),
        "6629820fcf80570755f4bc242038f0c8852d95fa4dfb828870d69e5ec8f9c20c",
    ),
    "teal-bear.png": (
        (512, 512),
        "afcc43452a1afe8e1da17fc091dca29ea234c8c40ebfc5a7033cb1ea1630de6d",
    ),
    "mint-cat.png": (
        (512, 512),
        "97583e230639f5491c46b8eabe4c90c071675e1cd3bcee38bf957af41ddf08f9",
    ),
    "puppy.png": (
        (512, 512),
        "68dfb88e971fc64ba1f4d2d7d716b5fb7a3ef2adadb52a1e9ed7493e3499867a",
    ),
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
    """Compatibility helper for the current Heartbeat renderer seams."""

    return any(path.resolve() == (root / approved).resolve() for approved in APPROVED_ILLUSTRATED_RENDERERS)


def is_approved_interactive_renderer(path: Path, root: Path = ROOT) -> bool:
    """Compatibility name retained for isolated validator callers."""

    return is_approved_illustrated_renderer(path, root)


def validate_presentation_renderer_scope(
    source: Path, clean_source: str, root: Path = ROOT
) -> None:
    """Keep native-only capabilities in the one app-owned seam that needs them."""

    resolved = source.resolve()
    svg_renderers = {(root / renderer).resolve() for renderer in TV_SVG_RENDERERS}
    room_renderer = (root / TV_ROOM_RENDERER).resolve()
    scan_renderer = (root / PHONE_SCAN_RENDERER).resolve()

    if re.search(r"\b(?:react-native-qrcode-svg|QRCode)\b", clean_source) and resolved != room_renderer:
        fail(f"QR renderer is outside TV Room: {relative(source, root)}")
    if re.search(r"\bCameraView\b", clean_source) and resolved != scan_renderer:
        fail(f"CameraView is outside Phone Scan: {relative(source, root)}")
    if re.search(r"\breact-native-svg\b", clean_source) and resolved not in svg_renderers:
        fail(f"SVG renderer import is outside approved TV renderers: {relative(source, root)}")


TV_CONTROL_REFERENCE = re.compile(
    r"\b(?:Pressable|TextInput|TouchableOpacity|TouchableWithoutFeedback|"
    r"TouchableHighlight|Button|HuddleButton|CameraView|TVEventHandler)\b|"
    r"\b(?:onPress|onLongPress|onFocus|onBlur|hasTVPreferredFocus)\s*[:=]|"
    r"\bfocusable\s*=\s*(?:\{\s*)?true\b|"
    r"accessibilityRole\s*=\s*['\"]button['\"]"
)


def tv_presentation_sources(root: Path = ROOT) -> list[Path]:
    """Return authored TV and game-TV renderers that must remain passive."""

    sources = source_files(root / "apps" / "tv" / "src") if (root / "apps" / "tv" / "src").is_dir() else []
    for game in ("trivia", "voting"):
        path = root / "games" / game / "src" / "tv-screen.tsx"
        if path.is_file():
            sources.append(path)
    return sorted(set(sources))


def validate_tv_display_only(root: Path = ROOT) -> None:
    """Ensure TV sources cannot become controller or D-pad surfaces."""

    for source in tv_presentation_sources(root):
        clean = COMMENTS.sub("", source.read_text(encoding="utf-8"))
        match = TV_CONTROL_REFERENCE.search(clean)
        if match:
            fail(f"TV presentation must remain display-only: {relative(source, root)}")


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


def runtime_module_references(source: str) -> list[re.Match[str]]:
    """Return module edges that survive transpilation into runtime code."""

    return list(MODULE_REFERENCE.finditer(TYPE_ONLY_DECLARATION.sub("", source)))


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
            # The Phone session index intentionally exports the React provider
            # that owns restoration, active-seat handoff, and notices. It is a
            # platform-native seam, not a pure domain barrel.
            session_index = src / "platform" / "session" / "index.ts"
            if entrypoint.name == "index.ts" and entrypoint != session_index and RENDERER_IMPORT.search(source):
                fail(f"pure entrypoint imports renderer code: {relative(entrypoint, root)}")

            if entrypoint.name == "index.ts" and entrypoint != session_index:
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
        for match in runtime_module_references(text):
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
        "game": {"contracts", "domain", "tokens", "ui"},
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
                        for match in runtime_module_references(text):
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
        if target_owner.kind == "ui" and target.name == "reduced-motion.ts":
            return True
        if target_owner.kind == "feature" and target.name in {
            "join-entry.ts",
            "join-rejection.ts",
            "identity.ts",
            "room-code-entry.tsx",
            "settings-choice.ts",
        }:
            return True
        if target_owner.kind == "models" and target.name == "lifecycle-rejection.ts":
            return True
        return target_owner.kind in {"feature", "platform", "models", "ui"} and is_entrypoint(
            target, target_owner
        )
    if source_owner.kind == "feature":
        if target_owner.kind == "ui" and target.name == "reduced-motion.ts":
            return True
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
        for match in runtime_module_references(text):
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
        if len(payload) < 26:
            fail(f"{label} asset has no PNG color metadata: {relative(path, root)}")
        actual_dimensions = struct.unpack(">II", payload[16:24])
        if actual_dimensions != expected_dimensions:
            fail(
                f"{label} asset has wrong dimensions: {relative(path, root)} "
                f"({actual_dimensions}, expected {expected_dimensions})"
            )
        if hashlib.sha256(payload).hexdigest() != expected_digest:
            fail(f"{label} asset differs from supplied PNG: {relative(path, root)}")


def png_dimensions_and_alpha(path: Path, label: str, root: Path = ROOT) -> tuple[tuple[int, int], bool]:
    """Read PNG dimensions and whether the color type carries an alpha channel."""

    payload = path.read_bytes()
    if payload[:8] != b"\x89PNG\r\n\x1a\n" or len(payload) < 26:
        fail(f"{label} asset is not a complete PNG: {relative(path, root)}")
    dimensions = struct.unpack(">II", payload[16:24])
    color_type = payload[25]
    if color_type not in {0, 2, 3, 4, 6}:
        fail(f"{label} asset has an unsupported PNG color type: {relative(path, root)}")
    return dimensions, color_type in {4, 6}


def png_has_heartbeat_mark(path: Path, label: str, root: Path = ROOT) -> bool:
    """Detect the four-colour Heartbeat mark without depending on Pillow.

    Native generators may change PNG encoding and dimensions, so a digest is
    not a useful stale-resource guard for generated launcher/splash files. A
    small, dependency-free decoder lets us reject the previous black-H/white
    resources while accepting resized or re-encoded Heartbeat derivatives.
    """

    payload = path.read_bytes()
    if payload[:8] != b"\x89PNG\r\n\x1a\n":
        return False

    width = height = bit_depth = color_type = interlace = None
    image_data = bytearray()
    offset = 8
    while offset + 12 <= len(payload):
        length = struct.unpack(">I", payload[offset : offset + 4])[0]
        chunk_type = payload[offset + 4 : offset + 8]
        chunk = payload[offset + 8 : offset + 8 + length]
        offset += 12 + length
        if chunk_type == b"IHDR" and len(chunk) >= 13:
            width, height, bit_depth, color_type = struct.unpack(">IIBB", chunk[:10])
            interlace = chunk[12]
        elif chunk_type == b"IDAT":
            image_data.extend(chunk)
        elif chunk_type == b"IEND":
            break

    if not all(value is not None for value in (width, height, bit_depth, color_type, interlace)):
        return False
    if bit_depth != 8 or interlace != 0 or color_type not in {0, 2, 4, 6}:
        return False

    channels = {0: 1, 2: 3, 4: 2, 6: 4}[color_type]
    row_bytes = width * channels
    # Native launcher/splash outputs are at most a few thousand pixels wide;
    # cap the decoded prefix so a future large presentation asset cannot turn
    # this stale-resource guard into a full-image reconstruction. Heartbeat
    # marks are centered or occupy the leading presentation-safe area.
    rows_to_scan = min(height, 1024)
    try:
        decompressor = zlib.decompressobj()
        decoded = decompressor.decompress(bytes(image_data), (row_bytes + 1) * rows_to_scan)
    except Exception:
        return False
    if len(decoded) < rows_to_scan * (row_bytes + 1):
        return False

    # Scan a bounded number of samples after PNG row unfiltering. The exact
    # shades vary between glossy artwork and platform resizes, so use broad
    # Heartbeat hue buckets rather than exact pixels.
    found = {"coral": False, "butter": False, "mint": False, "sky": False}
    previous = bytearray(row_bytes)

    def paeth(a: int, b: int, c: int) -> int:
        estimate = a + b - c
        pa = abs(estimate - a)
        pb = abs(estimate - b)
        pc = abs(estimate - c)
        if pa <= pb and pa <= pc:
            return a
        if pb <= pc:
            return b
        return c

    cursor = 0
    max_samples = 200_000
    sample_stride = max(1, (width * height) // max_samples)
    pixel_index = 0
    for _ in range(rows_to_scan):
        filter_type = decoded[cursor]
        cursor += 1
        current = bytearray(decoded[cursor : cursor + row_bytes])
        cursor += row_bytes
        if len(current) != row_bytes:
            return False
        for index, value in enumerate(current):
            left = current[index - channels] if index >= channels else 0
            above = previous[index]
            upper_left = previous[index - channels] if index >= channels else 0
            if filter_type == 1:
                current[index] = (value + left) & 0xFF
            elif filter_type == 2:
                current[index] = (value + above) & 0xFF
            elif filter_type == 3:
                current[index] = (value + ((left + above) // 2)) & 0xFF
            elif filter_type == 4:
                current[index] = (value + paeth(left, above, upper_left)) & 0xFF
            elif filter_type != 0:
                return False

        for x in range(width):
            if pixel_index % sample_stride:
                pixel_index += 1
                continue
            pixel_index += 1
            base = x * channels
            if color_type == 0:
                red = green = blue = current[base]
            elif color_type == 2:
                red, green, blue = current[base : base + 3]
            elif color_type == 4:
                red = green = blue = current[base]
            else:
                red, green, blue = current[base : base + 3]
            if red > 175 and green < 175 and blue < 180:
                found["coral"] = True
            if red > 175 and green > 125 and blue < 155:
                found["butter"] = True
            if green > 125 and red < 180 and blue > 80:
                found["mint"] = True
            if blue > 145 and red < 180:
                found["sky"] = True
            if all(found.values()):
                return True
        previous = current
    return all(found.values())


def validate_heartbeat_runtime_assets(root: Path = ROOT) -> None:
    """Validate the checked-in Heartbeat runtime artwork without design sources."""

    runtime_root = root / HEARTBEAT_RUNTIME_ROOT
    if not runtime_root.is_dir():
        fail(f"Heartbeat runtime asset directory missing: {relative(runtime_root, root)}")

    expected_paths = set(HEARTBEAT_RUNTIME_ASSET_SPECS)
    actual_paths = {
        str(path.relative_to(runtime_root))
        for path in runtime_root.rglob("*")
        if path.is_file()
    }
    if actual_paths != expected_paths:
        extras = sorted(actual_paths - expected_paths)
        missing = sorted(expected_paths - actual_paths)
        fail(
            "Heartbeat runtime asset bundle is incomplete: "
            f"extras={extras}, missing={missing}"
        )

    for relative_path, (expected_dimensions, expected_alpha, expected_digest) in HEARTBEAT_RUNTIME_ASSET_SPECS.items():
        path = runtime_root / relative_path
        dimensions, has_alpha = png_dimensions_and_alpha(path, "Heartbeat runtime", root)
        if dimensions != expected_dimensions:
            fail(
                f"Heartbeat runtime asset has wrong dimensions: {relative(path, root)} "
                f"({dimensions}, expected {expected_dimensions})"
            )
        if has_alpha != expected_alpha:
            fail(
                f"Heartbeat runtime asset alpha mismatch: {relative(path, root)} "
                f"({has_alpha}, expected {expected_alpha})"
            )
        if hashlib.sha256(path.read_bytes()).hexdigest() != expected_digest:
            fail(f"Heartbeat runtime asset differs from its checked-in digest: {relative(path, root)}")



def validate_avatar_assets(root: Path = ROOT) -> None:
    """Keep the shared runtime avatar resolver on the exact ten-image bundle."""

    validate_png_asset_set(
        root / "packages" / "ui" / "assets" / "avatars",
        AVATAR_ASSET_SPECS,
        "Shared avatar",
        root,
    )


def validate_reference_composite_exclusion(root: Path = ROOT) -> None:
    """Reference composites stay in design docs and never enter Metro."""

    source_root = root / "apps" / "tv" / "src"
    if not source_root.is_dir():
        return
    for source in source_files(source_root):
        if "tv-lobby-empty.png" in source.read_text(encoding="utf-8"):
            fail(
                f"TV Room reference composite is imported at runtime: {relative(source, root)}"
            )


def validate_heartbeat_tokens(root: Path = ROOT) -> None:
    """Require the exact Heartbeat palette and token-based screen colors."""

    colors_path = root / "packages" / "design-tokens" / "src" / "colors.ts"
    if not colors_path.is_file():
        fail(f"Heartbeat color token source missing: {relative(colors_path, root)}")
    source = colors_path.read_text(encoding="utf-8")
    match = re.search(r"export const brandColors = \{(?P<body>.*?)\}\s+as const;", source, re.DOTALL)
    if match is None:
        fail("Heartbeat brand color token map is missing")
    actual = dict(re.findall(r"^\s*([A-Za-z][A-Za-z0-9]*):\s*['\"](#[0-9A-Fa-f]{6})['\"]", match.group("body"), re.MULTILINE))
    if actual != HEARTBEAT_PALETTE:
        fail(f"Heartbeat palette differs from the approved board: {actual}")

    semantic_match = re.search(r"export const semanticColors = \{(?P<body>.*?)\}\s+as const;", source, re.DOTALL)
    if semantic_match is None:
        fail("Heartbeat semantic color roles are missing")
    semantic = dict(re.findall(r"^\s*([A-Za-z][A-Za-z0-9]*):\s*brandColors\.([A-Za-z][A-Za-z0-9]*)", semantic_match.group("body"), re.MULTILINE))
    expected_semantic = {
        "background": "cream",
        "surface": "cream",
        "surfaceRaised": "cream",
        "text": "espresso",
        "textOnBrand": "espresso",
        "primary": "coral",
        "primaryText": "espresso",
        "secondary": "butter",
        "success": "mint",
        "info": "sky",
        "accent": "lilac",
        "highlight": "dustyRose",
        "border": "espresso",
    }
    if semantic != expected_semantic:
        fail(f"Heartbeat semantic roles differ from the approved system: {semantic}")

    # Screen source may use only approved board colors. The legacy neutral map
    # is retained for persisted compatibility but is not a runtime surface.
    hex_literal = re.compile(r"#[0-9A-Fa-f]{6}")
    approved_hexes = set(HEARTBEAT_PALETTE.values())
    for base in (root / "apps", root / "games", root / "packages" / "ui"):
        for path in source_files(base):
            if path == colors_path or ".test." in path.name:
                continue
            clean = COMMENTS.sub("", path.read_text(encoding="utf-8"))
            literals = {value.upper() for value in hex_literal.findall(clean)}
            if not literals.issubset(approved_hexes):
                fail(f"unapproved color literal in Heartbeat source: {relative(path, root)}")


def validate_native_assets(root: Path = ROOT) -> None:
    """Validate launcher, splash, adaptive, TV, and Apple TV derivatives."""

    asset_root = root / "packages" / "ui" / "assets" / "app-icons"
    alpha_expected = {
        "huddle-android-adaptive-foreground.png": True,
        "huddle-android-monochrome.png": True,
    }
    for name, dimensions in NATIVE_ASSET_SPECS.items():
        path = asset_root / name
        if not path.is_file():
            fail(f"Heartbeat native asset missing: {relative(path, root)}")
        actual_dimensions, has_alpha = png_dimensions_and_alpha(path, "Heartbeat native", root)
        if actual_dimensions != dimensions:
            fail(
                f"Heartbeat native asset has wrong dimensions: {relative(path, root)} "
                f"({actual_dimensions}, expected {dimensions})"
            )
        expected_alpha = alpha_expected.get(name, False)
        if has_alpha != expected_alpha:
            fail(
                f"Heartbeat native asset alpha mismatch: {relative(path, root)} "
                f"({has_alpha}, expected {expected_alpha})"
            )

        # The monochrome foreground is intentionally one colour. Every other
        # identity derivative must visibly carry the four-heart mark so an old
        # black-H resource cannot silently pass dimension checks.
        if name != "huddle-android-monochrome.png" and not png_has_heartbeat_mark(
            path, "Heartbeat native", root
        ):
            fail(f"Heartbeat native asset does not contain the current four-heart mark: {relative(path, root)}")

    apple_tv_root = asset_root / "apple-tv"
    if not apple_tv_root.is_dir():
        fail(f"Apple TV native asset directory missing: {relative(apple_tv_root, root)}")
    actual_apple_tv = {path.name for path in apple_tv_root.iterdir() if path.is_file()}
    if actual_apple_tv != set(APPLE_TV_ASSET_SPECS):
        fail(
            "Apple TV native assets must contain exactly the seven configured derivatives: "
            f"extras={sorted(actual_apple_tv - set(APPLE_TV_ASSET_SPECS))}, "
            f"missing={sorted(set(APPLE_TV_ASSET_SPECS) - actual_apple_tv)}"
        )
    for name, (dimensions, expected_alpha) in APPLE_TV_ASSET_SPECS.items():
        path = apple_tv_root / name
        actual_dimensions, has_alpha = png_dimensions_and_alpha(path, "Apple TV native", root)
        if actual_dimensions != dimensions:
            fail(
                f"Apple TV native asset has wrong dimensions: {relative(path, root)} "
                f"({actual_dimensions}, expected {dimensions})"
            )
        if has_alpha != expected_alpha:
            fail(
                f"Apple TV native asset alpha mismatch: {relative(path, root)} "
                f"({has_alpha}, expected {expected_alpha})"
            )
        expected_digest = APPLE_TV_ASSET_DIGESTS[name]
        if hashlib.sha256(path.read_bytes()).hexdigest() != expected_digest:
            fail(f"Apple TV native asset differs from the deterministic current derivative: {relative(path, root)}")


def resolve_config_asset(config_path: Path, configured: object, root: Path, label: str) -> Path:
    """Resolve an Expo asset path and require it stays inside this project."""

    if not isinstance(configured, str):
        fail(f"{label} must be a string asset path")
    resolved = (config_path.parent / configured).resolve()
    if not resolved.is_relative_to(root.resolve()):
        fail(f"{label} escapes the project: {configured}")
    if not resolved.is_file():
        fail(f"{label} is missing: {relative(resolved, root)}")
    return resolved


def require_config_asset(
    config_path: Path,
    configured: object,
    expected: Path,
    root: Path,
    label: str,
) -> None:
    actual = resolve_config_asset(config_path, configured, root, label)
    if actual.resolve() != expected.resolve():
        fail(
            f"{label} must use the current Heartbeat derivative: "
            f"{relative(actual, root)} (expected {relative(expected, root)})"
        )


def splash_plugin_options(expo: dict[str, object]) -> dict[str, object]:
    """Return the configured expo-splash-screen options for an app."""

    plugins = expo.get("plugins")
    if not isinstance(plugins, list):
        fail("Expo plugins must be a list for native identity validation")
    for plugin in plugins:
        if isinstance(plugin, list) and plugin and plugin[0] == "expo-splash-screen":
            options = plugin[1] if len(plugin) > 1 else {}
            if not isinstance(options, dict):
                fail("expo-splash-screen options must be an object")
            return options
    fail("Expo splash-screen plugin is missing")


def tv_plugin_options(expo: dict[str, object]) -> dict[str, object]:
    plugins = expo.get("plugins")
    if not isinstance(plugins, list):
        fail("TV Expo plugins must be a list for Apple TV identity validation")
    for plugin in plugins:
        if isinstance(plugin, list) and plugin and plugin[0] == "@react-native-tvos/config-tv":
            options = plugin[1] if len(plugin) > 1 else {}
            if not isinstance(options, dict):
                fail("@react-native-tvos/config-tv options must be an object")
            return options
    fail("TV Expo config-tv plugin is missing")


def validate_native_config(root: Path = ROOT) -> None:
    """Ensure both Expo apps point at the current shared identity derivatives."""

    asset_root = root / "packages" / "ui" / "assets" / "app-icons"
    shared = {
        "icon": asset_root / "huddle-app-icon-light.png",
        "android.icon": asset_root / "huddle-android-legacy.png",
        "android.adaptiveIcon.foregroundImage": asset_root / "huddle-android-adaptive-foreground.png",
        "android.adaptiveIcon.monochromeImage": asset_root / "huddle-android-monochrome.png",
        "ios.icon.light": asset_root / "huddle-app-icon-light.png",
        "ios.icon.dark": asset_root / "huddle-app-icon-dark.png",
        "splash.image": asset_root / "huddle-splash.png",
    }
    for app_name in APP_NAMES:
        config_path = root / "apps" / app_name / "app.json"
        if not config_path.is_file():
            fail(f"Expo config missing: {relative(config_path, root)}")
        expo = json.loads(config_path.read_text(encoding="utf-8")).get("expo")
        if not isinstance(expo, dict):
            fail(f"Expo config has no expo object: {relative(config_path, root)}")
        require_config_asset(config_path, expo.get("icon"), shared["icon"], root, f"{app_name} icon")

        android = expo.get("android")
        if not isinstance(android, dict):
            fail(f"{app_name} Android identity configuration is missing")
        require_config_asset(config_path, android.get("icon"), shared["android.icon"], root, f"{app_name} Android icon")
        adaptive = android.get("adaptiveIcon")
        if not isinstance(adaptive, dict):
            fail(f"{app_name} Android adaptive icon configuration is missing")
        require_config_asset(
            config_path,
            adaptive.get("foregroundImage"),
            shared["android.adaptiveIcon.foregroundImage"],
            root,
            f"{app_name} Android adaptive foreground",
        )
        require_config_asset(
            config_path,
            adaptive.get("monochromeImage"),
            shared["android.adaptiveIcon.monochromeImage"],
            root,
            f"{app_name} Android monochrome foreground",
        )
        if adaptive.get("backgroundColor") != HEARTBEAT_PALETTE["cream"]:
            fail(f"{app_name} Android adaptive background must use Heartbeat cream")

        ios = expo.get("ios")
        if not isinstance(ios, dict) or not isinstance(ios.get("icon"), dict):
            fail(f"{app_name} iOS icon configuration is missing")
        ios_icon = ios["icon"]
        require_config_asset(config_path, ios_icon.get("light"), shared["ios.icon.light"], root, f"{app_name} iOS light icon")
        require_config_asset(config_path, ios_icon.get("dark"), shared["ios.icon.dark"], root, f"{app_name} iOS dark icon")

        splash_options = splash_plugin_options(expo)
        require_config_asset(config_path, splash_options.get("image"), shared["splash.image"], root, f"{app_name} splash image")
        if splash_options.get("backgroundColor") != HEARTBEAT_PALETTE["cream"]:
            fail(f"{app_name} splash background must use Heartbeat cream")

        if app_name != "tv":
            continue
        tv_options = tv_plugin_options(expo)
        if tv_options.get("isTV") is not True or tv_options.get("androidTVRequired") is not True:
            fail("TV config must keep Android TV required and tvOS experimental")
        require_config_asset(
            config_path,
            tv_options.get("androidTVIcon"),
            asset_root / "huddle-android-tv-icon.png",
            root,
            "TV Android icon",
        )
        require_config_asset(
            config_path,
            tv_options.get("androidTVBanner"),
            asset_root / "huddle-android-tv-banner.png",
            root,
            "TV Android banner",
        )
        apple_images = tv_options.get("appleTVImages")
        if not isinstance(apple_images, dict) or set(apple_images) != set(APPLE_TV_CONFIG_KEYS):
            fail("TV config must define all seven Apple TV identity derivatives")
        for key, filename in APPLE_TV_CONFIG_KEYS.items():
            require_config_asset(
                config_path,
                apple_images.get(key),
                asset_root / "apple-tv" / filename,
                root,
                f"TV Apple TV {key}",
            )


def validate_android_cream_background(path: Path, root: Path, label: str) -> None:
    """Check generated Android colors without requiring an XML parser."""

    if not path.is_file():
        fail(f"{label} colors missing: {relative(path, root)}")
    source = path.read_text(encoding="utf-8")
    expected = HEARTBEAT_PALETTE["cream"]
    for name in ("splashscreen_background", "activityBackground"):
        match = re.search(rf'<color\s+name="{name}">(?P<value>#[0-9A-Fa-f]{{6}})</color>', source)
        if match is None or match.group("value").upper() != expected:
            fail(f"{label} {name} must be {expected}")


def validate_ios_cream_background(path: Path, root: Path, label: str) -> None:
    if not path.is_file():
        fail(f"{label} colorset missing: {relative(path, root)}")
    try:
        colorset = json.loads(path.read_text(encoding="utf-8"))
        components = colorset["colors"][0]["color"]["components"]
        expected = {"red": 249 / 255, "green": 241 / 255, "blue": 230 / 255, "alpha": 1.0}
        for channel, value in expected.items():
            if abs(float(components[channel]) - value) > 0.00001:
                fail(f"{label} {channel} must match Heartbeat cream")
    except (KeyError, IndexError, TypeError, ValueError, json.JSONDecodeError) as error:
        fail(f"{label} colorset is malformed: {error}")


def validate_native_generated_resources(root: Path = ROOT) -> None:
    """Inspect existing prebuild output while remaining usable before prebuild."""

    for app_name in APP_NAMES:
        app_root = root / "apps" / app_name
        ios_root = app_root / "ios"
        android_root = app_root / "android"
        if not ios_root.exists() and not android_root.exists():
            # Native folders are intentionally ignored build output. Config
            # and source derivatives are still checked on clean checkouts.
            continue

        if ios_root.is_dir():
            image_root = ios_root / "Huddle" / "Images.xcassets"
            icon_root = image_root / "AppIcon.appiconset"
            for filename in ("App-Icon-1024x1024@1x.png", "App-Icon-dark-1024x1024@1x.png"):
                icon = icon_root / filename
                if not icon.is_file():
                    fail(f"{app_name} iOS icon missing: {relative(icon, root)}")
                dimensions, _ = png_dimensions_and_alpha(icon, f"{app_name} iOS", root)
                if dimensions != (1024, 1024) or not png_has_heartbeat_mark(icon, f"{app_name} iOS", root):
                    fail(f"{app_name} iOS icon is stale: {relative(icon, root)}")
            splash_root = image_root / "SplashScreenLogo.imageset"
            splash = splash_root / "image@3x.png"
            if not splash.is_file() or png_dimensions_and_alpha(splash, f"{app_name} iOS", root)[0] != (480, 480) or not png_has_heartbeat_mark(splash, f"{app_name} iOS", root):
                fail(f"{app_name} iOS splash logo is stale or missing: {relative(splash, root)}")
            validate_ios_cream_background(
                image_root / "SplashScreenBackground.colorset" / "Contents.json",
                root,
                f"{app_name} iOS splash",
            )

            if app_name == "tv":
                apple_root = image_root / "TVAppIcon.brandassets"
                native_map = {
                    "huddle-tv-icon-1280x768.png": apple_root / "App Icon - Large.imagestack" / "Front.imagestacklayer" / "Content.imageset" / "huddle-tv-icon-1280x768.png",
                    "huddle-tv-icon-400x240.png": apple_root / "App Icon - Small.imagestack" / "Front.imagestacklayer" / "Content.imageset" / "huddle-tv-icon-400x240.png",
                    "huddle-tv-icon-800x480.png": apple_root / "App Icon - Small.imagestack" / "Front.imagestacklayer" / "Content.imageset" / "huddle-tv-icon-800x480.png",
                    "huddle-tv-top-shelf-1920x720.png": apple_root / "Top Shelf Image.imageset" / "huddle-tv-top-shelf-1920x720.png",
                    "huddle-tv-top-shelf-3840x1440.png": apple_root / "Top Shelf Image.imageset" / "huddle-tv-top-shelf-3840x1440.png",
                    "huddle-tv-top-shelf-wide-2320x720.png": apple_root / "Top Shelf Image Wide.imageset" / "huddle-tv-top-shelf-wide-2320x720.png",
                    "huddle-tv-top-shelf-wide-4640x1440.png": apple_root / "Top Shelf Image Wide.imageset" / "huddle-tv-top-shelf-wide-4640x1440.png",
                }
                for filename, native in native_map.items():
                    source = root / "packages" / "ui" / "assets" / "app-icons" / "apple-tv" / filename
                    if not native.is_file() or hashlib.sha256(native.read_bytes()).hexdigest() != hashlib.sha256(source.read_bytes()).hexdigest():
                        fail(f"TV Apple TV native derivative is stale: {relative(native, root)}")

        if android_root.is_dir():
            resource_root = android_root / "app" / "src" / "main" / "res"
            validate_android_cream_background(resource_root / "values" / "colors.xml", root, f"{app_name} Android")
            xxxhdpi_splash = resource_root / "drawable-xxxhdpi" / "splashscreen_logo.png"
            if not xxxhdpi_splash.is_file() or not png_has_heartbeat_mark(xxxhdpi_splash, f"{app_name} Android", root):
                fail(f"{app_name} Android splash logo is stale or missing: {relative(xxxhdpi_splash, root)}")
            if app_name == "tv":
                source_root = root / "packages" / "ui" / "assets" / "app-icons"
                for filename in ("tv_icon.png", "tv_banner.png"):
                    native = resource_root / "drawable" / filename
                    source = source_root / ("huddle-android-tv-icon.png" if filename == "tv_icon.png" else "huddle-android-tv-banner.png")
                    if not native.is_file() or hashlib.sha256(native.read_bytes()).hexdigest() != hashlib.sha256(source.read_bytes()).hexdigest():
                        fail(f"TV Android {filename} is stale: {relative(native, root)}")
            else:
                for density, scale in ANDROID_DENSITY_SCALE.items():
                    density_root = resource_root / f"mipmap-{density}"
                    for filename, base_size in (("ic_launcher.webp", 48), ("ic_launcher_round.webp", 48), ("ic_launcher_foreground.webp", 108), ("ic_launcher_monochrome.webp", 108)):
                        native = density_root / filename
                        if not native.is_file():
                            fail(f"Phone Android launcher resource missing: {relative(native, root)}")
                        dimensions, _ = png_dimensions_and_alpha(native, "Phone Android", root)
                        expected = int(base_size * scale)
                        if dimensions != (expected, expected):
                            fail(f"Phone Android launcher resource has wrong dimensions: {relative(native, root)}")
                        if filename != "ic_launcher_monochrome.webp" and not png_has_heartbeat_mark(native, "Phone Android", root):
                            fail(f"Phone Android launcher resource is stale: {relative(native, root)}")


def validate_no_obsolete_surface_paths(root: Path = ROOT) -> None:
    """Keep removed clean-slate surfaces and duplicate asset trees out of source."""

    obsolete_paths = (
        root / "packages" / "ui" / "src" / "native" / "purpose-screen.tsx",
        root / "apps" / "phone" / "src" / "features" / "join" / "join-form.tsx",
        root / "apps" / "phone" / "src" / "features" / "join" / "join-form.render.test.tsx",
        root / "apps" / "phone" / "src" / "features" / "join" / "join-room-screen.tsx",
        root / "apps" / "phone" / "src" / "features" / "join" / "join-room-screen.render.test.tsx",
        root / "apps" / "tv" / "src" / "ui" / "native.ts",
        root / "apps" / "tv" / "src" / "ui" / "purpose-screen.render.test.tsx",
        root / "apps" / "phone" / "src" / "ui" / "purpose-screen.render.test.tsx",
        root / "apps" / "phone" / "assets" / "join-room",
        root / "apps" / "tv" / "assets" / "game-flow",
        root / "apps" / "tv" / "assets" / "room-invitation",
    )
    for path in obsolete_paths:
        if path.exists():
            fail(f"obsolete Heartbeat surface path remains: {relative(path, root)}")

    obsolete_terms = re.compile(r"\bPurposeScreen\b|purpose-screen|\bJoinForm\b|join-form|\bJoinRoomScreen\b|join-room-screen")
    for base in (root / "apps", root / "packages", root / "games", root / "tools"):
        for path in source_files(base):
            if obsolete_terms.search(path.read_text(encoding="utf-8")):
                fail(f"obsolete Heartbeat surface reference remains: {relative(path, root)}")


def validate_heartbeat_brand_source_set(root: Path = ROOT) -> None:
    """Reject explicitly retired Heartbeat brand and artwork files.

    This is deliberately a presence guard, not a source-master validation
    step. The design folder may contain only the original board reference.
    """

    for relative_path in HEARTBEAT_OBSOLETE_PATHS:
        path = root / relative_path
        if path.exists():
            fail(f"obsolete Heartbeat artwork remains: {relative(path, root)}")


def validate_consolidation(root: Path = ROOT) -> None:
    """Guard Heartbeat tokens, native boundaries, identity, and runtime assets."""

    forbidden_paths = (
        root / "apps" / "controller",
        root / "packages" / "game-core",
        root / "packages" / "games",
    )
    for path in forbidden_paths:
        if path.exists():
            fail(f"superseded package path exists: {relative(path, root)}")

    phone_config_path = root / "apps" / "phone" / "app.json"
    phone = json.loads(phone_config_path.read_text(encoding="utf-8"))["expo"]
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
        r"(?:nativewind|react-native-css-interop|tailwindcss|expo-image|react-native-reanimated|"
        r"lucide-react-native|@react-native-community/netinfo|@huddle/ui/(?:kit|fonts))"
    )
    for base in (root / "apps", root / "packages" / "ui", root / "games"):
        for source in source_files(base):
            if "future" in source.parts or ".test." in source.name:
                continue
            clean = COMMENTS.sub("", source.read_text(encoding="utf-8"))
            if forbidden_modules.search(clean):
                fail(f"superseded presentation dependency remains: {relative(source, root)}")
            validate_presentation_renderer_scope(source, clean, root)

    validate_heartbeat_tokens(root)
    validate_tv_display_only(root)

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
        "lucide-react-native",
        "@react-native-community/netinfo",
        "@expo-google-fonts/inter",
    }
    for manifest in manifests:
        payload = json.loads(manifest.read_text(encoding="utf-8"))
        for field in ("dependencies", "devDependencies", "optionalDependencies", "peerDependencies"):
            declared = payload.get(field, {})
            if isinstance(declared, dict):
                found = banned_dependencies.intersection(declared)
                if found:
                    fail(f"removed presentation dependency remains: {relative(manifest, root)} -> {sorted(found)[0]}")

    for app in ("phone", "tv"):
        manifest = root / "apps" / app / "package.json"
        payload = json.loads(manifest.read_text(encoding="utf-8"))
        if payload.get("dependencies", {}).get("@expo-google-fonts/nunito") != "0.4.2":
            fail(f"{app} must pin @expo-google-fonts/nunito@0.4.2")

    native_worklets_manifests = {
        root / "apps" / "phone" / "package.json",
        root / "apps" / "tv" / "package.json",
    }
    for manifest in manifests:
        payload = json.loads(manifest.read_text(encoding="utf-8"))
        declared_version = payload.get("dependencies", {}).get("react-native-worklets")
        if manifest in native_worklets_manifests:
            if declared_version != "0.10.1":
                fail(
                    "native clients must pin react-native-worklets 0.10.1 for "
                    f"Reanimated compatibility: {relative(manifest, root)}"
                )
        elif declared_version is not None:
            fail(
                "react-native-worklets is limited to native client compatibility: "
                f"{relative(manifest, root)}"
            )

    validate_qr_dependency_scope(root)
    validate_native_assets(root)
    validate_native_config(root)
    validate_native_generated_resources(root)
    validate_heartbeat_runtime_assets(root)
    validate_avatar_assets(root)
    validate_reference_composite_exclusion(root)

    forbidden_asset_dirs = ("game-art", "icons", "logo", "phone-backgrounds", "tv-backgrounds")
    for name in forbidden_asset_dirs:
        path = root / "packages" / "ui" / "assets" / name
        if path.exists():
            fail(f"superseded artwork directory exists: {relative(path, root)}")

    for app in APP_NAMES:
        config_path = root / "apps" / app / "app.json"
        config = json.loads(config_path.read_text(encoding="utf-8"))["expo"]
        if config.get("backgroundColor") != "#F9F1E6":
            fail(f"{app} native background must use Heartbeat cream")
        encoded = json.dumps(config)
        referenced = set(re.findall(r"huddle-[a-z0-9-]+\.png", encoded))
        if not referenced.issubset(set(NATIVE_ASSET_SPECS) | set(APPLE_TV_CONFIG_KEYS.values())):
            fail(f"{app} config references an undeclared native asset")
        if "huddle-splash.png" not in referenced:
            fail(f"{app} config must reference the Heartbeat splash asset")

    if "expo-camera" not in phone_config_path.read_text(encoding="utf-8"):
        fail("Phone Expo Camera configuration must remain")

    stale = re.compile(r"apps/controller|@huddle/controller|packages/games|@huddle/game-core")
    for base in (root / "apps", root / "packages", root / "games", root / "convex", root / "tools"):
        for source in source_files(base):
            if stale.search(source.read_text(encoding="utf-8")):
                fail(f"superseded platform/package term remains: {relative(source, root)}")

    validate_no_obsolete_surface_paths(root)
    validate_heartbeat_brand_source_set(root)


def main() -> int:
    for name in APP_NAMES:
        validate_app(ROOT / "apps" / name)
    validate_package_boundaries(ROOT)
    validate_consolidation(ROOT)

    print("App architecture validation passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
