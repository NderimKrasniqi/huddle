# Huddle visual handoff

The filename is retained for documentation compatibility. This document is the
current visual source of truth for the clean-slate Phone, TV, and game-module
baseline plus two incremental exceptions: the illustrated Phone Join Room and
TV Room Invitation screens. Product behavior remains in
[`../project-scope.md`](../project-scope.md), and the shared renderer contract is
implemented in `packages/ui/src/native`.

## Principles

- Default to a white background (`#FFFFFF`), black text (`#000000`), and one
  purpose label centered horizontally and vertically in the native viewport.
- Use the platform system font with 24pt Phone text and 48pt TV text on the
  clean-slate baseline.
- Baseline screens render exactly one accessible text label with no controls,
  inputs, images, progress indicators, overlays, dialogs, cards, sheets,
  banners, animation, focus targets, or style overrides.
- Only the two illustrated renderers described below may use supplied artwork.
  Phone Join Room owns code input, buttons, and joining state; TV Room
  Invitation remains display-only.
- Keep state resolution and subscriptions in their existing coordinators; the
  visual layer must not own room, session, presence, or game authority.

## Shared renderer

`PurposeScreen({ platform, purpose })` from `@huddle/ui/native` is the only
shared renderer. `platform` is `phone | tv`; `purpose` is a string. The
component accepts no children and no style override. `@huddle/design-tokens`
exports only `background` and `text` values.

## Illustrated Phone Join Room screen

`apps/phone/src/features/join/join-room-screen.tsx` is app-owned and is the only
interactive/artwork exception to the clean-slate baseline. It uses system fonts
and ordinary React Native primitives; it does not expand the shared UI API or
the two-value shared token package.

### Visual contract

- Fill the viewport with `join-room-background.png` using `ImageBackground`
  cover behavior over a `#FFF8F1` fallback.
- Center content in a column capped at 480 points with 24-point horizontal
  padding. Respect all safe-area edges, avoid the keyboard, and scroll when the
  available height is compact.
- Show the supplied 74×74 Huddle brand icon, `Join a game!`, and the two-line
  instruction `Enter the 4-letter code` / `on the TV.`
- Show four 66×78 rounded code boxes. The next empty cell uses the coral focus
  border; filled cells use uppercase navy letters. A single visually hidden,
  controlled input owns the whole four-letter value.
- Show a 60-point coral `Join Room` pill, an `or` divider, and a 58-point
  translucent `Scan QR Code` pill with the supplied QR icon. Incomplete and busy
  Join states are disabled; the busy state replaces the label with a white
  activity indicator.
- Use a translucent dark-content status bar. Do not render `Don't have a code?`
  or `How it works` in this slice.

| Role | Value |
| --- | --- |
| canvas | `#FFF8F1` |
| primary text and code letters | `#293354` |
| heading | `#202538` |
| muted text | `#657080` |
| coral action/focus | `#FF765D` |
| border | `#E5DDD4` |
| secondary pressed surface | `#F7EFE6` |
| disabled action | `#D9D4CE` |

### Interaction and ownership

The public renderer interface is `initialCode?`, `isJoining?`, `onJoinRoom?`,
and required `onScanQr`. Both typed and deep-linked input pass through the
existing `codeEntry` and `activeCodeCell` rules: keep at most four A–Z letters,
uppercase them, and discard other characters. A complete code enables the Join
button and is passed unchanged to an optional callback. The current `JoinForm`
adapter seeds `initialCode` from `linkedCode`, pushes `/scan` for QR, and does
not provide a join callback. It preserves its lifecycle-compatible props for a
later membership slice but does not collect identity, create a seat, persist a
session, or present join/seat-loss failures now.

The code row is one accessible button labeled with the entered letters and a
hint that it opens the keyboard. Join exposes disabled and busy accessibility
state; QR exposes the `Scan QR Code` button label. The hidden input and the QR
icon do not duplicate those spoken controls.

## Illustrated TV Room Invitation screen

`apps/tv/src/features/room/room-invitation-screen.tsx` is app-owned and is the
only illustrated TV exception. It uses the supplied living-room artwork, system
fonts, ordinary React Native primitives, and a generated SVG QR. It does not
expand the shared UI or token packages.

### Visual contract

- Author the composition on a fixed 1280×720 stage. Scale the complete stage
  uniformly by `min(viewport width / 1280, viewport height / 720)`, center it,
  clip overflow, and show black letterboxing when the viewport aspect differs.
- Fill the stage with `tv-lobby-background.png` using cover behavior. Keep all
  authored foreground content inside the 64-point title-safe inset.
- Center the code column independently from the floating QR panel. Show `Room
  Code`, one 390×121 rounded dashed code panel with the four authoritative
  letters spaced apart, then `Waiting for players to join...`.
- Place a 132×132 warm QR card to the right with a 106-point generated QR, soft
  brown shadow, supplied phone icon, and the two-line instruction `Scan to join
  on` / `your phone`.
- Render a fixed 5×2 grid of ten 60-point positions. Empty positions are dashed
  circles. Joined positions retain roster order and show a coral initial circle
  plus the nickname; an optional future image source replaces the initial.
- Use the system font in heavy weights: 28/34 for `Room Code`, 64/72 for the
  code, 26/32 for waiting copy, 15/19 for scan copy, and 14/17 for names.

| Role | Value |
| --- | --- |
| viewport letterbox | `#000000` |
| primary text, code, and QR | `#082B68` |
| dashed code/seat border | `#8797B6` |
| QR surface | `#FFF9F2` |
| initial circle | `#FF765D` |
| initial text | `#FFFFFF` |

### Data, accessibility, and ownership

The public renderer interface is required `roomCode` and `joinUrl`, plus
optional ordered `players?: readonly { id; name; avatar? }[]`. It renders ten
empty positions by default and safely ignores entries beyond capacity. The
`AB7K` visible in the supplied reference is illustrative only; the running
screen receives Huddle's existing four-letter A–Z room code and the canonical
`huddle://join/CODE` value generated by `RoomStage`.

`RoomStage` is the state-facing adapter. It caps the live `RosterSeat[]` with
`ROOM_PLAYER_CAP`, maps only server IDs and nicknames, and creates the join URL.
`TvSessionController` retains the roster subscription and selects the
illustrated stage only for the resolved room surface. Other TV surfaces remain
on their purpose labels.

The code panel, QR, joined positions, and every empty position have spoken
labels. All accessible containers explicitly remain non-focusable. There are no
buttons, inputs, Pressables, touchables, links, or D-pad actions.

## Purpose labels

### Phone

| Resolved state | Label |
|---|---|
| startup | `Starting Huddle` |
| session restoration | `Restoring your room` |
| join route | illustrated screen above (`Join a game!`) |
| scan route | `Scan a room code` |
| lobby | `Room lobby` |
| non-Host waiting | `Waiting for the Host` |
| catalog | `Choose a game` |
| selected setup | `Game setup` |
| paused runtime | `Game paused` |
| unavailable runtime | `Game unavailable` |
| finished runtime | `Game finished` |
| Trivia module | `Trivia game` |
| Voting module | `Voting game` |

### TV

| Resolved state | Label |
|---|---|
| startup | `Starting Huddle` |
| room creation | `Creating a room` |
| room restoration | `Reconnecting to room` |
| setup/device failure | `TV setup required` or `TV unavailable` |
| room | illustrated screen above (`Room Code`) |
| catalog | `Choose a game` |
| selected setup | `Game setup` |
| paused runtime | `Game paused` |
| unavailable runtime | `Game unavailable` |
| finished runtime | `Game finished` |
| Trivia module | `Trivia game` |
| Voting module | `Voting game` |

## Asset policy

Shared bitmaps remain limited to the neutral launcher icons, adaptive and
monochrome foregrounds, splash placeholder, and 640×360 Android TV banner
listed in
[`../../packages/ui/assets/README.md`](../../packages/ui/assets/README.md).
They are technical packaging resources, not runtime screen content.

The Join Room renderer consumes exactly these Phone-specific supplied files,
unchanged, under `apps/phone/assets/join-room`:

| Asset | Dimensions | Runtime use |
| --- | ---: | --- |
| `huddle-brand-icon.png` | 1254×1254 | Huddle mark |
| `join-room-background.png` | 941×1672 | Full-screen illustrated background |
| `qr-code-icon.png` | 1254×1254 | Scan button icon |

The Room Invitation renderer owns this exact TV-specific set under
`apps/tv/assets/room-invitation`:

| Asset | Dimensions | Runtime use |
| --- | ---: | --- |
| `tv-lobby-background.png` | 1672×941 | Responsive living-room background |
| `tv-lobby-phone-icon.png` | 1254×1254 | Scan instruction icon |
| `tv-lobby-empty.png` | 1672×941 | Unbundled visual reference only |

No other product artwork is active. The former redesign importer and its shared
artwork directories remain deleted; Git history is the only archive.

Expo Camera configuration remains on the Phone app for platform readiness, but
the clean-slate scan route does not mount a camera. The same rule applies to
all other feature-specific visual capabilities outside Join Room: retain
state/contracts where needed and render only the purpose label.

## Verification

Join Room render tests cover supplied copy/artwork, four code cells,
normalization and deep-link prefill, incomplete/complete/busy action states,
callback payloads, QR navigation, accessibility metadata, and absence of help
copy. TV Room render tests cover its supplied runtime assets and copy, spaced
authoritative code, dynamic QR value, ten-position grid, roster order,
initial/name/avatar projections, capacity, accessible labels, and absence of
controls. Baseline render tests continue to assert one text node and zero
controls, inputs, images, and progress indicators. Mapping tests cover every
remaining Phone and TV purpose above, including boot failures,
paused/unavailable/finished runtime states, and both game modules. Architecture
validation limits artwork primitives to the exact two renderers, scopes QR/SVG
to TV Room, checks both supplied three-PNG sets by hashes/dimensions, rejects
runtime imports of the reference composite, and keeps package dependencies, app
configuration, shared assets, and retired presentation paths constrained.
