# Session State

## Current task

**Soft Minimal screen replacement, Phase 4 — the phone screens.** Complete on
branch `feat/soft-minimal-design-assets`. The approved plan is
`~/.claude/plans/make-a-plan-to-enchanted-boole.md`; Phase 4 is marked DONE
there, with the four things the plan did not anticipate recorded against it.

Phases 1–3 are committed and pushed (`6cb2b48`, `cd12570`, `8654088`).

## What this change did

**An icon layer, delivered mid-phase.** The user handed over a fifteen-glyph set
and the rule that goes with it: room-code tiles, buttons, cards, chips, status
dots, shadows, borders, page dots, player slots and swatches stay React Native
components so they scale across phones and TVs, and the QR is generated (it
already was). So the icons are **geometry, not artwork** — SVG sources in
`packages/ui/assets/icons/`, transcribed into `packages/ui/src/icons.ts`, drawn
by `Icon` with `react-native-svg`, coloured from a token at the call site.
`icons.test.ts` parses the sources and fails if the transcription drifts. The
delivered badge and status-dot PNGs were deliberately **not** wired, and the
dark/white PNG pairs were not taken at all.

**The four screens, against the boards.** Join gains a deterministic 4-column
avatar grid and a check badge; `YoureInScreen` becomes a chooser over
`YourRoomScreen`, `PickAGameScreen` and `WaitingScreen`; the roster row is
borderless with hairline rules and a four-state right slot (HOST + crown / JUST
JOINED / online dot / Away + clock); the manage sheet stacks its target and
draws Remove as the one orange bar.

**`just-joined.ts` moved to `packages/game-core`** and became generic over the
seat id, because the phone roster now draws the chip and an app cannot import
another app.

**Phase 3's owed escape hatch is closed.** `YourRoomScreen` takes `stranded` and
draws Back to lobby instead of the picker when the room reports a game this
build lacks.

**Dead code removed:** `lobbyStatusText`, `browsedGameMeta`, `HostPill`,
`LobbyGameControls`, `HostRoster`, `HostGamePicker`, `NowViewing`, and ten dead
styles — seven of them left over from the colour picker Phase 1 deleted.

## Checks

The five steps `.github/workflows` actually runs, by name: `pnpm typecheck`,
`pnpm lint`, `pnpm test:unit` (**587 passed, 59 files**), `pnpm test:integration`
(**166 passed, 5 files**), `pnpm validate:packs`. All clean. `expo export
--platform ios` succeeds in both apps.

**Run those, not hand-assembled equivalents.** `pnpm typecheck` is `tsc --noEmit
&& pnpm -r typecheck`, and the recursive half alone — which is what every
session ran from the palette swap onward — covers only the workspace packages.
The bare root `tsc` is the sole thing that typechecks files belonging to no
package: `eslint-rules/`, `test/`. CI was red on fourteen consecutive commits
over one error nobody saw locally (`colors.punch`, deleted by the palette swap,
still referenced by `boardwalk-tokens-only.test.ts`). Fixed in `5c85d72`; that
was the branch's first green run.

## Review

`workflow-code-reviewer`, fresh context. Four blocking findings and ten
non-blocking; all fixed. Three are worth carrying:

1. **`expo export` does not run CocoaPods, so it cannot prove a native
   dependency.** `react-native-svg` is native, and `apps/controller` aliases
   `react-native` to `react-native-tvos` exactly as the TV does — so it needed
   the TV's `REACT_NATIVE_NODE_MODULES_DIR` escape hatch or `pod install` dies
   on `File.join(nil, ...)`. Every check in the plan's Verification list passed
   while the phone could not be built at all. **Verified the mechanism directly**
   with a Ruby probe of the podspec's own resolution: without the variable the
   sibling lookup and the fallback are both `nil`; with it, the fallback
   resolves. Adding a native module is a `prebuild` gate, not an `export` one.
2. **The phone copied the TV's arrival hooks and dropped half of each.**
   `useRoomRoster` flattened the in-flight roster to `[]`, which made the
   baseline snapshot empty and greeted everybody already in the room on a cold
   start. And `RosterRow`'s timer cleanup cancelled the greeting without
   spending it, so stepping to the picker and back inside four seconds
   re-announced the arrival, every time. Both fixed the way the television
   already does it; both of the TV's comments explain exactly why, and neither
   was read.
3. **`picking` survived a game and was checked before `stranded`.** A game now
   ends onto Your room, and the picker guard reads `stranded` first, which is
   what makes `game-rejection.ts`'s "no correct Controller offers to start a
   room already playing" true again.

## Not verified

**Nothing has been run on a simulator this phase, and no pixel pass was done
against the boards.** Structure and content follow the five boards; sizes and
gaps are judged, not measured, unlike Phase 2's Room. The plan's Verification
step 2 (boot a TV sim and a phone sim and walk the flow) and step 3 (screenshot
each screen beside its board) are both outstanding and are the natural next
move — and step 2 now also has to cover `pnpm --filter @huddle/controller
prebuild`, which is the check that would have caught finding 1.

Also unproven, as before: real TV hardware.

## Where the plan stands

Phases 1–4 of the screen replacement are done. **Phase 5 is next** — Leave:
`leaveRoom` in `convex/convex/players.ts`, `endRoom` losing its caller, the
phone clearing its own session with no notice, and the header pill's label
finally moving from `End room` to `Leave`.

Two things recorded in the handoff as outstanding rather than done: greying
taken avatars on the join picker (a live roster subscription on a form that
deliberately has none), and the End Room sheet's Soft Minimal treatment.

From the MVP roadmap: every task is checked, 5.9 included (PR #24). Nothing
substantive remains in `docs/implementation-plan.md`.

## `origin/main` is merged in

The branch had drifted six commits behind while this work ran, and PR #25 was
`CONFLICTING`. `origin/main` is now merged, six conflicts resolved:

- **`apps/tv/src/tv-stage.tsx` — both sides kept.** Main's PR #23 insets the
  stage into the title-safe 90% (real televisions crop ~5% of every edge without
  saying so); this branch made the background artwork the canvas and deleted the
  About Panel. The resolution takes all three. They compose rather than collide:
  the inset *scales* the stage instead of cropping it, so the artwork is inset
  with the content and its composition holds.
- **Three game modules — main's structure, this branch's palette.** 5.9 moved
  each game's metadata into its own `metadata.ts` so a client bundle stops
  carrying the rules; the palette swap had changed the `keyArt` colour in the
  old location. Taking main's side alone would have restored `punch`,
  `tangerine` and `yellow` — three tokens Soft Minimal deleted — so each moved
  value was re-applied in its new home. Trivia is `ink`, Hot Takes is `accent`:
  the only two card fills one accent leaves, and a third game is where that
  stops working.
- **`trivia.test.ts`** — main's side; the helper's callers moved to
  `logic.test.ts` in the same split, so keeping it would have been dead code.
- **This file** — this branch's side; main's copy describes 5.9, which is done.

## Next action

Phase 5 — Leave.
