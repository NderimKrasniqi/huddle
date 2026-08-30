# Active implementation plan

Only unfinished release work requiring deployment or physical-device authority
is listed as tasks here. The execution state also names the latest completed
local UI slice because it changes what the remaining device task can prove;
older completed work remains available through Git history.

## Execution State

**Current feature:** Phone Join, identity, and QR camera integration
**Presentation status:** Phone Join Room now collects and remembers `GuestProfileV1`, resolves the ten approved avatar portraits, projects advisory room availability, calls the authoritative `joinRoom` mutation, persists the returned session token before seating, and mounts the focused branded QR camera route. TV Creating Room boot, restoration handoff, Room Invitation, and the four-stage Trivia/Voting/Word Battle/More Games game-flow remain implemented and locally verified; the Android TV emulator smoke check passed.
**Current presentation:** The Phone join route owns illustrated four-letter code entry, inline display-name validation, a two-row ten-avatar picker, claimed-avatar/full-room feedback, loading/rejection copy, and QR-route navigation. The focused scan route mounts Expo `CameraView` with rear-camera QR-only settings, prompts for permission immediately, keeps malformed scans inline, locks accepted scans, and replaces itself with `/join/[code]`; manual entry remains available for denied/unavailable cameras. The TV startup, restoration, Room Invitation, and game-flow surfaces remain display-only projections of authoritative state. Remaining Phone Room/Roster, Host controls, and game-module screens stay on centered `PurposeScreen` labels.
**Current phase:** 1.1 Deployment cutover and device proof
**Current task:** 1.1.3
**Last completed task:** Phone Join, identity, and QR camera integration
**Blockers:** 1.1.3: physical Android Phone QR evidence, a second mixed phone, and physical Android TV remote traversal are still required. Local Convex, render, typecheck, lint, architecture, and asset gates cover the new join/scanner behavior, but they do not substitute for real camera permissions or remote focus traversal.

## Phase 1.1 — Deployment cutover and device proof

**Outcome:** The locally verified presentation baseline and incremental Phone
Join Room, TV Creating Room boot, TV restoration handoff, TV Room Invitation,
and display-only TV game-flow exceptions are proven on the development
deployment and supported physical platforms without touching production data.

- [x] **1.1.1 — Audit and reset development rooms**
  - **Outcome:** Development room, membership, TV-session, and game counts are recorded, then reach zero through lifecycle cleanup.
  - **Work:** Deploy `developmentReset:audit`; enable both development-only reset gates; invoke the exact confirmation literal; audit zero; disable the gate; deploy the strict schema/runtime.
  - **Touches:** Convex development deployment only.
  - **Requirements:** DATA-001
  - **Verify:** Dated development deployment record; production deployment remains untouched.
  - **Depends on:** None
  - **Done when:** Zero active development rows are recorded and the reset gate is disabled.

- [x] **1.1.2 — Build supported clients and experimental tvOS**
  - **Outcome:** iOS Phone, Android Phone, and Android TV artifacts build with the new identity; the tvOS experiment is attempted and its platform limitation is recorded.
  - **Work:** Build/export clients, inspect `huddle-phone` / `tv.huddle.phone`, and inspect Android TV Leanback launcher metadata.
  - **Touches:** `apps/phone`, `apps/tv`, generated native projects.
  - **Requirements:** REL-001, REL-002
  - **Verify:** Dated client build proof.
  - **Depends on:** 1.1.1
  - **Done when:** Supported builds pass and experimental tvOS evidence is recorded separately.

- [!] **1.1.3 — Run physical end-to-end party check**
  - **Outcome:** The complete loop works with real camera, phones, and Android TV focus.
  - **Work:** Remove the old app, scan the TV QR with a physical Phone, join mixed phones with names and avatars, Ready every seat, Start/End both modules, exercise reconnect, and traverse Android TV focus. The local membership and camera slices are now connected; this task is device evidence only.
  - **Touches:** Development deployment and test devices.
  - **Requirements:** PLAT-001, PLAT-002, REL-003
  - **Verify:** Dated physical party checklist and local device captures.
  - **Depends on:** 1.1.2
  - **Done when:** Physical QR, lifecycle, reconnect, and focus gates all pass.

### Phase 1.1 Completion

- Development data was reset only through the guarded lifecycle path.
- The Phone membership/camera UI slice and shared avatar bundle are locally
  verified; the physical platform loop remains blocked on the second Android
  phone and physical Android TV remote listed above.
- The reset gate is disabled and production was never targeted.
- The active presentation keeps the intentional clean slate everywhere except
  the approved Phone Join Room/scanner, shared avatar resolver and runtime
  portraits, TV Creating Room boot, TV restoration handoff, TV Room Invitation,
  and TV game-flow renderers and their optimized supplied assets.
