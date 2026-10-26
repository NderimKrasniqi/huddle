from __future__ import annotations

from .common import *  # noqa: F403
from .assets import png_dimensions_and_alpha, png_has_huddle_mark


def validate_native_assets(root: Path = ROOT) -> None:

    asset_root = root / "packages" / "ui" / "assets" / "app-icons"
    alpha_expected = {
        "huddle-android-adaptive-foreground.png": True,
        "huddle-android-monochrome.png": True,
    }
    for name, dimensions in NATIVE_ASSET_SPECS.items():
        path = asset_root / name
        if not path.is_file():
            fail(f"Native identity asset missing: {relative(path, root)}")
        actual_dimensions, has_alpha = png_dimensions_and_alpha(path, "Native identity", root)
        if actual_dimensions != dimensions:
            fail(
                f"Native identity asset has wrong dimensions: {relative(path, root)} "
                f"({actual_dimensions}, expected {dimensions})"
            )
        expected_alpha = alpha_expected.get(name, False)
        if has_alpha != expected_alpha:
            fail(
                f"Native identity asset alpha mismatch: {relative(path, root)} "
                f"({has_alpha}, expected {expected_alpha})"
            )

        if name != "huddle-android-monochrome.png" and not png_has_huddle_mark(
            path, "Native identity", root
        ):
            fail(f"Native identity asset does not contain the Playroom mark: {relative(path, root)}")

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
            f"{label} must use the current identity derivative: "
            f"{relative(actual, root)} (expected {relative(expected, root)})"
        )


def splash_plugin_options(expo: dict[str, object]) -> dict[str, object]:

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
        if adaptive.get("backgroundColor") != PLAYROOM_PALETTE["canvas"]:
            fail(f"{app_name} Android adaptive background must use the Playroom canvas")

        ios = expo.get("ios")
        if not isinstance(ios, dict) or not isinstance(ios.get("icon"), dict):
            fail(f"{app_name} iOS icon configuration is missing")
        ios_icon = ios["icon"]
        require_config_asset(config_path, ios_icon.get("light"), shared["ios.icon.light"], root, f"{app_name} iOS light icon")
        require_config_asset(config_path, ios_icon.get("dark"), shared["ios.icon.dark"], root, f"{app_name} iOS dark icon")

        splash_options = splash_plugin_options(expo)
        require_config_asset(config_path, splash_options.get("image"), shared["splash.image"], root, f"{app_name} splash image")
        if splash_options.get("backgroundColor") != PLAYROOM_PALETTE["canvas"]:
            fail(f"{app_name} splash background must use the Playroom canvas")

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

    if not path.is_file():
        fail(f"{label} colors missing: {relative(path, root)}")
    source = path.read_text(encoding="utf-8")
    expected = PLAYROOM_PALETTE["canvas"]
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
                fail(f"{label} {channel} must match the Playroom canvas")
    except (KeyError, IndexError, TypeError, ValueError, json.JSONDecodeError) as error:
        fail(f"{label} colorset is malformed: {error}")


def validate_native_generated_resources(root: Path = ROOT) -> None:

    for app_name in APP_NAMES:
        app_root = root / "apps" / app_name
        ios_root = app_root / "ios"
        android_root = app_root / "android"
        if not ios_root.exists() and not android_root.exists():

            continue

        if ios_root.is_dir():
            image_root = ios_root / "Huddle" / "Images.xcassets"
            icon_root = image_root / "AppIcon.appiconset"
            for filename in ("App-Icon-1024x1024@1x.png", "App-Icon-dark-1024x1024@1x.png"):
                icon = icon_root / filename
                if not icon.is_file():
                    fail(f"{app_name} iOS icon missing: {relative(icon, root)}")
                dimensions, _ = png_dimensions_and_alpha(icon, f"{app_name} iOS", root)
                if dimensions != (1024, 1024) or not png_has_huddle_mark(icon, f"{app_name} iOS", root):
                    fail(f"{app_name} iOS icon is stale: {relative(icon, root)}")
            splash_root = image_root / "SplashScreenLogo.imageset"
            splash = splash_root / "image@3x.png"
            if not splash.is_file() or png_dimensions_and_alpha(splash, f"{app_name} iOS", root)[0] != (480, 480) or not png_has_huddle_mark(splash, f"{app_name} iOS", root):
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
            if not xxxhdpi_splash.is_file() or not png_has_huddle_mark(xxxhdpi_splash, f"{app_name} Android", root):
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
                        if filename != "ic_launcher_monochrome.webp" and not png_has_huddle_mark(native, "Phone Android", root):
                            fail(f"Phone Android launcher resource is stale: {relative(native, root)}")
