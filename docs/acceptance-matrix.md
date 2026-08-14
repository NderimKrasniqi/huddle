# Current acceptance matrix

Requirement IDs are stable traceability keys. Automated evidence names the
owning suite or validator; manual rows remain release blockers until recorded.

| ID | Requirement | Evidence |
| --- | --- | --- |
| PLAT-001 | TV creates/restores one room; Phone Join Room accepts manual/deep-linked codes while membership mutation remains a separately tested deferred UI seam | Convex room/player tests; Join Room render tests; route/state tests |
| PLAT-002 | Join Room opens the modal scan route; scan parser retains permission/error/malformed/duplicate seams while the current modal does not mount a camera | Join adapter/render tests; Phone scan parser/tests; Expo Camera configuration |
| ID-001 | UUID guest profile persists/migrates name/avatar and is non-authoritative | Phone identity tests; Convex membership tests |
| READY-001 | Host locks setup; each seat controls only itself; Host also Readies | Convex `games.test.ts` |
| READY-002 | Start requires every seat Ready and present; new/away/removed seats follow policy | Convex `games.test.ts`; presence/player tests |
| READY-003 | Reopen/switch/end/expiry clear readiness; transfer preserves others | Convex game/player/room tests |
| GAME-001 | Trivia Questions 5/10 launches its module contract and maps to `Trivia game` on Phone and TV | Trivia settings/logic tests; Convex launch-proof test; render/mapping tests |
| GAME-002 | Voting Rounds 3/5 launches independently and maps to `Voting game` on Phone and TV | Voting settings/logic tests; Convex launch-proof test; render/mapping tests |
| GAME-003 | Host End returns TV and every Phone to the same resolved lobby state | Convex launch-proof test; coordinator tests |
| GAME-004 | Production clients exclude Trivia future content and Convex excludes native screens | architecture validator; pack validator; bundle-seam check |
| RATE-001 | Documented buckets return structured retry timing; heartbeats/internal work remain exempt | rate-limit policy/integration tests; client rejection tests |
| UI-001 | The Phone Join Room route matches its illustrated code/QR surface; TV Room Invitation matches its uniformly scaled 1280×720 living-room stage with authoritative code, dynamic QR, ten-seat live roster, accessible labels, and no focus targets; every other active Phone, TV, and module screen remains a centered `PurposeScreen` label | Join Room, Room Invitation, controller, adapter, and purpose render tests; purpose mapping tests; UI-stack/architecture validator |
| UI-002 | Shared tokens, app configuration, and packaging assets stay white/black neutral; runtime artwork is limited to the exact app-owned Phone PNGs and TV background/phone icon, while the supplied TV empty-room composite remains hash-validated and unbundled | token tests; app configuration validator; asset hash/dimension and reference-import validators |
| ARCH-001 | Renamed paths/native identity and acyclic boundaries hold | architecture/routes/native-identity/boundary validators |
| DOC-001 | Every Markdown file is classified; active links/paths/terms and requirement IDs validate | `pnpm validate:workflow` |
| REL-001 | iOS Phone, Android Phone, and Android TV build/export; IDs and Leanback metadata are inspected | [clean-slate validation](design/qa/evidence/platform-consolidation/2026-08-14-clean-slate-validation.md); export/build commands |
| REL-002 | tvOS compiles/runs as experimental evidence only | experimental tvOS result |
| REL-003 | Phone Join Room screenshots cover standard/compact and keyboard-open/closed layouts; Android TV proof covers the live Room Invitation against its supplied reference and confirms no D-pad focus targets; remaining screens preserve the centered baseline, with physical camera and remote gates tracked separately | Join Room and TV Room Invitation visual inspection; [clean-slate validation](design/qa/evidence/platform-consolidation/2026-08-14-clean-slate-validation.md); render tests; dated device checklist |
| DATA-001 | Development counts audited; guarded reset reaches zero; gate disabled; production untouched | development reset record |

No exact test totals are normative; suites evolve while these behaviors remain.
