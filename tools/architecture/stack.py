from __future__ import annotations

from .common import *  # noqa: F403
from .boundaries import validate_presentation_renderer_scope, validate_qr_dependency_scope, validate_tv_display_only
from .assets import validate_design_tokens, validate_reference_composite_exclusion, validate_runtime_assets
from .native import validate_native_assets, validate_native_config, validate_native_generated_resources


def validate_stack(root: Path = ROOT) -> None:

    phone_config_path = root / "apps" / "phone" / "app.json"
    phone = json.loads(phone_config_path.read_text(encoding="utf-8"))["expo"]
    if phone.get("slug") != "huddle-phone":
        fail("Phone Expo slug must be huddle-phone")
    if phone.get("ios", {}).get("bundleIdentifier") != "tv.huddle.phone":
        fail("Phone iOS identity must be tv.huddle.phone")
    if phone.get("android", {}).get("package") != "tv.huddle.phone":
        fail("Phone Android identity must be tv.huddle.phone")

    for base in (root / "apps", root / "packages" / "ui", root / "games"):
        for source in source_files(base):
            clean = COMMENTS.sub("", source.read_text(encoding="utf-8"))

            if "games" in source.relative_to(root).parts[:1] and "react-native-reanimated" in clean:
                fail(f"game modules must not import Reanimated: {relative(source, root)}")
            validate_presentation_renderer_scope(source, clean, root)

    validate_design_tokens(root)
    validate_tv_display_only(root)

    manifests = [root / "apps" / app / "package.json" for app in APP_NAMES]
    manifests.extend(
        [
            root / "packages" / "ui" / "package.json",
            root / "packages" / "game-registry" / "package.json",
            *(root / "games" / name / "package.json" for name in ("trivia", "bomb-squad", "sumo-bumpers")),
        ]
    )
    banned_dependencies = {
        "nativewind",
        "tailwindcss",
        "react-native-css-interop",
        "expo-image",
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
        if payload.get("dependencies", {}).get("react-native-reanimated") != "4.5.1":
            fail(f"{app} must pin react-native-reanimated@4.5.1")
    for name in ("trivia", "bomb-squad", "sumo-bumpers"):
        payload = json.loads((root / "games" / name / "package.json").read_text(encoding="utf-8"))
        for field in ("dependencies", "devDependencies", "optionalDependencies", "peerDependencies"):
            if "react-native-reanimated" in payload.get(field, {}):
                fail(f"game modules must not depend on Reanimated: games/{name}/package.json")

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
    validate_runtime_assets(root)
    validate_reference_composite_exclusion(root)

    for app in APP_NAMES:
        config_path = root / "apps" / app / "app.json"
        config = json.loads(config_path.read_text(encoding="utf-8"))["expo"]
        if config.get("backgroundColor") != "#F9F1E6":
            fail(f"{app} native background must use the Playroom canvas")
        encoded = json.dumps(config)
        referenced = set(re.findall(r"huddle-[a-z0-9-]+\.png", encoded))
        if not referenced.issubset(set(NATIVE_ASSET_SPECS) | set(APPLE_TV_CONFIG_KEYS.values())):
            fail(f"{app} config references an undeclared native asset")
        if "huddle-splash.png" not in referenced:
            fail(f"{app} config must reference the splash asset")

    if "expo-camera" not in phone_config_path.read_text(encoding="utf-8"):
        fail("Phone Expo Camera configuration must remain")
