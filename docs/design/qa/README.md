# Simulator QA screenshots

Historical simulator captures paired with the approved Soft Minimal board for
the same screen. The findings drawn from them live in `../pixel-parity.md`;
`../soft-minimal-handoff.md` is the current visual source of truth.

Captured 2026-08-09 from `feat/huddle-reliability-refactor` — Apple TV 4K
(3rd gen, tvOS 26.5) and iPhone 17 (iOS 26.5).

| File | What it is |
| --- | --- |
| `side-by-side/tv-room.png` | TV Room: board left, simulator right, matched height |
| `side-by-side/tv-game-carousel.png` | TV game carousel — the flat-card gap is clearest here |
| `side-by-side/phone-join.png` | Phone Join the room, same arrangement |
| `side-by-side/phone-your-room.png` | Phone Your room, host, seated in a live room |
| `side-by-side/phone-pick-a-game.png` | Phone Pick a game, host, with settings |

Two things to know before comparing:

- The TV board is **1672×941** and the TV renders **3840×2160**. Measurements in
  `../pixel-parity.md` resample the capture to the board's size and are quoted in
  **board pixels**; multiply by 1.148 for the TV's 1920-wide logical space, or
  divide board numbers by 1.30625 for `tvDesignSize` (1280×720) code units.
- The phone reference is a **device mockup** with a bezel and caption, not a bare
  screen, so phone comparisons are qualitative unless a number is given.

Re-capture rather than trusting these once the code moves — `simctl io <udid>
screenshot` is the only way to capture tvOS (the Simulator MCP cannot: an Apple TV
presents its display as `TVOut`, so MCP screenshots fail with "Could not find the
Main Screen Surface").
