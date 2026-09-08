# Huddle product scope

## Product promise

Huddle is a native local-multiplayer party-game platform for a living room.
The TV is the shared stage and every player uses the Huddle Phone app as a
personal controller. Huddle owns the room lifecycle before, between, and after
games; each installed game owns its own rules, art, controls, privacy model,
and results.

The split is intentional:

```text
Huddle platform: splash → join → lobby → game picker → setup → ready → handoff → return
Game module:     intro → private input on Phones → shared presentation on TV → reveal → finish
```

There is no web client, account requirement, or Invite Friend feature. A TV
creates one room, and phones join without an account using the four-character
room code or the TV's native QR code.

## Current runtime status

The platform/game behavior and Phone-controller / TV-stage lifecycle are
implemented. The shared runtime uses the Heartbeat palette and Nunito and has
completed its screen-by-screen React Native fidelity pass against the direction
board and approved screen set under `docs/design/heartbeat/reference/`.
Checked-in runtime artwork is implementation material, not source-master design
material.

The catalog has exactly five ordered cards:

1. Trivia — playable.
2. Voting — playable.
3. Doodle Dash — Coming soon, presentation-only.
4. Quick Poll — Coming soon, presentation-only.
5. Hot Take — Coming soon, presentation-only.

Only Trivia and Voting can be selected, configured, started, or returned to.
The other three cards are synchronized across Phone and TV but have no server
authority or game screens.

## Rooms, joining, and identity

- The TV creates or restores one durable room and presents its authoritative
  four-character code, native QR code, and live ten-seat roster.
- The Phone root route restores a valid session or shows the Heartbeat room-code
  entry. A complete code checks `joinAvailability`; missing and full rooms stay
  inline and cannot advance.
- `/scan` is a modal camera route. It requests permission, accepts only a valid
  Huddle QR payload, and replaces to `/join/[code]`. Malformed, duplicate,
  denied, and unavailable-camera states keep manual entry available.
- `/join/[code]` is the dedicated **Pick your vibe** identity route. It loads
  the remembered GuestProfileV1, disables claimed avatars, validates the
  display name, performs authoritative `joinRoom`, persists the profile and
  session credential, updates the session provider, and replaces to `/`.
- Joining requires a display name and one of the ten stable avatar IDs. A room
  holds at most ten seats. Availability is advisory; Convex remains the
  authority for races and rejection messages.
- A phone session credential is the only authority for an existing seat.
  `guestId` is continuity metadata, not authentication.

## Host, presence, and recovery

The first seated player is Host; the TV is never Host. Host-only actions are
selecting a game, editing and locking setup, starting/ending, transferring
Host, removing players, and returning the room to the lobby.

- Transfer Host targets another present player and preserves everyone else's
  Ready state.
- Remove-player and transfer actions use a Phone confirmation surface and
  retain the existing authoritative rejection messages.
- Away and Ready are separate roster states. Away players retain Ready but
  block a new start until the selected game's presence/range gate is valid.
- A leaving or removed seat loses its current membership credential; it may
  join again as a new seat while the room remains available.
- A running game pauses when the TV or a player disconnects. The Host can wait,
  continue when the rules permit, or go Back to lobby.
- Seat loss, room expiry, unavailable game, paused game, and device failure
  each have a branded recovery/status surface. No client invents authority.

## Platform setup and handoff

The Host browses the synchronized five-card catalog from the Phone. The TV
mirrors the registry index, card art, and Coming soon status without controls.
For Trivia or Voting, the Host chooses Quick, Standard, or Custom. The module
declares the schema and presets; the platform renders the controls, validation,
busy state, and locked state without inventing game settings.

Trivia settings are Questions (5/10/15/20), Difficulty
(Easy/Medium/Hard/Mixed), Time per question (10/15/20/30 seconds), Category
(All plus the curated categories), and Scoring (Flat/Speed). Voting settings
are Rounds (3/5/7), Time to vote (15/30/45 seconds or No timer), Results
(Reveal together/Live tally), and Voter labels (Hidden/Shown after reveal).

Ready is individual and native on every Phone. Start is Host-only and enabled
only when setup is locked, the selected module's player range is satisfied,
all current seats are present, and every current seat is Ready. Pressing Start
is the platform/game boundary: the final platform screen is locked ready setup,
then the module's own Phone controller and TV stage take over.

## Living-room privacy contract

The TV shows only information the whole room should see: shared prompts,
participation counts, timers, neutral waiting guidance, aggregate tallies,
reveals, and shared recap/standings. It never receives Phone controls or focus.

Each Phone shows only its owner's private interaction: answer/vote choices,
the owner's locked state, busy/error feedback, and eyes-up guidance. A Phone
does not receive another player's raw choice, timing, future prompt, hidden
answer key, or private result before the module's reveal boundary.

## Module loops

### Trivia

Trivia is a complete question loop: intro → question and private answer on the
Phone → locked/waiting state → TV reveal and standings → next question → final
standings. Flat and speed scoring are module-owned. The TV receives the current
prompt and normalized verdicts only at reveal; Phones receive no correctness or
other-player answer mapping before reveal. The Host can finish with Back to
lobby.

### Voting

Voting is a non-scored opinion loop: intro → private Phone choice → locked
waiting or live aggregate tally → TV reveal → next round → room-vibe recap.
There is no winner, score, rank, or leaderboard. Voter labels, when enabled,
appear only after reveal and are grouped by choice. The finished TV recap
describes strongest agreement, closest call, and wildcard; the Phone receives
no private mapping or recap data. The Host can finish with Back to lobby.

## Supported platforms and non-goals

- Supported: iOS Phone, Android Phone, and Android TV.
- Experimental: tvOS compile/simulator evidence only.
- Out of scope: web clients, accounts, store submission, production release
  tooling, Invite Friend, sound/settings that are not backed by authority, and
  playable Doodle Dash, Quick Poll, or Hot Take.
- Existing Convex schema, room lifecycle, session tokens, stable avatar IDs,
  and module client/server separation remain compatible. Legacy persisted
  entered-state records are decoded safely and do not get silently reinterpreted.

## Remaining acceptance work

The behavioral implementation, screen-by-screen fidelity pass, representative
Phone/TV simulator captures, Android TV remote/focus verification, and focused
render/contract/integration checks are complete. Remaining acceptance work is
physical-device evidence: real camera permission and QR join, mixed-phone
lifecycle and reconnect/seat-loss traversal, and the final mixed Phone + Android
TV living-room party check.
