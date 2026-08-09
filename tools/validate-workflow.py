#!/usr/bin/env python3
"""Validate the repository-local engineering workflow."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path


def run(command: list[str], root: Path) -> None:
    print("$", " ".join(command))
    subprocess.run(command, cwd=root, check=True)


def tracked_paths(root: Path, paths: list[Path]) -> list[str]:
    """Return forbidden paths that are part of the repository index."""

    relative = [str(path.relative_to(root)) for path in paths]
    result = subprocess.run(
        ["git", "ls-files", "--", *relative],
        cwd=root,
        check=True,
        capture_output=True,
        text=True,
    )
    return [line for line in result.stdout.splitlines() if line]


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
    # Agent clients may keep ignored local state under these names. Repository
    # truth only owns what is tracked, so ignored tool state is not a failure.
    present = tracked_paths(root, forbidden)
    if present:
        raise SystemExit("obsolete workflow paths remain: " + ", ".join(present))

    run([sys.executable, str(root / "tools" / "validate-architecture.py")], root)
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
