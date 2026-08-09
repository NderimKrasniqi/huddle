#!/usr/bin/env python3
"""Validate the repository-local engineering workflow."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path


def run(command: list[str], root: Path) -> None:
    print("$", " ".join(command))
    subprocess.run(command, cwd=root, check=True)


def main() -> int:
    root = Path(__file__).resolve().parents[1]
    skills = root / ".agents" / "skills"
    expected = {"discover", "plan", "implement-task", "code-review", "security-review"}
    actual = {path.name for path in skills.iterdir() if path.is_dir()} if skills.exists() else set()
    if actual != expected:
        missing = ", ".join(sorted(expected - actual)) or "—"
        extra = ", ".join(sorted(actual - expected)) or "—"
        raise SystemExit(f"workflow skills mismatch (missing: {missing}; extra: {extra})")

    forbidden = [
        root / ".claude",
        root / ".ai-workflow",
        root / "CLAUDE.md",
        root / "convex" / ".claude",
        root / "convex" / ".agents",
        root / "convex" / "CLAUDE.md",
        root / "convex" / "skills-lock.json",
    ]
    present = [str(path.relative_to(root)) for path in forbidden if path.exists()]
    if present:
        raise SystemExit("obsolete workflow paths remain: " + ", ".join(present))

    run([sys.executable, str(skills / "plan" / "scripts" / "validate-plan.py"), str(root)], root)
    run(
        [
            sys.executable,
            "-m",
            "unittest",
            "discover",
            "-s",
            str(skills / "implement-task" / "tests"),
            "-p",
            "test_*.py",
        ],
        root,
    )
    run([sys.executable, str(skills / "implement-task" / "scripts" / "task-state.py"), "status", str(root)], root)
    print("Workflow validation passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
