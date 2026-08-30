from __future__ import annotations

import hashlib
import importlib.util
import json
import struct
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location(
    "validate_architecture", ROOT / "tools" / "validate-architecture.py"
)
assert SPEC is not None and SPEC.loader is not None
validator = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = validator
SPEC.loader.exec_module(validator)


class ArchitectureFixtureTests(unittest.TestCase):
    def app(self, files: dict[str, str]) -> tuple[Path, Path]:
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        root = Path(temporary.name)
        app = root / "apps" / "fixture"
        for relative, source in files.items():
            path = app / relative
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(source, encoding="utf-8")
        return app, root

    def baseline(self) -> dict[str, str]:
        return {
            "app/index.tsx": "export { default } from '../src/screens/home';\n",
            "src/screens/home.tsx": "export default function Home() { return null; }\n",
            "src/features/one/index.ts": "export const one = true;\n",
            "src/platform/api/index.ts": "export const api = true;\n",
            "src/models/index.ts": "export type Model = { readonly ok: true };\n",
            "src/ui/index.ts": "export const ui = true;\n",
        }

    def assert_invalid(self, files: dict[str, str], fragment: str) -> None:
        app, root = self.app(files)
        with self.assertRaisesRegex(SystemExit, fragment):
            validator.validate_app(app, root)

    def test_valid_fixture_has_directional_entrypoints(self) -> None:
        app, root = self.app(self.baseline())
        validator.validate_app(app, root)

    def test_feature_to_feature_dependency_is_rejected(self) -> None:
        files = self.baseline()
        files["src/features/two/index.ts"] = "export const two = true;\n"
        files["src/features/one/reader.ts"] = "import { two } from '../two'; void two;\n"
        self.assert_invalid(files, "forbidden dependency direction")

    def test_platform_to_feature_dependency_is_rejected(self) -> None:
        files = self.baseline()
        files["src/platform/api/client.ts"] = "import { one } from '../../features/one'; void one;\n"
        self.assert_invalid(files, "forbidden dependency direction")

    def test_models_cannot_expose_react_native(self) -> None:
        files = self.baseline()
        files["src/models/index.ts"] = "import { View } from 'react-native'; export { View };\n"
        self.assert_invalid(files, "model entrypoint exposes renderer code")

    def test_empty_entrypoint_is_rejected(self) -> None:
        files = self.baseline()
        files["src/features/one/index.ts"] = "// intentionally empty\n"
        self.assert_invalid(files, "empty public entrypoint")

    def test_pure_index_cannot_import_renderer(self) -> None:
        files = self.baseline()
        files["src/features/one/index.ts"] = "import { View } from 'react-native'; export { View };\n"
        self.assert_invalid(files, "pure entrypoint imports renderer code")

    def test_pure_index_cannot_reexport_renderer_transitively(self) -> None:
        files = self.baseline()
        files["src/features/one/index.ts"] = "export { view } from './renderer';\n"
        files["src/features/one/renderer.ts"] = "import { View } from 'react-native'; export const view = View;\n"
        self.assert_invalid(files, "transitively imports renderer code")

    def test_dependency_cycle_is_rejected(self) -> None:
        files = self.baseline()
        files["src/features/one/a.ts"] = "import { b } from './b'; export { b };\n"
        files["src/features/one/b.ts"] = "import { a } from './a'; export { a };\n"
        self.assert_invalid(files, "dependency cycle detected")

    def test_authored_filename_must_be_kebab_case(self) -> None:
        files = self.baseline()
        files["src/features/one/BadName.ts"] = "export const bad = true;\n"
        self.assert_invalid(files, "authored filename must be kebab-case")

    def test_only_the_approved_presentation_seams_have_illustrated_exceptions(self) -> None:
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        root = Path(temporary.name)

        phone = root / "apps/phone/src/features/join/join-room-screen.tsx"
        scanner = root / "apps/phone/src/features/scan/scan-screen.tsx"
        tv = root / "apps/tv/src/features/room/room-invitation-screen.tsx"
        boot = root / "apps/tv/src/features/boot/tv-creating-room-screen.tsx"
        restore = root / "apps/tv/src/features/boot/tv-restoring-room-screen.tsx"
        restore_indicator = root / "apps/tv/src/features/boot/tv-restore-indicator.tsx"
        carousel = root / "apps/tv/src/features/game-flow/game-carousel-screen.tsx"
        art = root / "apps/tv/src/features/game-flow/game-art-reveal-screen.tsx"
        setup = root / "apps/tv/src/features/game-flow/game-setup-screen.tsx"
        ready = root / "apps/tv/src/features/game-flow/game-ready-screen.tsx"
        neighboring = root / "apps/phone/src/features/join/another-screen.tsx"

        self.assertTrue(validator.is_approved_illustrated_renderer(phone, root))
        self.assertTrue(validator.is_approved_illustrated_renderer(scanner, root))
        self.assertTrue(validator.is_approved_illustrated_renderer(tv, root))
        self.assertTrue(validator.is_approved_illustrated_renderer(boot, root))
        self.assertTrue(validator.is_approved_illustrated_renderer(restore, root))
        self.assertTrue(validator.is_approved_illustrated_renderer(restore_indicator, root))
        self.assertTrue(validator.is_approved_illustrated_renderer(carousel, root))
        self.assertTrue(validator.is_approved_illustrated_renderer(art, root))
        self.assertTrue(validator.is_approved_illustrated_renderer(setup, root))
        self.assertTrue(validator.is_approved_illustrated_renderer(ready, root))
        self.assertFalse(validator.is_approved_illustrated_renderer(neighboring, root))

    def test_tv_boot_renderer_allows_animation_artwork_and_svg(self) -> None:
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        root = Path(temporary.name)
        boot = root / "apps/tv/src/features/boot/tv-creating-room-screen.tsx"
        boot.parent.mkdir(parents=True)

        boot_source = (
            "import { Animated, Image, ImageBackground, View } from 'react-native';\n"
            "import { Circle } from 'react-native-svg';\n"
        )
        boot.write_text(boot_source, encoding="utf-8")
        validator.validate_presentation_renderer_scope(boot, boot_source, root)

        boot_source = "import QRCode from 'react-native-qrcode-svg';\n"
        boot.write_text(boot_source, encoding="utf-8")
        with self.assertRaisesRegex(SystemExit, "QR renderer import is outside TV Room"):
            validator.validate_presentation_renderer_scope(boot, boot_source, root)

        boot_source = "import { Pressable } from 'react-native';\n"
        boot.write_text(boot_source, encoding="utf-8")
        with self.assertRaisesRegex(SystemExit, "TV boot renderer must remain display-only"):
            validator.validate_presentation_renderer_scope(boot, boot_source, root)

        restore = root / "apps/tv/src/features/boot/tv-restoring-room-screen.tsx"
        restore_source = (
            "import { ActivityIndicator, Image, View } from 'react-native';\n"
            "import { Circle } from 'react-native-svg';\n"
        )
        validator.validate_presentation_renderer_scope(restore, restore_source, root)

        restore_source = "import { Pressable } from 'react-native';\n"
        with self.assertRaisesRegex(SystemExit, "TV boot renderer must remain display-only"):
            validator.validate_presentation_renderer_scope(restore, restore_source, root)

        restore_source = "import QRCode from 'react-native-qrcode-svg';\n"
        with self.assertRaisesRegex(SystemExit, "QR renderer import is outside TV Room"):
            validator.validate_presentation_renderer_scope(restore, restore_source, root)

        restore_indicator = root / "apps/tv/src/features/boot/tv-restore-indicator.tsx"
        indicator_source = (
            "import { Animated, View } from 'react-native';\n"
            "import { Circle } from 'react-native-svg';\n"
        )
        validator.validate_presentation_renderer_scope(
            restore_indicator, indicator_source, root
        )

        indicator_source = "import { TouchableOpacity } from 'react-native';\n"
        with self.assertRaisesRegex(SystemExit, "TV boot renderer must remain display-only"):
            validator.validate_presentation_renderer_scope(
                restore_indicator, indicator_source, root
            )

    def test_svg_renderer_import_is_limited_to_tv_room_and_tv_boot(self) -> None:
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        root = Path(temporary.name)
        phone = root / "apps/phone/src/features/join/join-room-screen.tsx"
        source = "import { Circle } from 'react-native-svg';\n"

        with self.assertRaisesRegex(SystemExit, "SVG renderer import is outside approved TV renderers"):
            validator.validate_presentation_renderer_scope(phone, source, root)

    def test_tv_game_flow_renderers_allow_display_animation_but_no_controls(self) -> None:
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        root = Path(temporary.name)
        carousel = root / "apps/tv/src/features/game-flow/game-carousel-screen.tsx"
        carousel.parent.mkdir(parents=True)

        source = "import { Animated, Image, ImageBackground, View } from 'react-native';\n"
        validator.validate_presentation_renderer_scope(carousel, source, root)

        source = "import { Pressable } from 'react-native';\n"
        with self.assertRaisesRegex(SystemExit, "TV game-flow renderer must remain display-only"):
            validator.validate_presentation_renderer_scope(carousel, source, root)

    def package_root(self, manifests: dict[str, str]) -> Path:
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        root = Path(temporary.name)
        for relative, source in manifests.items():
            path = root / relative
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(source, encoding="utf-8")
        return root

    def test_missing_package_export_target_is_rejected(self) -> None:
        root = self.package_root({"packages/sample/package.json": '{"name":"sample","exports":{".":"./src/index.ts"}}'})
        with self.assertRaisesRegex(SystemExit, "package export target missing"):
            validator.validate_package_boundaries(root)

    def test_forbidden_workspace_dependency_is_rejected(self) -> None:
        root = self.package_root(
            {
                "apps/phone/package.json": '{"name":"phone","exports":{".":"./index.ts"}}',
                "packages/game/package.json": '{"name":"game","dependencies":{"phone":"workspace:*"},"exports":{".":"./index.ts"}}',
                "apps/phone/index.ts": "export {};\n",
                "packages/game/index.ts": "export {};\n",
            }
        )
        with self.assertRaisesRegex(SystemExit, "forbidden workspace dependency direction"):
            validator.validate_package_boundaries(root)

    def test_rules_only_entrypoint_cannot_reexport_renderer(self) -> None:
        root = self.package_root(
            {
                "packages/rules/package.json": '{"name":"rules","exports":{"./logic":"./src/logic.ts"}}',
                "packages/rules/src/logic.ts": "export { view } from './view';\n",
                "packages/rules/src/view.ts": "import { View } from 'react-native'; export const view = View;\n",
            }
        )
        with self.assertRaisesRegex(SystemExit, "rules-only entrypoint"):
            validator.validate_package_boundaries(root)

    def test_client_safe_entrypoint_cannot_reach_server_content(self) -> None:
        root = self.package_root(
            {
                "packages/client/package.json": '{"name":"client","exports":{"./categories":"./src/categories.ts"}}',
                "packages/client/src/categories.ts": "export { questions } from './server';\n",
                "packages/client/src/server.ts": "export const questions = [];\n",
            }
        )
        with self.assertRaisesRegex(SystemExit, "client-safe entrypoint"):
            validator.validate_package_boundaries(root)

    def test_qr_dependencies_are_exact_and_tv_only(self) -> None:
        root = self.package_root(
            {
                "apps/tv/package.json": json.dumps(
                    {"dependencies": validator.TV_QR_DEPENDENCIES}
                ),
                "apps/phone/package.json": '{"dependencies":{}}',
            }
        )
        validator.validate_qr_dependency_scope(root)

        (root / "apps/phone/package.json").write_text(
            '{"dependencies":{"react-native-svg":"15.15.4"}}',
            encoding="utf-8",
        )
        with self.assertRaisesRegex(SystemExit, "outside the TV renderer"):
            validator.validate_qr_dependency_scope(root)

    def test_supplied_png_validation_rejects_dimensions_and_hash_changes(self) -> None:
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        root = Path(temporary.name)
        assets = root / "assets"
        assets.mkdir()

        payload = b"\x89PNG\r\n\x1a\n" + (b"\x00" * 8) + struct.pack(">II", 12, 34) + b"proof"
        digest = hashlib.sha256(payload).hexdigest()
        (assets / "supplied.png").write_bytes(payload)
        specs = {"supplied.png": ((12, 34), digest)}
        validator.validate_png_asset_set(assets, specs, "Fixture", root)

        wrong_dimensions = payload[:16] + struct.pack(">II", 13, 34) + payload[24:]
        (assets / "supplied.png").write_bytes(wrong_dimensions)
        with self.assertRaisesRegex(SystemExit, "wrong dimensions"):
            validator.validate_png_asset_set(assets, specs, "Fixture", root)

        (assets / "supplied.png").write_bytes(payload + b"changed")
        with self.assertRaisesRegex(SystemExit, "differs from supplied PNG"):
            validator.validate_png_asset_set(assets, specs, "Fixture", root)

    def test_tv_room_assets_match_the_supplied_files(self) -> None:
        validator.validate_tv_room_assets(ROOT)

    def test_tv_game_flow_assets_match_the_optimized_supplied_files(self) -> None:
        validator.validate_tv_game_flow_assets(ROOT)

    def test_shared_avatar_assets_match_the_optimized_bundle(self) -> None:
        validator.validate_avatar_assets(ROOT)

    def test_tv_reference_composite_cannot_be_imported(self) -> None:
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        root = Path(temporary.name)
        source = root / "apps/tv/src/features/room/screen.tsx"
        source.parent.mkdir(parents=True)
        source.write_text(
            "const reference = require('../../assets/tv-lobby-empty.png');\n",
            encoding="utf-8",
        )

        with self.assertRaisesRegex(SystemExit, "reference composite is imported"):
            validator.validate_reference_composite_exclusion(root)


if __name__ == "__main__":
    unittest.main()
