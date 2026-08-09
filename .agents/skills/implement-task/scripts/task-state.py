#!/usr/bin/env python3
"""Validate and mutate implementation-plan.md task execution state.

Usage:
  task-state.py status <project-root>
  task-state.py start <project-root> <task-id>
  task-state.py complete <project-root> <task-id>
  task-state.py block <project-root> <task-id> <reason>
"""

from __future__ import annotations

import json
import os
import re
import sys
import tempfile
from dataclasses import dataclass, field
from pathlib import Path

TASK_RE = re.compile(r"^(?P<indent>\s*)- \[(?P<status>[ ~x!])\] \*\*(?P<id>\d+\.\d+\.\d+)\s+[—-]\s+(?P<title>.+?)\*\*\s*$")
FEATURE_RE = re.compile(r"^# Feature\s+\d+\s+[—-]\s+(?P<feature>.+?)\s*$")
PHASE_RE = re.compile(r"^## Phase\s+(?P<id>\d+\.\d+)\s+[—-]\s+(?P<title>.+?)\s*$")
DEP_RE = re.compile(r"^\s*- \*\*Depends on:\*\*\s*(?P<deps>.+?)\s*$")
TASK_ID_RE = re.compile(r"\b\d+\.\d+\.\d+\b")
LEGACY_BLOCKER_ENTRY_RE = re.compile(
    r"(?:^|;\s*)(?P<id>\d+\.\d+\.\d+):\s*(?P<reason>.*?)(?=(?:;\s*\d+\.\d+\.\d+:\s*)|$)"
)
HEADER_FIELDS = {
    "Current feature": re.compile(r"^\*\*Current feature:\*\*\s*(.*?)\s*$"),
    "Current phase": re.compile(r"^\*\*Current phase:\*\*\s*(.*?)\s*$"),
    "Current task": re.compile(r"^\*\*Current task:\*\*\s*(.*?)\s*$"),
    "Last completed task": re.compile(r"^\*\*Last completed task:\*\*\s*(.*?)\s*$"),
    "Blockers": re.compile(r"^\*\*Blockers:\*\*\s*(.*?)\s*$"),
}
EMPTY_VALUES = {"", "—", "-", "none", "n/a"}


@dataclass
class Task:
    id: str
    title: str
    status: str
    line: int
    feature: str
    phase_id: str
    phase_title: str
    deps: list[str] = field(default_factory=list)

    @property
    def label(self) -> str:
        return f"{self.id} {self.title}"

    @property
    def feature_label(self) -> str:
        return self.feature or "—"

    @property
    def phase_label(self) -> str:
        return f"{self.phase_id} {self.phase_title}" if self.phase_id else "—"


def plan_path(root: str) -> Path:
    base = Path(root).resolve()
    p = base / "implementation-plan.md"
    if not p.exists():
        p = base / "docs" / "implementation-plan.md"
    if not p.exists():
        fail(f"implementation-plan.md not found at {p}")
    return p


def fail(msg: str, code: int = 2) -> None:
    print(f"ERROR: {msg}", file=sys.stderr)
    raise SystemExit(code)


def is_empty(value: str) -> bool:
    return value.strip().lower() in EMPTY_VALUES


def parse(lines: list[str]) -> tuple[list[Task], dict[str, tuple[int, str]]]:
    tasks: list[Task] = []
    headers: dict[str, tuple[int, str]] = {}
    current_feature = ""
    current_phase_id = ""
    current_phase_title = ""

    for i, line in enumerate(lines):
        stripped = line.rstrip("\r\n")
        fm = FEATURE_RE.match(stripped)
        if fm:
            current_feature = fm.group("feature")
        pm = PHASE_RE.match(stripped)
        if pm:
            current_phase_id = pm.group("id")
            current_phase_title = pm.group("title")

        for name, rx in HEADER_FIELDS.items():
            hm = rx.match(stripped)
            if hm:
                if name in headers:
                    fail(f"duplicate execution-state field '{name}'")
                headers[name] = (i, hm.group(1))

        tm = TASK_RE.match(stripped)
        if tm:
            tasks.append(Task(
                id=tm.group("id"),
                title=tm.group("title"),
                status=tm.group("status"),
                line=i,
                feature=current_feature,
                phase_id=current_phase_id,
                phase_title=current_phase_title,
            ))

    by_line = {t.line: t for t in tasks}
    task_lines = sorted(by_line)
    for idx, start in enumerate(task_lines):
        end = task_lines[idx + 1] if idx + 1 < len(task_lines) else len(lines)
        task = by_line[start]
        for j in range(start + 1, end):
            dm = DEP_RE.match(lines[j].rstrip("\r\n"))
            if not dm:
                continue
            raw = dm.group("deps").strip()
            if raw.lower() in EMPTY_VALUES:
                task.deps = []
            else:
                task.deps = TASK_ID_RE.findall(raw)
            break

    return tasks, headers


def task_map(tasks: list[Task]) -> dict[str, Task]:
    out: dict[str, Task] = {}
    for t in tasks:
        if t.id in out:
            fail(f"duplicate task id {t.id}")
        out[t.id] = t
    return out


def dependency_cycle(tasks: list[Task], by_id: dict[str, Task]) -> list[str] | None:
    state: dict[str, int] = {t.id: 0 for t in tasks}
    stack: list[str] = []

    def visit(task_id: str) -> list[str] | None:
        state[task_id] = 1
        stack.append(task_id)
        for dep_id in by_id[task_id].deps:
            if dep_id not in by_id:
                continue
            if state[dep_id] == 0:
                cycle = visit(dep_id)
                if cycle:
                    return cycle
            elif state[dep_id] == 1:
                start = stack.index(dep_id)
                return stack[start:] + [dep_id]
        stack.pop()
        state[task_id] = 2
        return None

    for task in tasks:
        if state[task.id] == 0:
            cycle = visit(task.id)
            if cycle:
                return cycle
    return None


def validate_tasks(tasks: list[Task]) -> dict[str, Task]:
    if not tasks:
        fail("no numbered tasks found")
    by_id = task_map(tasks)

    for task in tasks:
        for dep_id in task.deps:
            if dep_id not in by_id:
                fail(f"task {task.id} depends on nonexistent task {dep_id}")

    cycle = dependency_cycle(tasks, by_id)
    if cycle:
        fail("dependency cycle detected: " + " -> ".join(cycle))

    order = {task.id: index for index, task in enumerate(tasks)}
    for task in tasks:
        for dep_id in task.deps:
            if order[dep_id] >= order[task.id]:
                fail(f"task {task.id} has non-prior dependency {dep_id}")

    in_progress = [task for task in tasks if task.status == "~"]
    if len(in_progress) > 1:
        fail("multiple tasks are marked in progress: " + ", ".join(t.id for t in in_progress))
    return by_id


def deps_complete(task: Task, by_id: dict[str, Task]) -> bool:
    return all(by_id[dep_id].status == "x" for dep_id in task.deps)


def require_headers(headers: dict[str, tuple[int, str]]) -> None:
    missing = [name for name in HEADER_FIELDS if name not in headers]
    if missing:
        fail("execution-state fields missing: " + ", ".join(missing))


def task_id_from_header(value: str, field_name: str) -> str | None:
    if is_empty(value):
        return None
    match = TASK_ID_RE.search(value)
    if not match:
        fail(f"execution-state field '{field_name}' does not contain a task id: {value}")
    return match.group(0)


def validate_blocker_mapping(raw: object) -> dict[str, str]:
    if not isinstance(raw, dict):
        fail("Blockers JSON must be an object mapping task ids to reasons")

    blockers: dict[str, str] = {}
    for task_id, reason in raw.items():
        if not isinstance(task_id, str) or not re.fullmatch(r"\d+\.\d+\.\d+", task_id):
            fail(f"invalid blocker task id: {task_id!r}")
        if not isinstance(reason, str) or not reason.strip():
            fail(f"blocker reason for task {task_id} must be a non-empty string")
        blockers[task_id] = reason
    return blockers


def parse_blockers(value: str) -> dict[str, str]:
    if is_empty(value):
        return {}

    text = value.strip()
    if text.startswith("{"):
        try:
            return validate_blocker_mapping(json.loads(text))
        except json.JSONDecodeError as exc:
            fail(f"invalid Blockers JSON: {exc.msg}")

    # Backward compatibility for plans written by earlier skill versions.
    blockers: dict[str, str] = {}
    matches = list(LEGACY_BLOCKER_ENTRY_RE.finditer(text))
    if not matches:
        fail("Blockers must be JSON or legacy '<task-id>: <reason>' entries separated by '; '")

    consumed = "; ".join(f"{m.group('id')}: {m.group('reason').strip()}" for m in matches)
    if consumed != text:
        fail("Blockers must be JSON or legacy '<task-id>: <reason>' entries separated by '; '")

    for match in matches:
        task_id = match.group("id")
        reason = match.group("reason").strip()
        if not reason:
            fail(f"blocker reason for task {task_id} must not be empty")
        if task_id in blockers:
            fail(f"duplicate blocker entry for task {task_id}")
        blockers[task_id] = reason
    return blockers


def serialize_blockers(tasks: list[Task], blockers: dict[str, str]) -> str:
    blocked = [task for task in tasks if task.status == "!"]
    if not blocked:
        return "None"
    ordered = {task.id: blockers[task.id] for task in blocked}
    return json.dumps(ordered, ensure_ascii=False, separators=(",", ":"))


def validate_execution_state(
    tasks: list[Task],
    by_id: dict[str, Task],
    headers: dict[str, tuple[int, str]],
) -> dict[str, str]:
    require_headers(headers)

    current_id = task_id_from_header(headers["Current task"][1], "Current task")
    last_completed_id = task_id_from_header(headers["Last completed task"][1], "Last completed task")
    blockers = parse_blockers(headers["Blockers"][1])
    active = [task for task in tasks if task.status == "~"]
    blocked = [task for task in tasks if task.status == "!"]
    blocked_ids = {task.id for task in blocked}

    if set(blockers) != blocked_ids:
        missing = sorted(blocked_ids - set(blockers))
        stale = sorted(set(blockers) - blocked_ids)
        details: list[str] = []
        if missing:
            details.append("missing reasons for " + ", ".join(missing))
        if stale:
            details.append("reasons for non-blocked tasks " + ", ".join(stale))
        fail("Blockers field is inconsistent with [!] task markers: " + "; ".join(details))

    if last_completed_id is not None:
        if last_completed_id not in by_id:
            fail(f"Last completed task references nonexistent task {last_completed_id}")
        if by_id[last_completed_id].status != "x":
            fail(f"Last completed task {last_completed_id} is not marked complete [x]")

    if current_id is not None and current_id not in by_id:
        fail(f"Current task references nonexistent task {current_id}")

    if active:
        current = active[0]
        if not deps_complete(current, by_id):
            incomplete = [dep for dep in current.deps if by_id[dep].status != "x"]
            fail(f"in-progress task {current.id} has incomplete dependencies: {', '.join(incomplete)}")
        if current_id != current.id:
            fail(f"Current task must reference in-progress task {current.id}")
    elif blocked:
        if current_id not in blocked_ids:
            fail("Current task must reference a blocked task while automatic progression is halted")
        current = by_id[current_id]
    elif current_id is not None:
        current = by_id[current_id]
        if current.status != " ":
            fail(f"Current task {current.id} must be pending [ ] when no task is in progress or blocked")
        if not deps_complete(current, by_id):
            incomplete = [dep for dep in current.deps if by_id[dep].status != "x"]
            fail(f"Current task {current.id} has incomplete dependencies: {', '.join(incomplete)}")
    else:
        current = None

    expected_feature = current.feature_label if current else "—"
    expected_phase = current.phase_label if current else "—"
    if headers["Current feature"][1].strip() != expected_feature:
        fail(f"Current feature is inconsistent with Current task; expected '{expected_feature}'")
    if headers["Current phase"][1].strip() != expected_phase:
        fail(f"Current phase is inconsistent with Current task; expected '{expected_phase}'")

    return blockers


def next_eligible(
    tasks: list[Task],
    by_id: dict[str, Task],
    headers: dict[str, tuple[int, str]],
) -> Task | None:
    """Return the task automatic progression may select.

    In-progress work always resumes. Any blocked task halts automatic
    progression. Otherwise an eligible pending Current task is authoritative,
    then the first eligible pending task is selected.
    """
    active = [task for task in tasks if task.status == "~"]
    if active:
        return active[0]
    if any(task.status == "!" for task in tasks):
        return None

    current_id = task_id_from_header(headers["Current task"][1], "Current task")
    if current_id is not None:
        current = by_id[current_id]
        if current.status == " " and deps_complete(current, by_id):
            return current

    for task in tasks:
        if task.status == " " and deps_complete(task, by_id):
            return task
    return None


def replace_status(line: str, status: str) -> str:
    return re.sub(r"^(\s*- \[)[ ~x!](\] \*\*)", rf"\g<1>{status}\g<2>", line, count=1)


def set_header(lines: list[str], headers: dict[str, tuple[int, str]], name: str, value: str) -> None:
    if name not in headers:
        fail(f"execution-state field '{name}' not found")
    idx, _ = headers[name]
    original = lines[idx]
    newline = "\r\n" if original.endswith("\r\n") else "\n" if original.endswith("\n") else ""
    body = original[:-len(newline)] if newline else original
    trailing_spaces = body[len(body.rstrip(" ")):]
    lines[idx] = f"**{name}:** {value}{trailing_spaces}{newline}"


def update_execution_headers(
    lines: list[str],
    blocker_reasons: dict[str, str],
    *,
    current_task_id: str | None = None,
    last_completed: str | None = None,
) -> None:
    tasks, headers = parse(lines)
    by_id = validate_tasks(tasks)
    require_headers(headers)

    blocked = [task for task in tasks if task.status == "!"]
    blocked_ids = {task.id for task in blocked}
    if set(blocker_reasons) != blocked_ids:
        fail("internal blocker state does not match [!] task markers")

    active = [task for task in tasks if task.status == "~"]
    current: Task | None
    if active:
        current = active[0]
    elif current_task_id is not None:
        if current_task_id not in by_id:
            fail(f"task {current_task_id} not found")
        current = by_id[current_task_id]
    elif blocked:
        current = blocked[0]
    else:
        current = next((task for task in tasks if task.status == " " and deps_complete(task, by_id)), None)

    if current:
        set_header(lines, headers, "Current feature", current.feature_label)
        set_header(lines, headers, "Current phase", current.phase_label)
        set_header(lines, headers, "Current task", current.label)
    else:
        set_header(lines, headers, "Current feature", "—")
        set_header(lines, headers, "Current phase", "—")
        set_header(lines, headers, "Current task", "—")

    if last_completed is not None:
        set_header(lines, headers, "Last completed task", last_completed)
    set_header(lines, headers, "Blockers", serialize_blockers(tasks, blocker_reasons))


def save(path: Path, lines: list[str]) -> None:
    content = "".join(lines)
    mode = path.stat().st_mode
    fd, temp_name = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=path.parent)
    temp_path = Path(temp_name)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="") as handle:
            handle.write(content)
            handle.flush()
            os.fsync(handle.fileno())
        os.chmod(temp_path, mode)
        os.replace(temp_path, path)
    except BaseException:
        try:
            temp_path.unlink(missing_ok=True)
        finally:
            raise


def load_validated(root: str) -> tuple[Path, list[str], list[Task], dict[str, tuple[int, str]], dict[str, Task], dict[str, str]]:
    path = plan_path(root)
    lines = path.read_text(encoding="utf-8").splitlines(keepends=True)
    tasks, headers = parse(lines)
    by_id = validate_tasks(tasks)
    blockers = validate_execution_state(tasks, by_id, headers)
    return path, lines, tasks, headers, by_id, blockers


def cmd_status(root: str) -> None:
    path, _lines, tasks, headers, by_id, blockers = load_validated(root)
    active = next((task for task in tasks if task.status == "~"), None)
    nxt = next_eligible(tasks, by_id, headers)
    counts = {status: sum(task.status == status for task in tasks) for status in [" ", "~", "x", "!"]}
    print(f"Plan: {path}")
    print(f"Tasks: {len(tasks)} | pending={counts[' ']} in-progress={counts['~']} complete={counts['x']} blocked={counts['!']}")
    blocked = [task for task in tasks if task.status == "!"]
    if active:
        print(f"Resume: {active.label}")
    elif blocked:
        current_id = task_id_from_header(headers["Current task"][1], "Current task")
        current = by_id[current_id] if current_id else blocked[0]
        print(f"Blocked: {current.label}")
        if len(blocked) > 1:
            print("Blocked tasks: " + ", ".join(task.id for task in blocked))
        print("Next eligible: — (automatic progression halted by blocker)")
    elif nxt:
        print(f"Next eligible: {nxt.label}")
    else:
        print("Next eligible: —")
    for name in HEADER_FIELDS:
        print(f"{name}: {headers[name][1]}")


def get_task(tasks: list[Task], task_id: str) -> Task:
    by_id = task_map(tasks)
    if task_id not in by_id:
        fail(f"task {task_id} not found")
    return by_id[task_id]


def cmd_start(root: str, task_id: str) -> None:
    path, lines, tasks, _headers, by_id, blockers = load_validated(root)
    task = get_task(tasks, task_id)
    active = [candidate for candidate in tasks if candidate.status == "~"]
    if active and active[0].id != task_id:
        fail(f"task {active[0].id} is already in progress")
    if task.status == "x":
        fail(f"task {task_id} is already complete")
    if task.status == "!":
        fail(f"task {task_id} is blocked; clear its blocker state before restarting it")
    incomplete = [dep for dep in task.deps if by_id[dep].status != "x"]
    if incomplete:
        fail(f"task {task_id} has incomplete dependencies: {', '.join(incomplete)}")

    if task.status != "~":
        lines[task.line] = replace_status(lines[task.line], "~")
    update_execution_headers(lines, blockers, current_task_id=task_id)
    save(path, lines)
    print(f"STARTED: {task_id} — {task.title}")


def cmd_complete(root: str, task_id: str) -> None:
    path, lines, tasks, _headers, by_id, blockers = load_validated(root)
    task = get_task(tasks, task_id)
    if task.status != "~":
        fail(f"task {task_id} must be in progress [~] before completion")
    incomplete = [dep for dep in task.deps if by_id[dep].status != "x"]
    if incomplete:
        fail(f"task {task_id} has incomplete dependencies: {', '.join(incomplete)}")

    lines[task.line] = replace_status(lines[task.line], "x")
    update_execution_headers(lines, blockers, last_completed=task.label)
    save(path, lines)
    print(f"COMPLETED: {task_id} — {task.title}")


def cmd_block(root: str, task_id: str, reason: str) -> None:
    reason = reason.strip()
    if not reason:
        fail("block reason must not be empty")

    path, lines, tasks, _headers, by_id, blockers = load_validated(root)
    task = get_task(tasks, task_id)
    active = [candidate for candidate in tasks if candidate.status == "~"]
    if active and active[0].id != task_id:
        fail(f"task {active[0].id} is already in progress; cannot block a different task")
    if task.status == "x":
        fail(f"task {task_id} is already complete")
    incomplete = [dep for dep in task.deps if by_id[dep].status != "x"]
    if incomplete:
        fail(f"task {task_id} has incomplete dependencies: {', '.join(incomplete)}")

    lines[task.line] = replace_status(lines[task.line], "!")
    blockers[task_id] = reason
    update_execution_headers(lines, blockers, current_task_id=task_id)
    save(path, lines)
    print(f"BLOCKED: {task_id} — {task.title}: {reason}")


def main(argv: list[str]) -> None:
    if len(argv) < 3:
        fail("usage: task-state.py <status|start|complete|block> <project-root> [task-id] [reason]")
    cmd, root = argv[1], argv[2]
    if cmd == "status" and len(argv) == 3:
        cmd_status(root)
    elif cmd == "start" and len(argv) == 4:
        cmd_start(root, argv[3])
    elif cmd == "complete" and len(argv) == 4:
        cmd_complete(root, argv[3])
    elif cmd == "block" and len(argv) >= 5:
        cmd_block(root, argv[3], " ".join(argv[4:]))
    else:
        fail("invalid arguments")


if __name__ == "__main__":
    main(sys.argv)
