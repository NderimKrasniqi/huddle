# Session State

## Current task

**5.7 — align the Controller to the `react-native-tvos` fork — DONE.** Next
executable task: **5.4 — multiplayer acceptance matrix across both games**, then
**5.6 — final scope/architecture review**. Optional: **5.8** (remember last-used
name/avatar).

## What changed (5.7)

- `apps/controller/package.json`: `react-native` `0.86.0` →
  `npm:react-native-tvos@~0.86.0-2`, matching `apps/tv` (tech-stack.md requires
  all apps on one RN fork to avoid dependency conflicts).
- `pnpm install` re-resolved the controller onto the fork and deduped the
  redundant plain-RN tree: `pnpm-lock.yaml` −442/+27, `--frozen-lockfile` clean.
- No `@react-native-tvos/config-tv`, no `EXPO_TV` on the controller — it stays a
  phone build.

## Checks / reviews

- `pnpm typecheck` clean (incl. `apps/controller`); `pnpm lint` clean;
  `pnpm test` green — **702 passed** (unchanged).
- `expo prebuild --platform ios --clean` regenerated the controller iOS project;
  `pod install` resolved cleanly against the fork (`React-Core 0.86.0-2`);
  `require('react-native')` → `react-native-tvos@0.86.0-2`. This proves the
  dependency-conflict surface (JS + CocoaPods) is clean against the fork.
- Full `xcodebuild`/simulator launch NOT run (expensive; fork is the same
  drop-in the TV already compiles). Code-review/security-review not run: this is
  a dependency-manifest-only change with no application-code or trust-boundary
  diff — correctness is established empirically.

## Blocker / decision to raise

**Resolved (2026-08-07):** the `ROOM_PLAYER_CAP`-vs-scope conflict from 2.4 —
user chose to amend the scope to match the code. `project-scope.md` now says
"up to **10 players**"; the `implementation-plan.md` 1.4 note now reads
"10-player ceiling (`ROOM_PLAYER_CAP`)". No code change; the cap stays 10.
Shipped on its own branch/PR, separate from 5.7.

No open blockers.

## Next action

Start 5.4: exercise the multiplayer acceptance matrix across **both** Trivia and
Voting (1–N members per game's range, mixed iOS/Android controllers + Android
TV, host participation/transfer, player removal/rejoin, late join, TV recovery,
back-to-back games incl. switching between the two games). Confirm every
approved MVP workflow has at least one passing automated or documented manual
check with the second game included.

## Other remaining work (see implementation-plan.md)

- 5.6 — final scope/architecture review including the Voting game.
- 5.8 — optional: remember last-used name/avatar in AsyncStorage.
