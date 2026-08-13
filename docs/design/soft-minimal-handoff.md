# Soft Minimal design handoff

This is Huddle’s sole current visual source of truth. Approved reference boards
remain visual inputs under [`reference/`](./reference/); superseded source
packages and earlier design systems are available only through Git history.

## Principles

- Warm, quiet canvases; white or room-toned surfaces; dark ink; tangerine as
  the primary action; semantic status colors only.
- Inter is the UI typeface. Supplied Huddle logo artwork is never recreated as
  text. Body floors are 12pt Phone and 16pt TV; controls use larger semantic
  roles appropriate to their surface.
- Rounded cards and controls use semantic radii, hairline/strong borders, and
  restrained shadows. Focus/press/selected/disabled/away/ready states must be
  perceivable without color alone.
- Motion explains state: short ease-out screen/card transitions, one spring for
  TV arrivals, and subtle loading activity. Reanimated/Worklets owns motion.
- NativeWind classes and `@huddle/design-tokens` own visual constants. Arbitrary
  class values and raw colors are prohibited. Calculated stage transforms,
  asset sizing, and other runtime geometry may use tokenized native objects.

## Canonical tokens

Runtime values live in `packages/design-tokens/src/`; the Tailwind projection is
`packages/design-tokens/tailwind-preset.cjs`. Those files, not values copied into
screens, are canonical. Key roles include canvas/screen, surface/room-surface,
ink/inverse/muted, border, accent, online/away/just-joined, and the dark setup
canvas family. Shared components consume them through `@huddle/ui`.

## Phone surfaces

- Join: logo, four code tiles, a clear “Scan the TV QR code” action, name field,
  10-avatar picker, and one primary Join action. Camera permission/error states
  are direct, accessible, and always preserve manual entry.
- Lobby: room/Host status, roster, away/Ready state, player management for the
  Host, and Leave behind confirmation.
- Picker/setup: carousel mirrors the TV. Trivia offers Questions 5/10; Voting
  offers Rounds 3/5. Finalizing replaces editing with locked summary, Ready
  progress, and an explicit Edit setup action.
- Ready: every player, including Host, has an explicit Ready control and visible
  state. Host Start becomes enabled only when all seats are Ready and present.
- Entered game: the module owns the central title/setting/started confirmation;
  the platform adds Host End and recovery framing only.

## TV surfaces

- A fixed 1280×720 title-safe stage scales inside the full-viewport supplied
  background. The decorative image reaches the viewport edges via Expo Image;
  content respects overscan.
- Room: Huddle wordmark, “Grab your phone,” room code, QR, 2×5 seats, Host and
  presence badges. The TV has no focusable room controls.
- Carousel/setup: the Host Phone drives selection. Setup mirrors mode/setting
  and Ready count; all TV content is display-only and Android TV focus remains
  empty.
- Entered game: module title, resolved setting, and started confirmation at TV
  scale. Away/recovery messaging never exposes private state.

## Assets

Runtime assets are inventoried in
[`../../packages/ui/assets/README.md`](../../packages/ui/assets/README.md).
Use Expo Image for bitmap rendering and `react-native-svg` only for the existing
code-native icon geometry. Design references under `docs/design/reference/`
must never enter production bundles.

## Accessibility and verification

Interactive Phone controls expose role, label, selected/disabled/busy state,
and at least a 44pt target. Dynamic failures/status use live regions. Android TV
must have no accidental focusable surface. Verify via lint, rendered component
tests, release exports/builds, screenshot comparison when visuals change, and a
physical Android TV focus pass.
