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
How to play screen, then each bomb runs brief → debate → reveal. Every phone
holds one private clue; the room argues out loud and votes on a wire. The
most-voted wire is cut, and a tie blows up. Defused pays honest players +100;
a blast pays each saboteur +150 unless they voted for the safe wire. The TV
never sees a clue, role or vote before the reveal. The Host can finish with
Back to lobby, and everyone can leave from the final screen.

## Supported platforms and non-goals

- Supported: iOS Phone, Android Phone, and Android TV.
- Experimental: tvOS compile/simulator evidence only.
- Out of scope: web clients, accounts, store submission, production release
  tooling, Invite Friend, sound/settings that are not backed by authority.
- Existing Convex schema, room lifecycle, session tokens, stable avatar IDs,
  and module client/server separation remain compatible.

## Remaining acceptance work

The behavioral implementation, screen-by-screen fidelity pass, representative
Phone/TV simulator captures, Android TV remote/focus verification, and focused
render/contract/integration checks are complete. Remaining acceptance work is
physical-device evidence: real camera permission and QR join, mixed-phone
lifecycle and reconnect/seat-loss traversal, and the final mixed Phone + Android
TV living-room party check.
