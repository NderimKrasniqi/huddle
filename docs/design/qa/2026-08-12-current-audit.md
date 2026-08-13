# Current simulator audit — 2026-08-12

This ledger records the live simulator comparison against the approved
references in `docs/design/reference/screens/`. It includes component-level
details so icon, color, size, copy, and clipping regressions do not get lost.

## Evidence

- The final evidence set is indexed in
  [`evidence/2026-08-12-platform-parity/`](./evidence/2026-08-12-platform-parity/README.md).
- Controller was rebuilt and run as an ad-hoc-signed Release build on iPhone
  17 (iOS 26.5).
- TV was rebuilt and run as an ad-hoc-signed Release build on Apple TV 4K (3rd
  generation, 1080p) (tvOS 26.5).
- Approved-reference composites cover all ten phone references and all three TV
  references. Additional raw captures cover launch/loading, empty and alternate
  states, the Category and Leave sheets, and player/Host/TV recovery.
- `pnpm typecheck`, `pnpm lint`, and `git diff --check` pass after the visual
  changes.
- Native builds succeeded. Xcode emits upstream Expo/React deprecation and
  run-script warnings; no build errors occurred.

## Cross-cutting note

The earlier Expo Debug Tools overlap was excluded from final evidence by using
Release builds. It remains a debug-runtime caveat, not an app-component defect.

## Phone screens

| Reference | Fresh simulator result | Remaining mismatch / decision |
| --- | --- | --- |
| `01-join-room.png` | Release captures cover the empty form and the code-ready state; native wordmark and all ten live avatars render. | Avatar layout is a stable 5×2 while the board shows 4×2; retaining ten avatars is a settled product decision. Empty-code/disabled Join behavior is intentional. |
| `02-your-room-host.png` | Release room capture shows the native wordmark, room-code tiles, live avatar/status treatment, Host crown, and bottom-anchored Choose a game action. | Live roster/count and bare-device scale differ from the mock-device reference. |
| `03-manage-player-host.png` | Release captures cover both Online and Away targets. The Away composite includes the grabber, dimmed avatar, disabled Make host action and explanation, Remove, and Cancel. | The reference uses a somewhat taller target presentation; live identity and authorization state remain authoritative. |
| `04-pick-a-game-host.png` | Trivia key art, native header, matching art-colored footer, clean CTA, pager, and bottom action group render; selection follows TV. | Card/pager remain smaller than the board. Live registry has four entries (`1 / 4`) while the stale board says `2 / 3`; keep catalog truth. |
| `05-waiting-player.png` | Release capture shows the Host avatar, native wordmark, green Now viewing panel, and controller-info card. | Hero/card scale differs from the reference; the live Leave action is retained. |
| `06-game-settings-host-standard.png` | Release capture shows the selected Standard card, orange check, preset summary, joining notice, and Start CTA. | Live Trivia metadata is `2–10` and `All categories`; board is `2–12` and `General`. This is schema/catalog data, not a layout defect. |
| `07-game-settings-host-quick.png` | Release capture verifies Quick selection and its authoritative summary values with the same Kit selected treatment. | Reference metadata remains illustrative where it differs from the installed schema. |
| `08-game-settings-host-custom.png` | Release capture verifies the custom steppers, difficulty/score controls, category row, joining notice, and Start CTA without clipping. | Board defaults (15/Hard/30/Movie) differ from installed schema defaults (10/Mixed/20/All); that is product data. |
| Category picker | Release raw capture verifies the sheet, selection treatment, Done, and Cancel. | No standalone approved reference image exists; exact sheet spacing remains a lower-priority visual pass. |
| `09-game-finished-player.png` | Release capture after a real game shows the native wordmark, enlarged avatar, completion copy, active-room panel, Host guidance, and token-native celebration. | No approved botanical celebration asset exists in the repo; the current celebration remains the documented adaptation. |
| `10-game-finished-host.png` | Release capture shows the larger hero/stat geometry, `Correct answers`, trophy, replay, Choose another game, Manage players, and active-room footer. | Live winner/count data and bare-device scale differ from the reference snapshot by design. |

### Small-component checklist

- Shared phone headers use the supplied `Wordmark` asset rather than the small
  recreated logo in seated, join, settings, and finished-player surfaces.
- Controller primary actions no longer carry the dark hairline from the old
  wrapper; room and picker actions are grouped at the bottom of the content.
- Room roster rows use larger avatars and a native crown after HOST.
- Huddle Kit `ModeCard` now uses selected orange icon/label/check treatment.
- Segmented Kit options shrink to the available custom-settings row width.
- Waiting status uses `colors.onlineSurface` (pale green).
- TV JUST JOINED uses the board copy without the exclamation and constrained
  tracking/padding so it fits inside a five-seat row.
- Manage sheets use a visible grabber; finished-player explainer includes the
  host crown and finished-host actions include trophy, gamepad, and refresh
  glyphs.

## TV screens

| Reference | Fresh simulator result | Remaining mismatch / decision |
| --- | --- | --- |
| `01-room.png` | Release captures cover an empty signed room and a two-player room with live code, QR, roster, Host, and Online treatments. | Title-safe inset and smaller title/wordmark/tiles/QR remain; ten seats and `of 10` are settled product decisions. |
| `02-game-carousel.png` | Release capture shows real game art while the phone browses; card footers continue the art surface, pagination uses round dots, and the browsing helper uses the Kit phone glyph without a card background. | Card geometry, live pager/catalog, and side-card treatment remain different from the board. |
| `03-game-setup.png` | Release Standard and Custom captures show Trivia art, QR/code, live roster, and authoritative dynamic settings; the left rules column stays clear of the hero/QR column. | Reference is a larger fixed rules-list/hero composition; live setup is intentionally data-driven and compact. |

### TV small-component checklist

- JUST JOINED is now a one-line 118pt-seat-safe chip.
- TV room’s title-safe stage scale remains a deliberate overscan/hardware
  exception and should not be removed without testing a real television.
- Existing Huddle Kit/native art assets are used for the wordmark, avatars,
  game key art, icons, and QR/code primitives; no replacement bitmap was
  invented for the missing celebration artwork.

## Remaining priority

1. Decide whether reference-only Trivia metadata should become the installed
   schema or remain catalog truth.
2. Finish the remaining TV card geometry and source approved celebration artwork
   if it becomes available.
3. Run the physical Android TV and mixed-controller release matrix; simulator
   evidence does not replace hardware overscan, camera deep-link, or lifecycle
   checks.
