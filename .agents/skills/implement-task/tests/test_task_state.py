import subprocess
import tempfile
import unittest
from pathlib import Path

SKILL_ROOT = Path(__file__).resolve().parents[1]
SCRIPT = SKILL_ROOT / "scripts" / "task-state.py"


def task_line(task_id: str, title: str, status: str = " ", deps: tuple[str, ...] = ()) -> str:
    depends = ", ".join(deps) if deps else "None"
    return (
        f"- [{status}] **{task_id} — {title}**\n"
        f"  - **Outcome:** {title}\n"
        f"  - **Depends on:** {depends}\n"
        f"  - **Done when:** verified\n"
    )


def plan_text(
    tasks: list[tuple[str, str, str, tuple[str, ...]]],
    *,
    current_task: str = "—",
    current_feature: str = "—",
    current_phase: str = "—",
    last_completed: str = "—",
    blockers: str = "None",
    include_headers: bool = True,
) -> str:
    header = "# Implementation Plan\n\n## Execution State\n\n"
    if include_headers:
        header += (
            f"**Current feature:** {current_feature}  \n"
            f"**Current phase:** {current_phase}  \n"
            f"**Current task:** {current_task}  \n"
            f"**Last completed task:** {last_completed}  \n"
            f"**Blockers:** {blockers}\n\n"
        )
    body = "# Feature 1 — F-001 Example\n\n## Phase 1.1 — Core\n\n"
    body += "\n".join(task_line(*task) for task in tasks)
    return header + body


class TaskStateTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)

    def tearDown(self):
        self.tmp.cleanup()

    def write_plan(self, text: str) -> None:
        (self.root / "implementation-plan.md").write_text(text, encoding="utf-8")

    def run_cmd(self, *args: str, ok: bool = True) -> subprocess.CompletedProcess[str]:
        result = subprocess.run(
            ["python3", str(SCRIPT), *args],
            text=True,
            capture_output=True,
        )
        if ok and result.returncode != 0:
            self.fail(f"command failed: {result.stderr}\n{result.stdout}")
        if not ok and result.returncode == 0:
            self.fail(f"command unexpectedly succeeded: {result.stdout}")
        return result

    def valid_three_task_plan(self) -> str:
        return plan_text([
            ("1.1.1", "First", " ", ()),
            ("1.1.2", "Second", " ", ("1.1.1",)),
            ("1.1.3", "Independent", " ", ()),
        ])

    def test_normal_next_task_selection(self):
        self.write_plan(self.valid_three_task_plan())
        result = self.run_cmd("status", str(self.root))
        self.assertIn("Next eligible: 1.1.1 First", result.stdout)

    def test_current_pending_task_takes_precedence_when_eligible(self):
        self.write_plan(plan_text(
            [
                ("1.1.1", "First", " ", ()),
                ("1.1.2", "Preferred", " ", ()),
            ],
            current_task="1.1.2 Preferred",
            current_feature="F-001 Example",
            current_phase="1.1 Core",
        ))
        result = self.run_cmd("status", str(self.root))
        self.assertIn("Next eligible: 1.1.2 Preferred", result.stdout)

    def test_incomplete_dependency_rejects_start(self):
        self.write_plan(self.valid_three_task_plan())
        result = self.run_cmd("start", str(self.root), "1.1.2", ok=False)
        self.assertIn("incomplete dependencies: 1.1.1", result.stderr)

    def test_in_progress_task_is_resumed(self):
        self.write_plan(plan_text(
            [
                ("1.1.1", "First", "~", ()),
                ("1.1.2", "Second", " ", ()),
            ],
            current_task="1.1.1 First",
            current_feature="F-001 Example",
            current_phase="1.1 Core",
        ))
        result = self.run_cmd("status", str(self.root))
        self.assertIn("Resume: 1.1.1 First", result.stdout)

    def test_resume_start_is_idempotent_for_same_task(self):
        text = plan_text(
            [("1.1.1", "First", "~", ())],
            current_task="1.1.1 First",
            current_feature="F-001 Example",
            current_phase="1.1 Core",
        )
        self.write_plan(text)
        self.run_cmd("start", str(self.root), "1.1.1")
        after = (self.root / "implementation-plan.md").read_text(encoding="utf-8")
        self.assertEqual(after.count("[~] **1.1.1"), 1)

    def test_blocked_task_stops_automatic_progression(self):
        self.write_plan(self.valid_three_task_plan())
        self.run_cmd("block", str(self.root), "1.1.1", "needs product decision")
        result = self.run_cmd("status", str(self.root))
        self.assertIn("Next eligible: — (automatic progression halted by blocker)", result.stdout)
        self.assertNotIn("Next eligible: 1.1.3", result.stdout)

    def test_explicit_independent_task_can_start_while_another_is_blocked(self):
        self.write_plan(self.valid_three_task_plan())
        self.run_cmd("block", str(self.root), "1.1.1", "reason A")
        self.run_cmd("start", str(self.root), "1.1.3")
        text = (self.root / "implementation-plan.md").read_text(encoding="utf-8")
        self.assertIn("[!] **1.1.1", text)
        self.assertIn("[~] **1.1.3", text)
        self.assertIn('**Blockers:** {"1.1.1":"reason A"}', text)

    def test_blocker_reason_survives_independent_task_completion(self):
        self.write_plan(self.valid_three_task_plan())
        self.run_cmd("block", str(self.root), "1.1.1", "reason A")
        self.run_cmd("start", str(self.root), "1.1.3")
        self.run_cmd("complete", str(self.root), "1.1.3")
        text = (self.root / "implementation-plan.md").read_text(encoding="utf-8")
        self.assertIn('**Blockers:** {"1.1.1":"reason A"}', text)
        self.assertIn("**Current task:** 1.1.1 First", text)

    def test_multiple_blocked_tasks_preserve_each_reason(self):
        self.write_plan(self.valid_three_task_plan())
        self.run_cmd("block", str(self.root), "1.1.1", "reason A")
        self.run_cmd("start", str(self.root), "1.1.3")
        self.run_cmd("block", str(self.root), "1.1.3", "reason B")
        text = (self.root / "implementation-plan.md").read_text(encoding="utf-8")
        self.assertIn('**Blockers:** {"1.1.1":"reason A","1.1.3":"reason B"}', text)
        result = self.run_cmd("status", str(self.root))
        self.assertIn("Blocked tasks: 1.1.1, 1.1.3", result.stdout)
        self.assertIn("Blocked: 1.1.3 Independent", result.stdout)

    def test_nonexistent_dependency_is_rejected(self):
        self.write_plan(plan_text([("1.1.1", "First", " ", ("9.9.9",))]))
        result = self.run_cmd("status", str(self.root), ok=False)
        self.assertIn("depends on nonexistent task 9.9.9", result.stderr)

    def test_forward_dependency_is_rejected(self):
        self.write_plan(plan_text([
            ("1.1.1", "First", " ", ("1.1.2",)),
            ("1.1.2", "Second", " ", ()),
        ]))
        result = self.run_cmd("status", str(self.root), ok=False)
        self.assertIn("non-prior dependency 1.1.2", result.stderr)

    def test_dependency_cycle_is_rejected(self):
        self.write_plan(plan_text([
            ("1.1.1", "First", " ", ("1.1.2",)),
            ("1.1.2", "Second", " ", ("1.1.1",)),
        ]))
        result = self.run_cmd("status", str(self.root), ok=False)
        self.assertIn("dependency cycle detected", result.stderr)
        self.assertIn("1.1.1 -> 1.1.2 -> 1.1.1", result.stderr)

    def test_in_progress_task_with_incomplete_dependency_is_rejected(self):
        self.write_plan(plan_text(
            [
                ("1.1.1", "First", " ", ()),
                ("1.1.2", "Second", "~", ("1.1.1",)),
            ],
            current_task="1.1.2 Second",
            current_feature="F-001 Example",
            current_phase="1.1 Core",
        ))
        result = self.run_cmd("status", str(self.root), ok=False)
        self.assertIn("in-progress task 1.1.2 has incomplete dependencies", result.stderr)

    def test_stale_current_task_is_rejected(self):
        self.write_plan(plan_text(
            [("1.1.1", "First", "x", ())],
            current_task="1.1.1 First",
            current_feature="F-001 Example",
            current_phase="1.1 Core",
            last_completed="1.1.1 First",
        ))
        result = self.run_cmd("status", str(self.root), ok=False)
        self.assertIn("must be pending [ ]", result.stderr)

    def test_missing_execution_state_headers_are_rejected(self):
        self.write_plan(plan_text([("1.1.1", "First", " ", ())], include_headers=False))
        result = self.run_cmd("status", str(self.root), ok=False)
        self.assertIn("execution-state fields missing", result.stderr)

    def test_blocker_header_must_match_blocked_markers(self):
        self.write_plan(plan_text(
            [("1.1.1", "First", "!", ())],
            current_task="1.1.1 First",
            current_feature="F-001 Example",
            current_phase="1.1 Core",
            blockers="None",
        ))
        result = self.run_cmd("status", str(self.root), ok=False)
        self.assertIn("missing reasons for 1.1.1", result.stderr)

    def test_header_updates_preserve_markdown_line_break_spacing(self):
        self.write_plan(self.valid_three_task_plan())
        self.run_cmd("start", str(self.root), "1.1.1")
        lines = (self.root / "implementation-plan.md").read_text(encoding="utf-8").splitlines()
        current_feature = next(line for line in lines if line.startswith("**Current feature:**"))
        current_phase = next(line for line in lines if line.startswith("**Current phase:**"))
        current_task = next(line for line in lines if line.startswith("**Current task:**"))
        self.assertTrue(current_feature.endswith("  "))
        self.assertTrue(current_phase.endswith("  "))
        self.assertTrue(current_task.endswith("  "))


    def test_blocker_reason_round_trips_task_like_delimiters(self):
        self.write_plan(self.valid_three_task_plan())
        reason = 'waiting; 1.1.2: external issue; quote="keep"; unicode=åäö'
        self.run_cmd("block", str(self.root), "1.1.1", reason)
        text = (self.root / "implementation-plan.md").read_text(encoding="utf-8")
        self.assertIn('"1.1.1":"waiting; 1.1.2: external issue; quote=\\\"keep\\\"; unicode=åäö"', text)
        result = self.run_cmd("status", str(self.root))
        self.assertIn("Blocked: 1.1.1 First", result.stdout)

    def test_legacy_blocker_format_remains_readable(self):
        self.write_plan(plan_text(
            [("1.1.1", "First", "!", ())],
            current_task="1.1.1 First",
            current_feature="F-001 Example",
            current_phase="1.1 Core",
            blockers="1.1.1: legacy reason",
        ))
        result = self.run_cmd("status", str(self.root))
        self.assertIn("Blocked: 1.1.1 First", result.stdout)

    def test_atomic_save_preserves_file_mode_and_leaves_no_temp_file(self):
        self.write_plan(self.valid_three_task_plan())
        plan = self.root / "implementation-plan.md"
        plan.chmod(0o640)
        self.run_cmd("start", str(self.root), "1.1.1")
        self.assertEqual(plan.stat().st_mode & 0o777, 0o640)
        self.assertEqual(list(self.root.glob(".implementation-plan.md.*.tmp")), [])


if __name__ == "__main__":
    unittest.main()
