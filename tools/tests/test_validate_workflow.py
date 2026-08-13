from __future__ import annotations

import importlib.util
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location(
    "validate_workflow", ROOT / "tools" / "validate-workflow.py"
)
assert SPEC is not None and SPEC.loader is not None
validator = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = validator
SPEC.loader.exec_module(validator)


class MarkdownValidationTests(unittest.TestCase):
    def test_github_anchors_include_duplicate_suffixes(self) -> None:
        anchors = validator.github_anchors("# One & Two\n\n## Repeat\n\n## Repeat\n")
        self.assertEqual(anchors, {"one--two", "repeat", "repeat-1"})

    def test_relative_link_anchor_must_exist(self) -> None:
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        root = Path(temporary.name)
        source = root / "source.md"
        target = root / "target.md"
        source.write_text("[target](target.md#missing)\n", encoding="utf-8")
        target.write_text("# Present\n", encoding="utf-8")

        with self.assertRaisesRegex(SystemExit, "broken Markdown anchor"):
            validator.validate_link(source, root, "target.md#missing")

        validator.validate_link(source, root, "target.md#present")

    def test_requirement_reference_must_exist_in_matrix(self) -> None:
        current = {
            "docs/acceptance-matrix.md": (
                "| ID | Requirement | Evidence |\n"
                "| --- | --- | --- |\n"
                "| DOC-001 | Docs validate | workflow gate |\n"
            ),
            "docs/implementation-plan.md": (
                "- [ ] **1.1.1 — Finish docs**\n"
                "  - **Requirements:** DOC-002\n"
            ),
        }
        with self.assertRaisesRegex(SystemExit, "missing from traceability"):
            validator.validate_requirements(Path("."), current)

    def test_unfinished_task_requires_requirement_mapping(self) -> None:
        current = {
            "docs/acceptance-matrix.md": (
                "| ID | Requirement | Evidence |\n"
                "| --- | --- | --- |\n"
                "| DOC-001 | Docs validate | workflow gate |\n"
            ),
            "docs/implementation-plan.md": "- [ ] **1.1.1 — Finish docs**\n",
        }
        with self.assertRaisesRegex(SystemExit, "has no requirement traceability"):
            validator.validate_requirements(Path("."), current)


if __name__ == "__main__":
    unittest.main()
