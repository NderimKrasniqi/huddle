# Active implementation plan

Only unfinished release work requiring deployment or physical-device authority
is listed as tasks here. The execution state also names the latest completed
local UI slice because it changes what the remaining device task can prove;
older completed work remains available through Git history.

## Execution State

**Current feature:** —
**Presentation status:** Join Room is implemented and locally verified; device proof and later membership/camera slices remain
**Current presentation:** The Phone join route owns illustrated four-letter code entry and QR-route navigation; every other Phone, TV, and game-module screen remains on centered `PurposeScreen` labels.
**Current phase:** 1.1 Deployment cutover and device proof
**Current task:** 1.1.3
**Last completed task:** 1.1.2
**Blockers:** 1.1.3: The active Join Room adapter intentionally does not create a seat and the scan modal does not mount a camera, so the full physical party loop waits for later membership/camera slices; a physical Android Phone and Android TV remote are still required for the mixed-phone and physical-focus gates.

## Phase 1.1 — Deployment cutover and device proof

**Outcome:** The locally verified presentation baseline and incremental Join
Room exception are proven on the development deployment and supported physical
platforms without touching production data.

- [x] **1.1.1 — Audit and reset development rooms**
  - **Outcome:** Development room, membership, TV-session, and game counts are recorded, then reach zero through lifecycle cleanup.
  - **Work:** Deploy `developmentReset:audit`; enable both development-only reset gates; invoke the exact confirmation literal; audit zero; disable the gate; deploy the strict schema/runtime.
  - **Touches:** Convex development deployment only.
  - **Requirements:** DATA-001
  - **Verify:** [Dated development deployment record](design/qa/evidence/platform-consolidation/2026-08-13-development-reset.md); production deployment remains untouched.
  - **Depends on:** None
  - **Done when:** Zero active development rows are recorded and the reset gate is disabled.

- [x] **1.1.2 — Build supported clients and experimental tvOS**
  - **Outcome:** iOS Phone, Android Phone, and Android TV artifacts build with the new identity; the tvOS experiment is attempted and its platform limitation is recorded.
  - **Work:** Build/export clients, inspect `huddle-phone` / `tv.huddle.phone`, and inspect Android TV Leanback launcher metadata.
  - **Touches:** `apps/phone`, `apps/tv`, generated native projects.
  - **Requirements:** REL-001, REL-002
  - **Verify:** [Dated client build proof](design/qa/evidence/platform-consolidation/2026-08-13-client-builds.md).
  - **Depends on:** 1.1.1
  - **Done when:** Supported builds pass and experimental tvOS evidence is recorded separately.

- [!] **1.1.3 — Run physical end-to-end party check**
  - **Outcome:** The complete loop works with real camera, phones, and Android TV focus.
  - **Work:** After the deferred membership and camera slices are connected, remove the old app, scan TV QR, join mixed phones, Ready every seat, Start/End both modules, exercise reconnect, and traverse Android TV focus. Until then, visually prove code entry and QR modal navigation on supported Phone layouts.
  - **Touches:** Development deployment and test devices.
  - **Requirements:** PLAT-001, PLAT-002, REL-003
  - **Verify:** [Dated physical party checklist](design/qa/evidence/platform-consolidation/2026-08-13-physical-party-check.md) and local device captures under `docs/design/qa/evidence/platform-consolidation/`.
  - **Depends on:** 1.1.2
  - **Done when:** Physical QR, lifecycle, reconnect, and focus gates all pass.

### Phase 1.1 Completion

- Development data was reset only through the guarded lifecycle path.
- All supported builds pass; the physical platform loop remains blocked on the
  deferred membership/camera UI slices, second Android phone, and physical
  Android TV remote listed above.
- The reset gate is disabled and production was never targeted.
- The active presentation keeps the intentional clean slate everywhere except
  the approved Phone Join Room renderer and its three Phone-specific assets.
