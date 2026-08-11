from __future__ import annotations

import importlib.util
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

    def test_dependency_cycle_is_rejected(self) -> None:
        files = self.baseline()
        files["src/features/one/a.ts"] = "import { b } from './b'; export { b };\n"
        files["src/features/one/b.ts"] = "import { a } from './a'; export { a };\n"
        self.assert_invalid(files, "dependency cycle detected")

    def test_authored_filename_must_be_kebab_case(self) -> None:
        files = self.baseline()
        files["src/features/one/BadName.ts"] = "export const bad = true;\n"
        self.assert_invalid(files, "authored filename must be kebab-case")


if __name__ == "__main__":
    unittest.main()
