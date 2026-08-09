# Session State

## Current task

**Soft Minimal screen replacement, Phase 3 — remove About and unknown-game.**
Complete on branch `feat/soft-minimal-design-assets`. The approved plan is
`~/.claude/plans/make-a-plan-to-enchanted-boole.md`; Phase 3 is marked DONE
there, with the three things the plan did not anticipate recorded against it.

Phase 2 (TV Room and carousel) is committed and pushed — `cd12570`.

## What this change did

- **The About Panel is gone.** `tv-about.tsx`, `about.ts` and `about.test.ts`
  deleted, and its mount removed from `TvStage`, which now holds only the screen
  it is handed.
- **`huddle/tv-remote-surface` has no exemption left.** The rule's `remoteOwner`
  option was removed outright rather than made optional — with the panel gone
  there is no file to name, and a dormant option would keep a paragraph of
  documentation alive for a hole nothing uses. `schema: []`, and the config
  passes `'error'` bare. Its test lost the three exemption cases and gained one
  that pins the opposite: a listener put back at `apps/tv/src/tv-about.tsx` is
  caught like a listener anywhere else.
- **Both unknown-game screens are gone.** `UnknownGameStage` (TV) and
  `UnknownGameScreen` (phone), plus the TV's four dead styles.
  `runningGameScreen` lost its third kind: a game this build lacks now resolves
  to `{kind: 'lobby'}`.
- **`deploymentUrl` un-exported** in `apps/tv/src/convex-client.ts` — the About
  Panel was its only reader.

## Checks

`pnpm -r typecheck` clean; `npx eslint . --max-warnings=0` clean; `npx vitest
run` green — **715 passed, 61 files** (was 746/62; `about.test.ts` and three
exemption cases went, one case came back). `npx expo export --platform ios`
succeeds in both `apps/tv` and `apps/controller`.

## Review

`workflow-code-reviewer`, fresh context. One blocking finding and five
non-blocking; all resolved. The blocking one is worth carrying forward:

**An out-of-date Host now has no way back to the lobby.** The deleted
`UnknownGameScreen` carried a `BackToLobbyControl` for the Host and said in its
own comment why — `endGame` is the only write that clears the running game, only
the Host may call it, and the only other control that calls it lives on the
in-game screen, which needs the module. A Host on an older build (reachable:
`handOverRoom` can hand a room over mid-game) lands on the ordinary lobby, whose
Start button refuses with "This room is already playing", and End Room — which
takes every seat with it — is the only exit.

Resolved as documentation rather than code: the comment on `runningGameScreen`
now states the limit instead of claiming a recovery that does not exist, and
**Phase 4 owns the fix**, since it is the phone's lobby navigation — the same
place Phase 2 sent its own leftover. If the user would rather close it now, the
code fix is small: render `BackToLobbyControl` for the Host when
`screen.kind === 'lobby'` and `running` is non-null.

The others: `game-rejection.ts` claimed no correct Controller produces
`alreadyInGame`, which a lobby drawn for a mid-game room now does (comment
fixed); the lint rule cited "zero remote interaction after launch" from
`docs/project-scope.md`, a phrase `600d844` removed from the docs (citation
fixed to the line that is actually there); an ambiguous clause in the
design-fidelity note; and `apps/tv`'s `expo-constants`, which the deleted panel
was the only importer of — left in place because `apps/controller` declares it
identically without importing it either, so removing it from one app only would
be an asymmetry on a guess.

No security review: nothing here touches auth, ownership, credentials,
participant data or a privileged operation. Removals only, plus one client-side
fallback.

## Not verified

Nothing was run on a simulator for this phase — it is three deletions and their
paperwork, and the deleted surfaces were unreachable without a build skew or a
remote press. The end-to-end walk in the plan's Verification section still
stands, and Phase 4 is the natural place to do it.

Also unproven, as before: real TV hardware.

## Where the plan stands

Phases 1, 2 and 3 of the screen replacement are done. **Phase 4 is next** — the
phone screens (Join, Your room, Pick a game, Waiting, Manage player sheet) —
and it now carries the out-of-date-Host escape above. Then Phase 5 (Leave).

From the MVP roadmap: 5.9 merged as PR #24; nothing outstanding there.

## Next action

Commit Phase 3 and push to PR #25. Then Phase 4.
