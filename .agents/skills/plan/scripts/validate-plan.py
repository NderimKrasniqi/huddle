#!/usr/bin/env python3
"""Lightweight deterministic validator for /plan outputs.

Usage:
    python3 validate-plan.py /path/to/project

Checks deterministic structure and traceability that are safe to validate mechanically.
It intentionally does not judge architecture quality, product semantics, or task size.
"""

from __future__ import annotations

import re
import sys
from collections import Counter
from pathlib import Path

FEATURE_ID = re.compile(r"\bF-(\d{3})\b")
CAP_ID = re.compile(r"\bC-(\d{3}\.\d+)\b")
JOURNEY_ID = re.compile(r"\bJ-(\d{3})\b")
RULE_ID = re.compile(r"\bBR-(\d{3})\b")
PHASE_HEADER = re.compile(r"^##\s+Phase\s+(\d+(?:\.\d+)+)\b", re.M)
TASK_LINE = re.compile(r"^-\s+\[(?: |~|x|!)\]\s+\*\*(\d+(?:\.\d+){2,})\s+—", re.M)
PLAN_FEATURE_HEADER = re.compile(r"^#\s+Feature\s+\d+\s+—\s+(F-\d{3})\b", re.M)
DISCOVERY_FEATURE_HEADER = re.compile(r"^#.*\b(F-\d{3})\b", re.M)
CAP_HEADER = re.compile(r"^#{2,}\s+.*\b(C-\d{3}\.\d+)\b", re.M)
TASK_DEP_LINE = re.compile(r"^\s*-\s+\*\*Depends on:\*\*\s*(.*?)\s*$", re.M)
TASK_ID_ANY = re.compile(r"\b\d+(?:\.\d+){2,}\b")


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8") if path.exists() else ""


def docs_root(path: Path) -> Path:
    """Resolve either a docs directory or its repository root."""
    candidate = path.resolve()
    if (candidate / "implementation-plan.md").exists():
        return candidate
    docs = candidate / "docs"
    if (docs / "implementation-plan.md").exists():
        return docs
    return candidate


def all_markdown(root: Path) -> list[Path]:
    paths = []
    for base in [root / "project-scope.md", root / "architecture.md", root / "implementation-plan.md"]:
        if base.exists():
            paths.append(base)
    project_dir = root / "project"
    if project_dir.exists():
        paths.extend(sorted(project_dir.rglob("*.md")))
    return paths


def declared_feature_ids(root: Path) -> set[str]:
    result: set[str] = set()
    feature_dir = root / "project" / "features"
    if feature_dir.exists():
        for path in feature_dir.glob("*.md"):
            matches = DISCOVERY_FEATURE_HEADER.findall(read(path))
            if matches:
                result.add(matches[0])
    if not result:
        result.update(f"F-{x}" for x in FEATURE_ID.findall(read(root / "project-scope.md")))
    return result


def declared_capability_ids(root: Path) -> set[str]:
    result: set[str] = set()
    feature_dir = root / "project" / "features"
    if feature_dir.exists():
        for path in feature_dir.glob("*.md"):
            result.update(CAP_HEADER.findall(read(path)))
    if not result:
        result.update(f"C-{x}" for x in CAP_ID.findall(read(root / "project-scope.md")))
    return result


def ids_in(paths: list[Path], pattern: re.Pattern[str]) -> set[str]:
    out: set[str] = set()
    for path in paths:
        out.update(m.group(0) for m in pattern.finditer(read(path)))
    return out


def task_order_key(task_id: str) -> tuple[int, ...]:
    return tuple(int(part) for part in task_id.split("."))


def parse_task_dependencies(plan: str) -> dict[str, list[str]]:
    """Return task -> referenced task IDs from its Depends on line."""
    task_matches = list(TASK_LINE.finditer(plan))
    result: dict[str, list[str]] = {}
    for index, match in enumerate(task_matches):
        task_id = match.group(1)
        block_start = match.end()
        block_end = task_matches[index + 1].start() if index + 1 < len(task_matches) else len(plan)
        block = plan[block_start:block_end]
        dep_match = TASK_DEP_LINE.search(block)
        if not dep_match:
            result[task_id] = []
            continue
        value = dep_match.group(1).strip()
        if not value or value.lower() in {"none", "n/a", "—", "-"}:
            result[task_id] = []
            continue
        result[task_id] = TASK_ID_ANY.findall(value)
    return result


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: validate-plan.py /path/to/project")
        return 2

    root = docs_root(Path(sys.argv[1]))
    errors: list[str] = []
    warnings: list[str] = []

    for required in ["project-scope.md", "tech-stack.md", "architecture.md", "implementation-plan.md"]:
        if not (root / required).exists():
            errors.append(f"Missing required file: {required}")

    if errors:
        for error in errors:
            print(f"ERROR: {error}")
        return 1

    plan = read(root / "implementation-plan.md")
    arch = read(root / "architecture.md")
    discovery_files = [p for p in all_markdown(root) if p.name not in {"architecture.md", "implementation-plan.md"}]

    # Stable plan numbering.
    phases = PHASE_HEADER.findall(plan)
    tasks = TASK_LINE.findall(plan)
    for label, values in [("phase", phases), ("task", tasks)]:
        duplicates = [v for v, count in Counter(values).items() if count > 1]
        if duplicates:
            errors.append(f"Duplicate {label} numbers: {', '.join(sorted(duplicates))}")
    if not tasks:
        errors.append("No numbered task lines found using expected checkbox format")

    # Feature/capability coverage.
    declared_features = declared_feature_ids(root)
    planned_features = set(PLAN_FEATURE_HEADER.findall(plan))
    missing_features = sorted(declared_features - planned_features)
    if missing_features:
        warnings.append("Discovery feature IDs not present as plan feature headers (verify deferred/out of scope): " + ", ".join(missing_features))

    declared_caps = declared_capability_ids(root)
    plan_caps = {f"C-{x}" for x in CAP_ID.findall(plan)}
    missing_caps = sorted(declared_caps - plan_caps)
    if missing_caps:
        warnings.append("Discovery capability IDs not referenced in plan (verify deferred/out of scope): " + ", ".join(missing_caps))

    # Journey and business-rule coverage. Materiality/MVP scope still requires semantic audit,
    # so missing IDs are warnings rather than hard failures.
    declared_journeys = ids_in(discovery_files, JOURNEY_ID)
    plan_journeys = {f"J-{x}" for x in JOURNEY_ID.findall(plan)}
    missing_journeys = sorted(declared_journeys - plan_journeys)
    if missing_journeys:
        warnings.append("Discovery journey IDs not referenced in plan (verify non-MVP/deferred status): " + ", ".join(missing_journeys))

    declared_rules = ids_in(discovery_files, RULE_ID)
    plan_rules = {f"BR-{x}" for x in RULE_ID.findall(plan)}
    missing_rules = sorted(declared_rules - plan_rules)
    if missing_rules:
        warnings.append("Discovery business-rule IDs not referenced in plan (verify materiality/deferred status): " + ", ".join(missing_rules))

    # Broken discovery references in architecture/plan.
    known_ids: set[str] = set()
    for pattern in [FEATURE_ID, CAP_ID, JOURNEY_ID, RULE_ID]:
        known_ids.update(ids_in(discovery_files, pattern))

    output_refs: set[str] = set()
    for text in [arch, plan]:
        for pattern in [FEATURE_ID, CAP_ID, JOURNEY_ID, RULE_ID]:
            output_refs.update(m.group(0) for m in pattern.finditer(text))

    broken = sorted(output_refs - known_ids)
    if broken:
        errors.append("References not found in discovery artifacts: " + ", ".join(broken))

    # Task dependency integrity and order.
    task_set = set(tasks)
    deps = parse_task_dependencies(plan)
    for task_id, dep_ids in deps.items():
        for dep_id in dep_ids:
            if dep_id not in task_set:
                errors.append(f"Task {task_id} depends on nonexistent task {dep_id}")
                continue
            if task_order_key(dep_id) >= task_order_key(task_id):
                errors.append(f"Task {task_id} has non-prior dependency {dep_id}")

    # Expected resumability fields.
    for field in ["Current feature", "Current phase", "Current task", "Last completed task", "Blockers"]:
        if field not in plan:
            errors.append(f"Execution State missing field: {field}")

    # Horizontal-plan warning heuristic.
    suspicious = []
    for heading in re.findall(r"^##\s+Phase[^\n]*", plan, re.M | re.I):
        lowered = heading.lower()
        if any(term in lowered for term in ["database", "backend", "frontend", "all tests", "testing phase"]):
            suspicious.append(heading.strip())
    if suspicious:
        warnings.append("Potential horizontal phase headings: " + " | ".join(suspicious))

    print(f"Project: {root}")
    print(f"Declared features: {len(declared_features)}")
    print(f"Planned features: {len(planned_features)}")
    print(f"Declared capabilities: {len(declared_caps)}")
    print(f"Referenced capabilities: {len(plan_caps)}")
    print(f"Declared journeys: {len(declared_journeys)}")
    print(f"Referenced journeys: {len(plan_journeys)}")
    print(f"Declared business rules: {len(declared_rules)}")
    print(f"Referenced business rules: {len(plan_rules)}")
    print(f"Phases: {len(phases)}")
    print(f"Tasks: {len(tasks)}")

    for warning in warnings:
        print(f"WARNING: {warning}")
    for error in errors:
        print(f"ERROR: {error}")

    if errors:
        print("RESULT: FAIL")
        return 1

    print("RESULT: PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
