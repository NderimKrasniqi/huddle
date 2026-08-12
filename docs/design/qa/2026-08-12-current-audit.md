# Current simulator audit — 2026-08-12

This ledger records the live simulator comparison against the approved
references in `docs/design/reference/screens/`. It includes component-level
details so icon, color, size, copy, and clipping regressions do not get lost.

## Evidence

- Controller rebuilt and run on iPhone 17 and iPhone 17 Pro (iOS 26.5).
- TV rebuilt and run on Apple TV 4K (3rd generation, 1080p) (tvOS 26.5).
- Fresh captures covered the room, waiting player, picker, standard settings,
  custom settings, manage-player sheet, join form, and TV setup.
- `pnpm typecheck`, `pnpm lint`, and `git diff --check` pass after the visual
  changes.
- Native builds succeeded. Xcode emits upstream Expo/React deprecation and
  run-script warnings; no build errors occurred.

## Cross-cutting issue

The Expo Debug Tools launcher remains visible at the upper-right of debug
captures and can overlap/intercept Leave and navigation controls. This is a
debug-runtime issue, not an app component. Use a release build for final tap
target and pixel sign-off.

## Phone screens

| Reference | Fresh simulator result | Remaining mismatch / decision |
| --- | --- | --- |
| `01-join-room.png` | Join form runs with no phone “Finding your room” state; native wordmark and ten avatars render. | Avatar layout is now a stable 5×2 on the 368pt simulator; the board shows 4×2, but ten avatars are a settled product decision. Header/field spacing was tightened against the live capture. Empty-code/disabled Join behavior is intentional. |
| `02-your-room-host.png` | Fresh room capture shows native wordmark, larger room-code tiles/avatars, host crown, and bottom-anchored Choose a game. | Debug gear overlaps Leave; live roster/count and bare-device scale differ from the mockup. |
| `03-manage-player-host.png` | Online sheet opens and actions work; the sheet now has a visible grabber. | Reference uses a taller/larger target presentation and away-state artwork/copy; final away capture still needs a pass. |
| `04-pick-a-game-host.png` | Trivia key art, native header, matching art-colored footer, clean CTA, pager, and bottom action group render; selection follows TV. | Card/pager remain smaller than the board. Live registry has four entries (`1 / 4`) while the stale board says `2 / 3`; keep catalog truth. |
| `05-waiting-player.png` | Host avatar, native wordmark, green Now viewing panel, and controller-info card render. | Hero/card scale and debug gear differ from the reference. |
| `06-game-settings-host-standard.png` | Kit selected card now tints icon/label orange and shows an orange check; CTA is visible. | Live Trivia metadata is `2–10` and `All categories`; board is `2–12` and `General`. This is schema/catalog data, not a layout defect. |
| `07-game-settings-host-quick.png` | Mode switching remains functional and uses the same Kit selected treatment. | Final quick-mode screenshot should be recaptured after a clean app session. |
| `08-game-settings-host-custom.png` | Custom controls fit within rows; selected state and Start CTA are visible without the earlier clipping. | Board defaults (15/Hard/30/Movie) differ from installed schema defaults (10/Mixed/20/All); that is product data. |
| Category picker | Sheet opens, options select, and Done closes. | No standalone reference image; exact sheet spacing remains a lower-priority visual pass. |
| `09-game-finished-player.png` | Native wordmark and enlarged avatar/hero source are in place after a real game. | No approved botanical celebration asset exists in the repo; current token-native celebration remains a documented placeholder. Host crown/copy and final capture remain. |
| `10-game-finished-host.png` | Host finished source now uses larger hero/stat geometry, `Correct answers`, a trophy icon, clean orange primary action, a gamepad icon on Choose another game, and a refresh glyph on replay. | Final finished-state capture remains; the source-level action treatment is now in place. |

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
| `01-room.png` | TV build launches and the room state renders from the live room. | Title-safe inset and smaller title/wordmark/tiles/QR remain; ten seats and `of 10` are settled product decisions. |
| `02-game-carousel.png` | Carousel and real game art render when the phone browses; card footers now continue the supplied art surface, pagination uses round dots, and the browsing helper uses the Kit phone glyph without a card background. | Card geometry, live pager/catalog, and side-card treatment remain different from the board. |
| `03-game-setup.png` | Fresh setup capture uses the Trivia art, QR/code, live roster, and dynamic settings; the source now narrows the left rules column to keep it clear of the hero/QR column. | Reference is a larger fixed rules list/hero composition; live setup is intentionally data-driven and compact. |

### TV small-component checklist

- JUST JOINED is now a one-line 118pt-seat-safe chip.
- TV room’s title-safe stage scale remains a deliberate overscan/hardware
  exception and should not be removed without testing a real television.
- Existing Huddle Kit/native art assets are used for the wordmark, avatars,
  game key art, icons, and QR/code primitives; no replacement bitmap was
  invented for the missing celebration artwork.

## Remaining priority

1. Use a release build (without Expo Dev Launcher) for final pixel screenshots.
2. Capture the finished-host/player flows after a clean game session and compare the final state against the references.
3. Decide whether reference-only Trivia metadata should become the installed
   schema or remain catalog truth.
4. Finish the remaining TV card geometry and source approved celebration artwork
   if it becomes available.
