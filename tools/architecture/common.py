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

PLAYROOM_RUNTIME_ASSET_SPECS = {
    "moments/high-five.png": ((1254, 1254), True, "ddc9014f2e7b31f88e2d707cfb2c051b7b6d542fbefc34f80247dd66188d2d5e"),
    "moments/eyes-on-the-tv.png": ((1254, 1254), True, "617b4c200d508f046419b57053678611ef61165da26f7f19325ded97ba91ea1f"),
    "moments/game-night-lounge.png": ((1254, 1254), True, "c3db0c442925cfec8f0caeef1fcf7fb33a6f525f6a0a4d703a2de54549149dfb"),
    "avatars/blue-robot.png": (
        (640, 640),
        True,
        "16eb753daadf920ccb11304d42a93a0c81efd9506d87f0bbdd88de32c8d0e725",
    ),
    "avatars/fox.png": (
        (640, 640),
        True,
        "8096ca609f049793226a656985408c539c5fe8e7546d02ef489e7050f1963771",
    ),
    "avatars/green-alien.png": (
        (640, 640),
        True,
        "2c9a3bd403ea10b17089628574c5f280f14d1b6390e12898bc32836a627a91c9",
    ),
    "avatars/mint-cat.png": (
        (640, 640),
        True,
        "153464575d6141753cd835b41462fbfa117b1a43457d7c7bd5fbcac25db82e96",
    ),
    "avatars/pink-bunny.png": (
        (640, 640),
        True,
        "ef0d9583fa1f43baae4cdc7c7b09e658f167e54001226414e935642bc18b7880",
    ),
    "avatars/puppy.png": (
        (640, 640),
        True,
        "a0f6b0254d89e4821b0e455588db3ffc5d75a95e627b489852d35b1c9fcd652e",
    ),
    "avatars/purple-owl.png": (
        (640, 640),
        True,
        "95111a07a0100f761ed275b901b0c244bf8e6036b1f4a8e5a02677db308320b6",
    ),
    "avatars/red-robot.png": (
        (640, 640),
        True,
        "29d4444d07d5de221c61ca3d9511080b9d51f449962371df059cdb7815a12994",
    ),
    "avatars/teal-bear.png": (
        (640, 640),
        True,
        "3815fa159d72c73c9c50f3adf3d031995a737bbb3afd2322fcd5eb7c6d39c064",
    ),
    "avatars/yellow-robot.png": (
        (640, 640),
        True,
        "316938de3e5e0f025c25d9e63c2a93c14ef0a674379403267be20e0075fc2e6a",
    ),
    "brand/splash.png": (
        (1024, 1024),
        True,
        "f6cda025c18cd760a779f04c511ed540fa74135de05174fdc80eb3c3991eefdd",
    ),
    "brand/wordmark.png": (
        (1200, 318),
        True,
        "7e1b6907c29f8cd52883d0f337db8bce71a7b581ccfd698a68106a573f0529e1",
    ),
    "games/bomb-squad.png": (
        (1200, 750),
        True,
        "d8a52f1d10188aa60f6a5ff9652f3fda8b1522878a0a36afdfa27a086809c5ee",
    ),
    "games/sumo-bumpers.png": (
        (1200, 750),
        True,
        "f310ddd42690b1b4405e3f52add53586fd53a98466f31a5085ae55dc285f9e44",
    ),
    "games/trivia.png": (
        (1200, 750),
        True,
        "8a24aaae1285848cbd3141d3e3c0d6eb1d109ad3802c4ddceb3cf8647a951698",
    ),
    "props/ball-cream.png": (
        (512, 512),
        True,
        "9e631c3fd82ffacd16db567c49fdb578a0222409b34654c913a0a09e09e43a35",
    ),
    "props/ball-orange.png": (
        (512, 512),
        True,
        "2f584e1a35509aa604236a868a8f427ea290fb179247942e262654dde2e79c61",
    ),
    "props/ball-purple.png": (
        (512, 512),
        True,
        "d3fd8ed08ae97df33264b5fcbb0f61e4ff0b7fb422605e4b23dd0d34efa94af1",
    ),
    "props/controller.png": (
        (512, 512),
        True,
        "16e56ef19ae2602f5447aab4f252ea24c5d78f2c3b7821448af08cd0666aa8c6",
    ),
    "props/crown.png": (
        (160, 132),
        True,
        "e5020562b554964736593eaef5d368b7a707cbfd6d27f4ea8452a581612c7c8c",
    ),
    "props/hand.png": (
        (256, 256),
        True,
        "6254e0c5df84ffffbf11195aee2d8ec3f4aef2d3823c9829c99184aba11817d4",
    ),
    "props/star-purple.png": (
        (512, 512),
        True,
        "7ba7ac01daa2e025ae49dd6507e9daf587472cf942913adab400602c78898847",
    ),
    "props/star-yellow.png": (
        (512, 512),
        True,
        "6b674a47011bed2ea5dbcf1f9e374a5f8692bbb2d27e3fab472fe2e466379980",
    ),
    "settings/category.png": (
        (256, 256),
        True,
        "cb49bd2afb6066172b0e3a684183d7e883f82957b45448c274121de52ce6a425",
    ),
    "settings/count.png": (
        (256, 256),
        True,
        "67440ab64c58e53b78e752125a704dba2ae913c27a95eb40dcfe101635019e56",
    ),
    "settings/difficulty.png": (
        (256, 256),
        True,
        "e7bf55d39fe5d8971c6291fe3749ce50cef729e30fc7d9768a4382ea12b86b04",
    ),
    "settings/players.png": (
        (256, 256),
        True,
        "5e557d347fd5f53fa32916a197741b37166fd0ae3c2a74d31164b659e98d2e08",
    ),
    "settings/results.png": (
        (256, 256),
        True,
        "15847f19031baa5b4c69cbbc26f47bc3f825adc98ca204bd6e5f0dc2dcce709a",
    ),
    "settings/scoring.png": (
        (256, 256),
        True,
        "82df6cbb7796a3dd6a959e0936c55ea2bf31b30b019026cbf15e51496595b4ca",
    ),
    "settings/timer.png": (
        (256, 256),
        True,
        "a8b6fe8708bf243890bf82c7b20084b55a7306f9901c7ff7049ef9cf4316b64e",
    ),
    "status/disconnected.png": (
        (768, 768),
        True,
        "8cead6a464d64dd52641d76659759cddc5a9d679eee60fd2a1f9ed94c97e7b28",
    ),
    "status/left-room.png": (
        (768, 768),
        True,
        "a96966ab9b9d2daf5ea5994a217c47f4f9ad3c631d50b83887d4f5470f83f9d5",
    ),
    "status/loading.png": (
        (768, 768),
        True,
        "4a318f7e61190727647e108203db4dd38fb948b23e0a920946b42fbcb5189dc9",
    ),
    "status/paused.png": (
        (768, 768),
        True,
        "cc175c727084842e762ed71af6ae7d98a3f9a38985f08350a626fcf04c225d8b",
    ),
    "status/room-full.png": (
        (768, 768),
        True,
        "74a0d5a9fd097ad19ad2e2b70ccd437e38ebcd27a6de9df1a133606c78958dd4",
    ),
    "status/room-not-found.png": (
        (768, 768),
        True,
        "b172b6886e3f85707ee5ce7da31727ce00d2dc3c9f7cb44435fe4676bdbc8a34",
    ),
    "status/waiting.png": (
        (768, 768),
        True,
        "87c4a7a83e4bf3223aa0fca48d67665a7b17d41c2770bc6a506b3e12f97dded0",
    ),
}

TRIVIA_RUNTIME_ASSET_SPECS = {
    "logo-dark.png": (
        (720, 360),
        True,
        "74b2a5f78b964e49e25e0d691544672888793a1f918feb115ee1b868c98de594",
    ),
    "logo-light.png": (
        (720, 360),
        True,
        "d3daf77f65f0e03b2c8774658ff8699e04126725cd0258d859ea69ea2f6fa773",
    ),
    "mascot-celebrate.png": (
        (640, 533),
        True,
        "e79bf3318cac6b493ff3f911baea9f22d7b319c75d81ff96446e76076eec00b8",
    ),
    "mascot-idle.png": (
        (640, 533),
        True,
        "0ba037b247aa09514a3110b3f3fe752cfe870a138432bcb7a8096ece1c2ed822",
    ),
    "mascot-point.png": (
        (640, 534),
        True,
        "818adcaebcd0b3e22c32af8710d997528e14034430f584cf8597593de1571891",
    ),
    "mascot-wave.png": (
        (640, 475),
        True,
        "e797cf558bedbe8a710003331109628e94e17385652a110d397e381677f639e9",
    ),

    "space.jpg": (
        (1600, 900),
        False,
        "05865fda84db2b558be19f99913b4c928482ae63d68c2ba25bf770b411cbe2bb",
    ),
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

RUNTIME_ASSET_BUNDLES = (
    ("Playroom runtime", Path("packages/ui/assets/playroom"), PLAYROOM_RUNTIME_ASSET_SPECS),
    ("Trivia runtime", Path("games/trivia/assets"), TRIVIA_RUNTIME_ASSET_SPECS),
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
    "huddle-tv-icon-1280x768.png": "14c18c8bb437646261c23c8cddb8be9d0b5f17f274241bfaefe8c4ca8a92e831",
    "huddle-tv-icon-400x240.png": "77102b78bb23729e887296382dbec094415b4ebf65e75c6700d47b7bdfbbdcea",
    "huddle-tv-icon-800x480.png": "43d6b2e56564b08742619a38cc6b754e01aabd0eda831b71a0623f965d2596e6",
    "huddle-tv-top-shelf-1920x720.png": "21279479ce9155f4146fc83368df94fe3df92840a5216d5c30113ff280aadebe",
    "huddle-tv-top-shelf-3840x1440.png": "7b7b75e1f59db8e494ef79e3ac99487882450399527d6ed0abd3f7542287829e",
    "huddle-tv-top-shelf-wide-2320x720.png": "23cc256a24d6ca1e8ad17f496229ceb9a64f8e21677a31c462a6d5a615a33f49",
    "huddle-tv-top-shelf-wide-4640x1440.png": "5bf3ac41ae21bb31da7efd1fa0f9ecaaa498589738f3c321cb1e1b71b998c678",
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

    return any(path.resolve() == (root / approved).resolve() for approved in APPROVED_ILLUSTRATED_RENDERERS)

def is_approved_interactive_renderer(path: Path, root: Path = ROOT) -> bool:

    return is_approved_illustrated_renderer(path, root)

TV_CONTROL_REFERENCE = re.compile(
    r"\b(?:Pressable|TextInput|TouchableOpacity|TouchableWithoutFeedback|"
    r"TouchableHighlight|Button|CameraView|TVEventHandler)\b|"
    r"\b(?:onPress|onLongPress|onFocus|onBlur|hasTVPreferredFocus)\s*[:=]|"
    r"\bfocusable\s*=\s*(?:\{\s*)?true\b|"
    r"accessibilityRole\s*=\s*['\"]button['\"]"
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
