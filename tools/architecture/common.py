from __future__ import annotations

import hashlib

import re

import json

import struct

import zlib

from dataclasses import dataclass

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

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
    r"^[a-z0-9]+(?:-[a-z0-9]+)*(?:\.web)?(?:\.(?:render\.)?test)?\.(?:ts|tsx)$"
)

KEBAB_DIR = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")

RENDERER_IMPORT = re.compile(
    r"['\"](?:react|react-native(?:/[^'\"]*)?|expo(?:/[^'\"]*)?)['\"]"
)

SHARED_RENDERER_IMPORT = re.compile(r"['\"]@huddle/ui/(?:kit|native)['\"]")

SERVER_CONTENT_IMPORT = re.compile(
    r"(?:curated-pack|questions|prompts|server|node:[a-z0-9_/]+)", re.IGNORECASE
)

PHONE_SCAN_RENDERER = Path("apps/phone/src/features/scan/scan-screen.tsx")

TV_ROOM_RENDERER = Path("apps/tv/src/features/room/room-invitation-screen.tsx")

TV_BOOT_RENDERER = Path("apps/tv/src/features/boot/tv-creating-room-screen.tsx")

TV_RESTORE_RENDERER = Path("apps/tv/src/features/boot/tv-restoring-room-screen.tsx")

TV_RESTORE_INDICATOR = Path("apps/tv/src/features/boot/tv-restore-indicator.tsx")

TV_BOOT_RENDERERS = frozenset(
    (TV_BOOT_RENDERER, TV_RESTORE_RENDERER, TV_RESTORE_INDICATOR)
)

TV_SVG_RENDERERS = frozenset(
    (TV_ROOM_RENDERER, *TV_BOOT_RENDERERS)
)

TV_QR_DEPENDENCIES = {
    "react-native-qrcode-svg": "^6.3.21",
    "react-native-svg": "15.15.4",
}

PLAYROOM_PALETTE = {
    "canvas": "#F9F1E6",
    "surface": "#FFFCF7",
    "ink": "#2D0B4E",
    "muted": "#6D5B79",
    "orange": "#FF781F",
    "lavender": "#E3D9FF",
    "border": "#D8CCDF",
    "success": "#286447",
    "successSurface": "#D4F1CC",
    "danger": "#A52C44",
    "dangerSurface": "#FFE0E5",
    "disabled": "#E5DEE9",
}

BOMB_SQUAD_PALETTE = {
    "night": "#1B1530", "panel": "#2A2147", "panelEdge": "#4A3D78", "cream": "#FFF6E5",
    "muted": "#A99BC6", "hazard": "#FFC83D", "spark": "#FF8A3D", "danger": "#FF5A5F",
    "safe": "#3BB273", "wireRed": "#E5484D", "wireBlue": "#4C7BF3", "wireYellow": "#F6C445",
    "bodyLight": "#6B4FA3", "rope": "#E8D3B0", "ropeBurnt": "#5A4A3A", "metalLight": "#E3D9FF",
    "metalDark": "#5E5279", "safeLight": "#6FD69C", "safeDark": "#1F7A4A", "white": "#FFFFFF",
}

SUMO_BUMPERS_PALETTE = {
    "sea": "#0E2A47", "seaDeep": "#071A2E", "wave": "#1D4E7A", "ice": "#EAF6FF", "iceShade": "#B9DDF5",
    "rim": "#FFFFFF", "hazard": "#FF6B4A", "ink": "#10233A", "cream": "#FFF8EE", "muted": "#9DB7D1",
    "gold": "#FFC93C", "ghost": "#C9B8FF", "you": "#3DDC97", "panel": "#163A5E", "panelEdge": "#2B5C8A",
}

COSMIC_QUIZ_PALETTE = {
    "navy": "#041B39",
    "navyDeep": "#021226",
    "cream": "#FFF8EB",
    "turquoise": "#79E1DE",
    "butter": "#FFDB74",
    "coral": "#FFA095",
    "periwinkle": "#B9AAFB",
    "muted": "#5B6B82",
    "correct": "#1E7A55",
    "missed": "#6B7891",
}

ASSETS = json.loads((Path(__file__).with_name("assets.json")).read_text(encoding="utf-8"))

RUNTIME_ASSET_BUNDLES = tuple(
    (
        bundle["label"],
        Path(directory),
        {name: (tuple(spec["size"]), spec["alpha"], spec["sha256"]) for name, spec in bundle["files"].items()},
    )
    for directory, bundle in ASSETS["runtime"].items()
)

NATIVE_ASSET_SPECS = {name: tuple(size) for name, size in ASSETS["native"].items()}

APPLE_TV_ASSET_SPECS = {name: (tuple(spec["size"]), spec["alpha"]) for name, spec in ASSETS["appleTv"].items()}

APPLE_TV_ASSET_DIGESTS = {name: spec["sha256"] for name, spec in ASSETS["appleTv"].items()}

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


TV_CONTROL_REFERENCE = re.compile(
    r"\b(?:Pressable|TextInput|TouchableOpacity|TouchableWithoutFeedback|"
    r"TouchableHighlight|Button|CameraView|TVEventHandler)\b|"
    r"\b(?:onPress|onLongPress|onFocus|onBlur|hasTVPreferredFocus)\s*[:=]|"
    r"\bfocusable\s*=\s*(?:\{\s*)?true\b|"
    r"accessibilityRole\s*=\s*['\"]button['\"]"
)

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

    return list(MODULE_REFERENCE.finditer(TYPE_ONLY_DECLARATION.sub("", source)))

def is_entrypoint(path: Path, owner: Owner) -> bool:
    return path == owner.root / "index.ts" or path == owner.root / "native.ts"

def renderer_import(source: str) -> re.Match[str] | None:

    return RENDERER_IMPORT.search(source) or SHARED_RENDERER_IMPORT.search(source)

def export_values(value: object) -> list[str]:

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
    if rel[:2] == ("packages", "physics"):
        return "physics"
    if rel[:2] == ("packages", "room-host"):
        return "host"
    if rel[0] == "games":
        return "game"
    return "package"

ROOM_HOST_ALLOWED_IMPORT = re.compile(
    r"^(?:\.{1,2}/.*|@huddle/contracts|@huddle/contracts/protocol|@huddle/domain|@huddle/game-registry/logic|zod)$"
)

ROOM_HOST_PLATFORM_GLOBAL = re.compile(r"\b(?:process|Buffer|require|__dirname|structuredClone)\b")

TV_NATIVE_ONLY_IMPORT = re.compile(
    r"['\"](?:expo-secure-store|expo-crypto|expo-file-system|expo-haptics|expo-camera|"
    r"@react-native-async-storage/async-storage|react-native-tcp-socket)['\"]|"
    r"\b(?:requireNativeModule|requireOptionalNativeModule|NativeModules|TurboModuleRegistry)\b"
)

SKIA_IMPORT = re.compile(r"['\"]@shopify/react-native-skia['\"]")
