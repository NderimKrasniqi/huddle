#!/usr/bin/env python3
"""Validate the repository-local engineering workflow."""

from __future__ import annotations

import json
import re
import shlex
import subprocess
import sys
from collections import Counter
from pathlib import Path
from urllib.parse import unquote


CURRENT_MARKDOWN = {
    "AGENTS.md",
    "convex/AGENTS.md",
    "docs/architecture.md",
    "docs/implementation-plan.md",
    "docs/project-scope.md",
    "docs/tech-stack.md",
    "packages/ui/assets/README.md",
}
GENERATED_MARKDOWN = {"convex/convex/_generated/ai/guidelines.md"}
FORBIDDEN_DOC_ROOTS = ("docs/archive/", "docs/design/legacy/")
STALE_PRODUCT_TERM = re.compile(
    r"apps/controller|@huddle/controller|packages/games(?:/|\b)|@huddle/game-core"
)
OBSOLETE_REFERENCE = re.compile(
    r"\b(?:implementation[- ]task|task)\s+\d+(?:\.\d+)+|§\s*\d+",
    re.IGNORECASE,
)
MARKDOWN_LINK = re.compile(r"!?\[[^\]]*\]\(([^)]+)\)")
HEADING = re.compile(r"^#{1,6}\s+(.+?)\s*#*\s*$", re.MULTILINE)
EXPLICIT_ANCHOR = re.compile(r"<(?:a|[^>]+\s)id=[\"']([^\"']+)[\"']", re.IGNORECASE)
INLINE_CODE = re.compile(r"(?<!`)`([^`\n]+)`(?!`)")
ROOT_PATH = re.compile(r"^(?:\.agents|apps|convex|docs|games|packages|tools)/")
REQUIREMENT_ID = re.compile(r"\b(?:ARCH|DATA|DOC|GAME|ID|PLAT|RATE|READY|REL|UI)-\d{3}\b")
SHELL_FENCE = re.compile(r"```(?:sh|bash)\s*\n(.*?)```", re.DOTALL | re.IGNORECASE)


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


def markdown_paths(root: Path) -> list[Path]:
    result = subprocess.run(
        ["git", "ls-files", "--cached", "--others", "--exclude-standard", "*.md", "**/*.md"],
        cwd=root,
        check=True,
        capture_output=True,
        text=True,
    )
    return sorted(
        root / line
        for line in set(result.stdout.splitlines())
        if line and (root / line).is_file()
    )


def github_anchors(text: str) -> set[str]:
    """Return GitHub-style heading anchors, including duplicate suffixes."""

    anchors = set(EXPLICIT_ANCHOR.findall(text))
    counts: Counter[str] = Counter()
    for heading in HEADING.findall(text):
        plain = re.sub(r"<[^>]+>", "", heading)
        plain = re.sub(r"[*_~`]", "", plain).strip().lower()
        slug = re.sub(r"[^\w\- ]", "", plain, flags=re.UNICODE)
        slug = re.sub(r"\s", "-", slug)
        suffix = counts[slug]
        anchors.add(slug if suffix == 0 else f"{slug}-{suffix}")
        counts[slug] += 1
    return anchors


def workspace_packages(root: Path) -> dict[str, tuple[Path, dict[str, object]]]:
    packages: dict[str, tuple[Path, dict[str, object]]] = {}
    for pattern in ("apps/*/package.json", "games/*/package.json", "packages/*/package.json", "convex/package.json"):
        for manifest_path in root.glob(pattern):
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            name = manifest.get("name")
            if isinstance(name, str):
                packages[name] = (manifest_path, manifest)
    return packages


def validate_link(path: Path, root: Path, raw_target: str) -> None:
    target = raw_target.strip()
    if target.startswith("<") and target.endswith(">"):
        target = target[1:-1]
    if target.startswith(("http://", "https://", "mailto:")):
        return

    relative, separator, anchor = target.partition("#")
    relative = unquote(relative)
    resolved = path if not relative else (path.parent / relative).resolve()
    if not resolved.exists():
        rel = path.relative_to(root).as_posix()
        raise SystemExit(f"broken Markdown link: {rel} -> {relative}")
    if separator and anchor:
        if not resolved.is_file():
            rel = path.relative_to(root).as_posix()
            raise SystemExit(f"Markdown anchor targets a directory: {rel} -> {target}")
        anchors = github_anchors(resolved.read_text(encoding="utf-8"))
        if unquote(anchor) not in anchors:
            rel = path.relative_to(root).as_posix()
            raise SystemExit(f"broken Markdown anchor: {rel} -> {target}")


def validate_repo_paths(path: Path, root: Path, text: str) -> None:
    rel = path.relative_to(root).as_posix()
    for value in INLINE_CODE.findall(text):
        candidate = value.strip().rstrip(".,;:")
        if not ROOT_PATH.match(candidate):
            continue
        if any(marker in candidate for marker in ("<", ">", "{", "}")):
            continue
        if "*" in candidate or "?" in candidate:
            if not list(root.glob(candidate)):
                raise SystemExit(f"repository path glob matches nothing: {rel} -> {candidate}")
            continue
        if not (root / candidate).exists():
            raise SystemExit(f"repository path does not exist: {rel} -> {candidate}")


def validate_package_names(
    path: Path,
    text: str,
    packages: dict[str, tuple[Path, dict[str, object]]],
) -> None:
    rel = path.as_posix()
    for reference in set(re.findall(r"@huddle/[a-z0-9-]+(?:/[a-z0-9./-]+)?", text)):
        parts = reference.split("/")
        package_name = "/".join(parts[:2])
        if package_name not in packages:
            raise SystemExit(f"unknown workspace package in {rel}: {package_name}")
        if len(parts) == 2:
            continue
        subpath = "./" + "/".join(parts[2:])
        exports = packages[package_name][1].get("exports", {})
        if not isinstance(exports, dict) or subpath not in exports:
            raise SystemExit(f"unknown workspace package export in {rel}: {reference}")


def validate_pnpm_commands(
    path: Path,
    text: str,
    root_manifest: dict[str, object],
    packages: dict[str, tuple[Path, dict[str, object]]],
) -> None:
    root_scripts = root_manifest.get("scripts", {})
    assert isinstance(root_scripts, dict)
    builtins = {"add", "audit", "exec", "install", "run", "test"}
    for block in SHELL_FENCE.findall(text):
        for raw_line in block.splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "pnpm" not in line:
                continue
            try:
                tokens = shlex.split(line)
            except ValueError as error:
                raise SystemExit(f"invalid shell command in {path.as_posix()}: {line} ({error})") from error
            try:
                index = tokens.index("pnpm")
            except ValueError:
                continue
            args = tokens[index + 1 :]
            if not args:
                raise SystemExit(f"incomplete pnpm command in {path.as_posix()}: {line}")
            if args[0] in {"-r", "--recursive"}:
                continue
            if args[0] == "--filter":
                if len(args) < 3 or args[1] not in packages:
                    raise SystemExit(f"unknown pnpm filter in {path.as_posix()}: {line}")
                command = args[2]
                if command in builtins:
                    continue
                scripts = packages[args[1]][1].get("scripts", {})
                if not isinstance(scripts, dict) or command not in scripts:
                    raise SystemExit(f"unknown filtered pnpm script in {path.as_posix()}: {line}")
                continue
            command = args[1] if args[0] == "run" and len(args) > 1 else args[0]
            if command not in builtins and command not in root_scripts:
                raise SystemExit(f"unknown root pnpm script in {path.as_posix()}: {line}")


def validate_requirements(_root: Path, current_text: dict[str, str]) -> None:
    plan = current_text.get("docs/implementation-plan.md")
    if plan is None:
        return

    task_matches = list(re.finditer(r"^- \[(?: |~|!)\] \*\*(\d+(?:\.\d+){2,})\s+—", plan, re.MULTILINE))
    for index, match in enumerate(task_matches):
        end = task_matches[index + 1].start() if index + 1 < len(task_matches) else len(plan)
        block = plan[match.end() : end]
        requirement_line = re.search(r"^\s+- \*\*Requirements:\*\*\s*(.+)$", block, re.MULTILINE)
        if requirement_line is None:
            raise SystemExit(f"unfinished task {match.group(1)} has no requirement traceability")
        referenced = set(REQUIREMENT_ID.findall(requirement_line.group(1)))
        if not referenced:
            raise SystemExit(f"unfinished task {match.group(1)} has no requirement IDs")


def validate_markdown(root: Path) -> None:
    forbidden = [entry for prefix in FORBIDDEN_DOC_ROOTS for entry in (root / prefix).rglob("*") if entry.is_file()]
    if forbidden:
        names = ", ".join(sorted(path.relative_to(root).as_posix() for path in forbidden))
        raise SystemExit("prohibited archive/legacy documentation remains: " + names)

    paths = markdown_paths(root)
    actual = {path.relative_to(root).as_posix() for path in paths}
    expected = CURRENT_MARKDOWN | GENERATED_MARKDOWN
    missing = sorted(expected - actual)
    extra = sorted(actual - expected)
    if missing or extra:
        raise SystemExit(
            "Markdown inventory mismatch "
            f"(missing: {', '.join(missing) or '—'}; unclassified: {', '.join(extra) or '—'})"
        )

    packages = workspace_packages(root)
    root_manifest = json.loads((root / "package.json").read_text(encoding="utf-8"))
    current_text: dict[str, str] = {}

    for path in paths:
        rel = path.relative_to(root).as_posix()
        text = path.read_text(encoding="utf-8")
        for target in MARKDOWN_LINK.findall(text):
            validate_link(path, root, target)
        if rel not in CURRENT_MARKDOWN:
            continue
        current_text[rel] = text
        if STALE_PRODUCT_TERM.search(text):
            raise SystemExit(f"current Markdown contains superseded product term: {rel}")
        if OBSOLETE_REFERENCE.search(text):
            raise SystemExit(f"current Markdown contains obsolete task/section reference: {rel}")
        validate_repo_paths(path, root, text)
        validate_package_names(path, text, packages)
        validate_pnpm_commands(path, text, root_manifest, packages)

    validate_requirements(root, current_text)


def main() -> int:
    root = Path(__file__).resolve().parents[1]
    forbidden = [
        root / ".agents",
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

    validate_markdown(root)

    run([sys.executable, str(root / "tools" / "validate-architecture.py")], root)
    run(
        [
            sys.executable,
            "-m",
            "unittest",
            "discover",
            "-s",
            str(root / "tools" / "tests"),
            "-p",
            "test_*.py",
        ],
        root,
    )
    print("Workflow validation passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
