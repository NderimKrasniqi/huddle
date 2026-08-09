# Pixel parity: simulator vs approved boards

Every delta found by comparing a real simulator screenshot against the approved
Soft Minimal reference for the same screen. The goal is pixel parity, so this
records **measured** differences, not impressions.

Captured 2026-08-09 from `feat/huddle-reliability-refactor` on the Apple TV 4K
(3rd gen, tvOS 26.5) and iPhone 17 (iOS 26.5) simulators.

## Settled decisions

**Maximum players is 10** (decided 2026-08-09). The app is already right and the
board is wrong wherever the two disagree about capacity, so these are **not**
parity work:

- **TV seats stay 2 × 5 = 10.** Do not adopt the board's 2 × 6 = 12, and leave the
  count line reading "of 10".
- **Trivia's range stays 2–10.** The board's "2–12 players" is superseded.
- **The phone's 10 avatars stay.** The board offers 8, which is under-specified
  rather than a target: with ten seats, eight choices means two players collide.

Both remaining board-vs-app disagreements about capacity are therefore closed.
What is still open on the board's side is Trivia's **duration** (board 15 min vs
app ~5 min) and its **category** (board "Quiz" vs app "Knowledge") — those are not
capacity and still need a call.

## Method

- References live in `docs/design/reference/screens/`. The TV board is
  **1672×941**; the TV renders **3840×2160**. Both are ~16:9, so the app
  screenshot is resampled to 1672×941 and every number below is in **board
  pixels**. Multiply by **1.148** for the TV's 1920-wide logical space.
- The TV's design space is `tvDesignSize` = **1280×720** (`packages/ui/src/layout.ts`),
  so board numbers convert to code units by dividing by **1672/1280 = 1.30625**.
- Element boxes were found by thresholding ink against the background field and
  segmenting horizontal bands, restricted to the central 17–83% so the edge
  plants never contaminate a text band.
- The phone reference is a **device mockup** (phone in a bezel, with a caption),
  not a bare screen, so phone deltas are qualitative unless stated otherwise.

## TV — Room / pairing screen

Reference: `docs/design/reference/screens/01-room.png`

### Measured sizing (board px)

| Element | Board | App | Delta |
| --- | --- | --- | --- |
| Code tile | 130 × 129 (square) | 120 × 100 | **+10 w, +29 h** — the app's tile is not square |
| Tile gap | 33–34 | 30 | +4 |
| QR tile | 152 × 144 | 137 × 128 | +15 w, +16 h |
| Gap, last tile → QR | 35 | **59** | −24; the QR floats too far right |
| Title "Grab your phone!" | 465 × 59 | 393 × 45 | font ~**20% too small** |
| Count line | h 33 | h 26 | ~20% too small |
| Wordmark | 242 × 57 | ~205 wide | ~15% too small |
| Title → tiles gap | 36 | 53 | −17 |

In code units (÷1.30625) the code tile should be ~**99 × 99**; it currently
renders ~**92 × 77**.

### Structural

1. ~~**Seat count: board 12, app 10.**~~ **Settled: 10 is correct**, the app already
   matches, the board does not. See *Settled decisions* above. No work.
2. **Divider rules beside "PLAYERS IN THE ROOM" are far too faint.** The board's
   1028px-wide rules register as ink at a threshold that finds nothing in the
   app. Label widths already match (264 vs 253) — only the rules differ.
3. **QR quiet zone too large.** The app's QR glyph sits inside a thick white
   margin, so its modules are smaller than the board's, which nearly fills its
   tile. This also hurts scanning distance from a sofa.
4. **Background artwork is ~11% larger relative to the content than the board's.**
   Not the wrong file — `huddle-tv-background-01.png` is correct and is exactly
   the board's 1672×941 artwork. The cause is in `apps/tv/src/tv-stage.tsx`: the
   `ImageBackground` fills the viewport at 100% while the content stage is scaled
   by `tvSafeStageScale` = fit × **0.9**. The board composes both at one scale;
   the app composes them at two, so the plants read as magnified. 1/0.9 = 1.111.
   **Recommended fix:** re-export the background with its artwork scaled to 90%
   and the warm field extended to the edges. That keeps the artwork full-bleed
   (which `tv-stage.tsx` argues for deliberately) *and* restores the board's
   relative geometry, without moving content into the overscan region.

### Do NOT "fix" these

- **The board is itself off-centre.** Board elements centre on x ≈ 845–852; the
  frame centre is 836, which is exactly where the app centres. The app is
  correct and the *board* is ~12px right of centre — an export artifact. Pixel
  parity taken literally would replicate the skew.
- **The outer margins are the overscan fix.** Board top margin 4.7% vs app 9.1%
  (bottom 7.1% vs 10.7%). That inset is `tvTitleSafeFraction` = 0.9, the PR #23
  title-safe fix: a television crops ~5% of every edge without reporting it.
  Matching the board's margins exactly would push the wordmark and count line
  back under the bezel on real hardware. A simulator cannot show this; the
  Philips TV can. Treat the **interior** as pixel-perfect and the outer safe-area
  inset as a deliberate, documented exception.

### Stale comment found while measuring

`apps/tv/src/tv-stage.tsx` claims "a 148×176 code tile is 148×176 here". It
cannot be: the stage is 1280×720 while the board is 1672×941, and the rendered
tile is ~92×77 code units. Either the comment or the tile is wrong.

### With a real roster (one player, host)

Re-checked after the TV was fixed and a real player joined:

1. **The host crown is present.** Earlier notes claiming the app draws a bare
   orange `HOST` with no crown are **out of date** — the app draws the gold
   crown above the disc, as the board does, with orange `HOST` beneath.
2. **`HOST` sits tight under row 2.** Board leaves ~52 board-px between the row-1
   status line and the row-2 circles; the app leaves ~30. Not overlapping, but
   visibly crowded, and it will get worse when a second row fills.
3. **Subtitle colour is wrong.** Board draws "Open **Huddle** on your phone and
   enter the code" in dark navy; the app draws it in grey with only the bold
   "Huddle" dark. Clearest single colour delta in the set.
4. **Avatar discs and empty-seat circles are proportionally smaller** than the
   board's — a consequence of the 0.9 title-safe scale, not separate sizing bugs.

Still unverified, needing more players: the **AWAY chip** colour (board draws a
pale-blue pill) and the **green presence dots** under non-host players.

## TV — Game carousel

Reference: `docs/design/reference/screens/02-game-carousel.png`

**The biggest parity gap in the whole set, and a known deferral rather than a
bug.** The board draws three illustrated cards; the app draws flat colour blocks
with a title. `packages/ui/assets/game-art/` already holds `trivia.png`,
`drawing.png` and `word-game.png` — the board's own renders — and nothing draws
them. Both `packages/game-core/src/key-art.ts` ("this mechanism is on its way
out… the fallback a module with no art gets") and the Controller's `GameCard`
comment record the decision: wiring `game-art/` needs a `GameMetadata` change and
was put out of scope so the phone and TV "stay in step at the treatment they both
currently have". Closing this is the parity work.

Note the art covers a **drawing** game and a **word** game that do not exist as
modules, while **Hot Takes** — which does — has no art. Wiring what exists buys
Trivia only.

The rest, independent of the art:

1. **Chips sit in the wrong place and lose their icons.** Board: chips overlay the
   foot of the artwork, each with an icon (people, clock, tag). App: chips sit in
   a **white footer panel below** the card, with no icons.
2. **Trivia's metadata disagrees with the board in two remaining facts** — duration
   (board 15 min vs app ~5 min) and category (board "Quiz" vs app "Knowledge").
   The player range is settled at 2–10; the app is already right there.
3. **No carousel chevrons.** The board draws ‹ › buttons flanking the cards; the
   app draws none (the phone is the only control).
4. **Pagination indicator differs**: board is five grey dots with the active one
   filled; the app is an orange pill plus one grey dot.
5. **The "browsing" footer loses its phone glyph** and renders in grey/blue where
   the board's is dark.

## Phone — Pick a game (host)

Reference: `docs/design/reference/screens/04-pick-a-game-host.png`

Shares the flat-card gap above. Also observed live: **"Trivia needs one more
player."** with `Select Trivia` disabled at one player — correct behaviour for a
2–10 player game, and the reason a full game could not be played in this pass.

## Phone — Join the room

Reference: `docs/design/reference/screens/01-join-room.png`

1. **Title alignment differs.** The board left-aligns "Join the room" with the
   field labels; the app **centres** it.
2. **Field labels are wrong in three ways.** Board: small all-caps in dark navy
   with tight tracking. App: larger, **blue-grey**, and noticeably
   letter-spaced. Applies to ROOM CODE, YOUR NAME, PICK YOUR AVATAR.
3. **Code tiles invent an empty state the board does not have.** The board draws
   four identical light tiles with a hairline border. The app draws a heavy dark
   focus ring on the active tile and **dashed** borders on the rest.
4. **Name field:** board is a hairline-bordered rounded rect with the name in
   dark text; the app's border is heavier, the field taller, and the remembered
   name renders as **grey placeholder** rather than a value.
5. **Avatar count stays 10** (board shows 8 — see *Settled decisions*). What is
   still worth fixing is the **grid**: the app's trailing row of two breaks the
   board's even 4-per-row rhythm. Ten avatars want a 5 × 2 grid, not 4 + 4 + 2.
6. **Join button enabled colour** needs checking against the board's solid orange
   — at capture the app's was in its pale disabled state.

## Phone — Your room (host)

Reference: `docs/design/reference/screens/02-your-room-host-reference-crop.png`

1. **A large empty region above the content.** The screen's content
   (wordmark, Leave, title, roster, CTA) starts roughly 60% of the way down;
   the top ~55% is blank canvas. This is the most visible phone delta.
2. The host crown **is** present here as a glyph after `HOST`, unlike the TV.

## Screenshots

`docs/design/qa/side-by-side/` holds board-and-simulator composites at matched
height — `tv-room.png`, `phone-join.png`, `phone-current.png`. The two halves of
each are kept unscaled beside them as `<screen>-board.png` and
`<screen>-simulator.png`, so any delta here can be re-measured rather than
re-eyeballed. `tv-room-stacked-empty-room.png` is the original empty-room
comparison the measurements in this file were taken from.

## Fixed during this pass — the TV could not open a room

Symptom: "Can't reach Huddle — reconnecting…", empty code tiles, empty QR, and
**zero rooms ever created**. It was never the deployment: the phone joined the
same deployment end-to-end in the same session, and `rooms:createRoom` works
from the CLI.

Cause: `apps/tv/src/tv-session.ts` reached its keystore and UUID source through
dynamic `await import('expo-secure-store')` / `await import('expo-crypto')`. A
dynamic import compiles to a lazily loaded split bundle, and when one arrives
Metro calls `HMRClient.registerBundle()`, which opens with `assertHMRClient()`.
tvOS never sets the HMR client up, so that assert threw
`Expected HMRClient.setup() call at startup.` out of `ensureTvSessionToken` — the
first thing `openRoom` awaits. Every attempt therefore failed before reaching
the network, and `openRoom`'s catch reported any throw as an unreachable backend.

Fix: `tv-session.ts` is now pure and imports nothing native; the Keychain store
and UUID source moved to `apps/tv/src/tv-session-native.ts` with **static**
imports, and `room.ts` passes them in. Static imports directly in `tv-session.ts`
were tried first and broke its unit test — `expo-crypto` pulls in
`expo-modules-core`, which reads `__DEV__` at import time under Node. Keeping the
native pair in a module no test imports is the only arrangement that serves both.

Two things worth fixing separately, both surfaced by this bug:

- **`openRoom` misclassifies every throw as "can't reach Huddle".** A client-side
  crash was reported for 20 minutes as a network problem, which is what made this
  expensive to find. A thrown programming error and an unreachable backend
  deserve different copy.
- **`tvSafeStageScale`/`tvDesignSize` vs the board scale** is recorded above; the
  stale "148×176 code tile" comment in `tv-stage.tsx` is still wrong.
