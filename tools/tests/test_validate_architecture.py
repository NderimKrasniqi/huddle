from __future__ import annotations

import hashlib
import binascii
import importlib.util
import json
import struct
import sys
import tempfile
import unittest
import zlib
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

    def test_type_only_edges_do_not_pull_renderer_code_into_pure_entrypoints(self) -> None:
        files = self.baseline()
        files["src/features/one/index.ts"] = "import type { View } from './renderer'; export type { View };\n"
        files["src/features/one/renderer.ts"] = "import { View } from 'react-native'; export const view = View;\n"
        app, root = self.app(files)
        validator.validate_app(app, root)

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

    def test_heartbeat_capabilities_are_scoped_to_their_surfaces(self) -> None:
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        root = Path(temporary.name)
        room = root / "apps/tv/src/features/room/room-invitation-screen.tsx"
        scan = root / "apps/phone/src/features/scan/scan-screen.tsx"
        identity = root / "apps/phone/src/screens/join-identity-screen.tsx"
        neighboring = root / "apps/phone/src/features/join/room-code-entry.tsx"

        self.assertTrue(validator.is_approved_illustrated_renderer(room, root))
        self.assertTrue(validator.is_approved_illustrated_renderer(scan, root))
        self.assertTrue(validator.is_approved_illustrated_renderer(identity, root))
        self.assertFalse(validator.is_approved_illustrated_renderer(neighboring, root))

        validator.validate_presentation_renderer_scope(
            room,
            "import QRCode from 'react-native-qrcode-svg';\nimport { Circle } from 'react-native-svg';\n",
            root,
        )
        validator.validate_presentation_renderer_scope(
            scan,
            "import { CameraView } from 'expo-camera';\n",
            root,
        )

        with self.assertRaisesRegex(SystemExit, "QR renderer is outside TV Room"):
            validator.validate_presentation_renderer_scope(
                identity,
                "import QRCode from 'react-native-qrcode-svg';\n",
                root,
            )
        with self.assertRaisesRegex(SystemExit, "CameraView is outside Phone Scan"):
            validator.validate_presentation_renderer_scope(
                identity,
                "import { CameraView } from 'expo-camera';\n",
                root,
            )
        with self.assertRaisesRegex(SystemExit, "SVG renderer import is outside approved TV renderers"):
            validator.validate_presentation_renderer_scope(
                neighboring,
                "import { Circle } from 'react-native-svg';\n",
                root,
            )

    def test_tv_sources_reject_controls_and_positive_focus(self) -> None:
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        root = Path(temporary.name)
        renderer = root / "apps/tv/src/features/room/room-stage.tsx"
        renderer.parent.mkdir(parents=True)

        renderer.write_text("import { Pressable } from 'react-native';\n", encoding="utf-8")
        with self.assertRaisesRegex(SystemExit, "TV presentation must remain display-only"):
            validator.validate_tv_display_only(root)

        renderer.write_text("import { View } from 'react-native';\n<View focusable={false} />;\n", encoding="utf-8")
        validator.validate_tv_display_only(root)

        renderer.write_text("<View focusable={true} />;\n", encoding="utf-8")
        with self.assertRaisesRegex(SystemExit, "TV presentation must remain display-only"):
            validator.validate_tv_display_only(root)

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
                "apps/tv/package.json": json.dumps({"dependencies": validator.TV_QR_DEPENDENCIES}),
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

        payload = (
            b"\x89PNG\r\n\x1a\n"
            + (b"\x00" * 8)
            + struct.pack(">II", 12, 34)
            + bytes((8, 6))
            + b"proof"
        )
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

    def test_heartbeat_runtime_bundle_is_current(self) -> None:
        validator.validate_heartbeat_tokens(ROOT)
        validator.validate_native_assets(ROOT)
        validator.validate_heartbeat_runtime_assets(ROOT)
        validator.validate_avatar_assets(ROOT)

    def test_heartbeat_mark_guard_rejects_the_obsolete_black_h_fixture(self) -> None:
        def png(width: int, height: int, rows: list[bytes]) -> bytes:
            def chunk(kind: bytes, payload: bytes) -> bytes:
                return (
                    struct.pack(">I", len(payload))
                    + kind
                    + payload
                    + struct.pack(">I", binascii.crc32(kind + payload) & 0xFFFFFFFF)
                )

            raw = b"".join(b"\x00" + row for row in rows)
            return (
                b"\x89PNG\r\n\x1a\n"
                + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
                + chunk(b"IDAT", zlib.compress(raw))
                + chunk(b"IEND", b"")
            )

        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        root = Path(temporary.name)
        old_h = root / "old-h.png"
        old_h.write_bytes(png(4, 4, [b"\x00\x00\x00" * 4 for _ in range(4)]))
        self.assertFalse(validator.png_has_heartbeat_mark(old_h, "Fixture", root))

        current = root / "heartbeat.png"
        current.write_bytes(
            png(
                4,
                4,
                [
                    b"\xFF\x6F\x61" + b"\xFF\xD7\x66" + b"\x7F\xD2\xB6" + b"\x7C\xC6\xFF",
                    b"\xFF\x6F\x61" * 4,
                    b"\xFF\xD7\x66" * 4,
                    b"\x7F\xD2\xB6" * 4,
                ],
            )
        )
        self.assertTrue(validator.png_has_heartbeat_mark(current, "Fixture", root))

    def test_apple_tv_derivatives_keep_the_installed_config_contract(self) -> None:
        apple_root = ROOT / "packages" / "ui" / "assets" / "app-icons" / "apple-tv"
        for name, (dimensions, has_alpha) in validator.APPLE_TV_ASSET_SPECS.items():
            path = apple_root / name
            self.assertTrue(path.is_file(), name)
            self.assertEqual(validator.png_dimensions_and_alpha(path, "Fixture", ROOT), (dimensions, has_alpha))
            self.assertEqual(hashlib.sha256(path.read_bytes()).hexdigest(), validator.APPLE_TV_ASSET_DIGESTS[name])

    def test_removed_surface_references_are_rejected(self) -> None:
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        root = Path(temporary.name)
        source = root / "apps/phone/src/screens/legacy.tsx"
        source.parent.mkdir(parents=True)
        source.write_text("export const legacy = 'PurposeScreen';\n", encoding="utf-8")

        with self.assertRaisesRegex(SystemExit, "obsolete Heartbeat surface reference"):
            validator.validate_no_obsolete_surface_paths(root)

    def test_rejected_tv_banner_brand_source_is_rejected(self) -> None:
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        root = Path(temporary.name)
        source = root / "docs/design/heartbeat/brand/huddle-tv-banner.svg"
        source.parent.mkdir(parents=True)
        source.write_text("<svg />\n", encoding="utf-8")

        with self.assertRaisesRegex(SystemExit, "obsolete Heartbeat artwork"):
            validator.validate_heartbeat_brand_source_set(root)

    def test_rejected_tv_living_room_artwork_is_rejected(self) -> None:
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        root = Path(temporary.name)
        source = root / "docs/design/heartbeat/assets/tv/living-room.png"
        runtime = root / "packages/ui/assets/heartbeat/tv/living-room.png"
        source.parent.mkdir(parents=True)
        runtime.parent.mkdir(parents=True)
        source.write_bytes(b"obsolete source")
        runtime.write_bytes(b"obsolete runtime")

        with self.assertRaisesRegex(SystemExit, "obsolete Heartbeat artwork"):
            validator.validate_heartbeat_brand_source_set(root)

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
