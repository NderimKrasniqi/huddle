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
implemented. Platform screens follow the Playroom design in
[`design/playroom/README.md`](design/playroom/README.md): a cream canvas,
deep-purple ink, orange actions, Nunito, and clay avatars, props, and game art.
Checked-in runtime artwork is implementation material, not source-master design
material. Each game module keeps its own look once play begins.

The shelf holds the installed games, in order:

1. Trivia.
2. Bomb Squad.

The Host browses the shelf from the Phone; the TV mirrors the registry index
and card art without controls. The Host chooses Quick, Standard, or Custom. The module
declares the schema and presets; the platform renders the controls, validation,
busy state, and locked state without inventing game settings.

Trivia settings are Questions (5/10/15/20), Difficulty
(Easy/Medium/Hard/Mixed), Time per question (10/15/20/30 seconds), Category
(All plus the curated categories), and Scoring (Flat/Speed). Bomb Squad
settings are Bombs (3/5/7) and Time to argue (30/45/60 seconds).

Ready is individual on every Phone: each player raises a hand, and the TV
lifts that player's avatar and fills one segment of the ready bar. Locking
setup marks the Host ready. Start is Host-only and enabled only when setup is
locked, the selected module's player range is satisfied, all current seats are
present, and every current seat is Ready.

Pressing Start begins a five-second server-driven countdown on the TV and every
Phone; each Phone ticks with a haptic and a flash of its player's colour. The
countdown stops and returns to the ready check if anyone un-readies, joins,
leaves, is removed, or goes away, if the TV goes away, or if the Host stops it.
When it ends, the server starts the game: the module's own Phone controller
and TV stage take over.

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

### Bomb Squad

A hidden-role game for 3–10 players: one wire on the bomb is safe, and one or
two saboteurs (two from 7 players) hold false clues. Each game opens with a
How to play screen (an animated demo on the TV) that starts once every phone
taps Got it, the Host starts, or 45 seconds pass; then each bomb runs brief → debate → cut → accuse →
reveal. Every phone holds one private clue; the room argues out loud and votes
on a wire. The most-voted wire is cut; a tie cuts one of the tied wires in an
order drawn from the game's seed. At the cut the TV shows the result and every
vote, then each player names who they think lied. Defused pays honest players
+100; a blast pays each saboteur +150 unless they voted for the safe wire.
Naming a saboteur pays an honest player +50, and a saboteur most of the room
missed scores +50. The TV never sees a clue or role before the reveal, nor a
vote before the cut. The Host can finish with
Back to lobby, and everyone can leave from the final screen.

## Supported platforms and non-goals

- Supported: iOS Phone, Android Phone, Android TV, and Apple TV (tvOS). Apple
  TV is supported by owner decision on simulator evidence; a physical Apple TV
  check is still open.
- Out of scope: web clients, accounts, store submission, production release
  tooling, Invite Friend, sound/settings that are not backed by authority.
- Room lifecycle, session tokens, stable avatar IDs, and the game module seam
  remain compatible. The Convex schema no longer has to: Convex is retired
  once the TV hosts the room.
- Samsung and LG TVs are not built yet, but the design must keep them
  possible.

## Rooms hosted by the TV (approved, being built)

The owner approved these behaviors with ADR-01 to ADR-04 in
[`architecture.md`](architecture.md#architecture-decisions). They apply once
the TV hosts the room; until then rooms run on Convex as described above.
The phone screens for items 2, 3 and 5 exist and appear when the apps are
bundled with `EXPO_PUBLIC_ROOM_BACKEND=lan`.

1. A phone joins only on the same Wi-Fi network as the TV, until the relay
   ships.
2. On the first join, an iPhone asks for Local Network access. If the player
   denies it, the phone explains why it needs it and links to Settings.
3. When the network blocks traffic between devices, the phone shows "Can't
   reach the TV" with short guidance.
4. The room lives in the TV app. If the TV app restarts, it restores the room
   from its last snapshot for as long as a silent room lasts today (ten
   minutes).
5. When the phone and the TV speak different protocol versions, the phone
   shows "Update Huddle".
6. A typed room code works on the same Wi-Fi network through local discovery.

## Remaining acceptance work

The behavioral implementation, screen-by-screen fidelity pass, representative
Phone/TV simulator captures, Android TV remote/focus verification, and focused
render/contract/integration checks are complete. Remaining acceptance work is
physical-device evidence: real camera permission and QR join, mixed-phone
lifecycle and reconnect/seat-loss traversal, and the final mixed Phone + Android
TV living-room party check.
