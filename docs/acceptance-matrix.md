# Current acceptance matrix

Requirement IDs are stable traceability keys. Automated evidence names the
owning suite or validator; manual rows are release blockers until recorded.

| ID | Requirement | Evidence |
| --- | --- | --- |
| PLAT-001 | TV creates/restores one room; Phone joins by manual code/deep link | Convex room/player tests; app join tests |
| PLAT-002 | In-app QR handles permission, denial/settings, malformed/duplicate payloads, unavailable camera, and replacement navigation | Phone scan parser/tests; physical-device QR gate |
| ID-001 | UUID guest profile persists/migrates name/avatar and is non-authoritative | Phone identity tests; Convex membership tests |
| READY-001 | Host locks setup; each seat controls only itself; Host also Readies | Convex `games.test.ts` |
| READY-002 | Start requires every seat Ready and present; new/away/removed seats follow policy | Convex `games.test.ts`; presence/player tests |
| READY-003 | Reopen/switch/end/expiry clear readiness; transfer preserves others | Convex game/player/room tests |
| GAME-001 | Trivia Questions 5/10 launches module-owned entered screens | Trivia logic/settings tests; Convex launch-proof test; render tests |
| GAME-002 | Voting Rounds 3/5 launches independently | Voting logic/settings tests; Convex launch-proof test; render tests |
| GAME-003 | Host End returns TV and every Phone to the same lobby | Convex launch-proof test; rendered app tests |
| GAME-004 | Production clients exclude Trivia future content and Convex excludes native screens | architecture validator; pack validator; bundle-seam check |
| RATE-001 | All documented buckets return structured retry timing; heartbeats/internal work are exempt | rate-limit policy/integration tests; client rejection tests |
| UI-001 | NativeWind/Tailwind tokens are active; old StyleSheet/Image/Animated imports are blocked | lint; UI-stack validator; typecheck/render tests |
| ARCH-001 | Renamed paths/native identity and acyclic boundaries hold | architecture/routes/native-identity/boundary validators |
| DOC-001 | Every Markdown file is classified; active links/paths/terms and requirement IDs validate | `pnpm validate:workflow` |
| REL-001 | iOS Phone, Android Phone, and Android TV build/export; IDs and Leanback metadata inspected | manual build artifact record |
| REL-002 | tvOS compiles/runs as experimental evidence only | manual simulator record |
| REL-003 | Physical QR, mixed phones, Ready/Start/End/reconnect, and Android TV focus pass | manual device checklist |
| DATA-001 | Development counts audited; guarded reset reaches zero; gate disabled; production untouched | [development reset record](design/qa/evidence/platform-consolidation/2026-08-13-development-reset.md) |

No exact test totals are normative; suites evolve while these behaviors remain.
