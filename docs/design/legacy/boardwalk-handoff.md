# Handoff: Huddle — TV Lobby & Pairing Flow ("Boardwalk" design system)

> **SUPERSEDED by `soft-minimal-handoff.md`.** Soft Minimal is the approved
> visual system; Boardwalk is no longer the design target.
>
> This file stays until the token swap lands, for one reason: the code still
> implements Boardwalk, and roughly 200 comments across the screens cite this
> document's `§` numbers to explain why they draw what they draw. Deleting it
> now would orphan every one of them. It goes when the last `§` reference does.

> Source: claude.ai/design project "Mobile TV game controller system"
> (projectId `3efdf6e5-f6d0-4c0b-823e-f2633c986e58`). The full high-fidelity
> mock is `Boardwalk Flow.dc.html` in that project — fetch via DesignSync when
> pixel-level reference is needed. `TV Pairing Flow.dc.html` contains rejected
> explorations; reference only.
>
> Adjustments agreed during planning (this file's spec is otherwise final):
> - The referenced repo `NderimKrasniqi/mini-games` and its `joinLobby`/lobby
>   doc are IGNORED — Huddle is a fresh codebase; see docs/tech-stack.md.
> - TV copy must not reference `huddle.tv` in MVP (no web join). Use "open
>   Huddle on your phone" phrasing; QR deep-links into the controller app.
> - Design shows 4 color swatches; the palette must grow to 10 distinct player
>   colors (player cap is 10).
> - Trivia gameplay screens are not designed yet — extend the Boardwalk system.

## Fidelity
**High-fidelity.** Colors, typography, spacing, and copy are final intent.
Recreate pixel-perfectly with the codebase's existing libraries.

## Design Tokens

### Colors
- Canvas / page background: `#EDE5D4` (outer), TV screen background: `#F7F1E6`
- Surface (cards, tiles, inputs): `#FFFFFF`
- Ink (borders, text, shadows): `#1B1B18`
- Muted text: `#6E6653`; muted/dashed borders: `#C9BFAC`
- Cobalt (primary action, code letters): `#2B4BF2`
- Tangerine (brand accent, host avatar): `#FF7A1A`
- Punch pink (join/new highlights): `#E23D6D`
- Green (online status, avatars): `#17A34A`
- Yellow chip accent: `#FFD84D`

### Typography
- Display: **Bungee** (Google Fonts) — logo, headings, code letters. All-caps.
- Body/UI: **Space Grotesk** 400–700
- TV minimums: body text ≥ 18px at 1280×720 design size (scale up for 1080p);
  phone body ≥ 14px

### Signature style rules (what makes it "Boardwalk")
- **Hard offset shadows, never blurred**: `box-shadow: Npx Npx 0 #1B1B18`
  (3–4px phone elements, 4–6px TV cards, 10px TV hero card). Highlight
  variants use the accent color as shadow (e.g. `8px 8px 0 #E23D6D` on
  "just joined" card, `10px 10px 0 #2B4BF2` on the focused carousel card).
- **Thick ink borders**: 2px (small phone elements), 3px (phone cards/buttons),
  4px (TV cards).
- **Sticker rotations**: cards and badges tilted `rotate(-3deg…3deg)`,
  alternating direction between siblings.
- **Fully rounded pill badges** (`border-radius: 999px`) for labels: HOST,
  JUST JOINED!, GRAB YOUR PHONE!, chips.
- Border radius scale: 10–16px small elements, 16–20px inputs/list rows,
  24–28px large cards.
- Empty slots use dashed `3px dashed #C9BFAC` borders (circles for avatars,
  rounded rects for seats).

## Screens / Views
TV screens are designed at **1280×720** (scale ×1.5 for 1080p). Phone screens
are iPhone-sized (~390×844).

**Title-safe area:** every measurement below runs to the edge of that 1280×720
canvas, but a television crops the outer ~5% of every edge without reporting it
(overscan), so content drawn edge to edge is lost under the bezel on real
hardware even though it looks perfect in the simulator. The whole TV stage is
therefore scaled into the inner **90%** (a 5% gutter all round) — see
`tvSafeStageScale` / `tvTitleSafeFraction` in `@huddle/ui`. Screens keep the
handoff's numbers exactly; the composition just sits inside the safe rectangle.
The screen-colored gutter is what the TV crops, not the header or footer.

### 1. TV — Pairing
- Header row (padding 36px 56px): Bungee logo "HUDDLE." (34px, tangerine
  period) left.
- Center, two groups gap 96px:
  - Left: rotated tangerine pill badge "GRAB YOUR PHONE!" (letter-spacing 3px);
    row of 4 code-letter tiles 148×176px, white, 4px ink border, radius 24px,
    6px offset shadow, each rotated ±1–2°, Bungee 88px, letters colored
    cobalt/tangerine/pink/green in order; caption directing players to open
    Huddle on their phone and enter the code.
  - Right: QR card — white, 4px ink border, radius 24, rotated 1.5°, ~196px QR;
    caption "or scan to join".
- Footer: 4 dashed avatar circles (72px) + "0 of 10 joined — waiting for
  players…" (22px muted). Once players are in (agreed during implementation)
  the line is the count alone — "4 of 10 joined": "waiting for players…" is
  false at 10 of 10.
  - **The seats never fill up**, which was not the intention and is the
    consequence of §3 below: the television goes §1 → §6 at the first join, so
    this footer is only ever drawn for an empty room. A taken seat was built —
    the player's claimed color, Bungee initials, the nickname under it, the
    online dot, and an offset shadow in pink for an arrival or tangerine for the
    Host — and none of it could reach a screen, so it was deleted. What is left
    is four dashed circles and, in practice, the empty room's own line: the
    footer is still drawn *from* the roster, so the count reads what the room
    holds, and what the room holds whenever this screen is up is nobody. Written
    up against "Delete the TV's unreachable seat code" in
    docs/implementation-plan.md.

### 2. Phone — Join
- Logo (20px), heading "Join the room" (Bungee 28px).
- ROOM CODE label (13px, letter-spacing 2px, bold, muted) + 4 tiles 64×80px:
  - **13px is this document contradicting itself, and it is built at 14.** The
    typography tokens above floor phone body at ≥14px, and this label is body
    text by this document's own naming: the two type roles here are Display
    (Bungee) and Body/UI (Space Grotesk 400–700), and a bold muted label is the
    second. A floor a single per-screen line can undercut is not a floor, so the
    floor wins and every field label on the Controller — ROOM CODE, YOUR NAME,
    YOUR ROOM, YOUR COLOR, SETTINGS, YOU'RE THE HOST — PICK A GAME — is 14.
    Measured on an iPhone 17 rather than argued: the longest of them grows from
    256.7pt to 272.0pt in a 354pt column, so nothing wraps, and the roster below
    moves down 1.33pt. Frames in `tools/design-fidelity/`; written up against
    "Design fidelity — the phone's 14px floor" in docs/implementation-plan.md.
  filled letters use Bungee 36px in the letter's color; active cell has cobalt
  border + blinking cobalt caret; empty cell dashed border.
- YOUR NAME label + white input (3px ink border, radius 16, shadow 3px).
- Primary button: cobalt bg, white text, 3px ink border, radius 18,
  min-height 56px, shadow 4px.

### 3. TV — Lobby
- Header: logo left; "room" + code chip (Bungee 24px, cobalt, letter-spacing
  5px, white bg, ink border, shadow) right.
- Center row, gap 28px: player cards 216×264px (white, 4px ink border,
  radius 28, 6px shadow, alternating tilt) with 96px circular avatar (solid
  claimed color + 3px ink border, Bungee initials), name (26px bold), status.
  Host card gets black HOST pill; newest joiner's card swaps border+shadow to
  pink with "JUST JOINED!" pill. One empty dashed slot with "+" and the code.
  - Not built, and not coming: this screen has no room on a 720px stage beside
    §6's 520px focused card, so the television goes §1 → §6 at the first join.
    Of the three things this line draws, "JUST JOINED!" survives as the §6
    footer's line for four seconds; the HOST pill is dropped because §6 names
    the Host in words and a pill needs an avatar to label; and the away
    treatment is dropped outright, so the television says nothing about a
    non-Host player being away. Written up against the "TV carousel closes its
    two departures" task in docs/implementation-plan.md.
- Footer: "4 of 10 players in — <Host> can start whenever".

### 4. Phone — Player lobby ("You're in")
- Header: small logo + code chip. 128px avatar circle (player color, 4px ink
  border, 5px shadow), heading "You're in, <Name>!".
- YOUR COLOR picker: swatch circles 44px; selected has ink border + shadow,
  claimed/unavailable dimmed to 30% opacity.
- Bottom card: white, green status dot, "Eyes on the TV — <Host> is about to
  pick a game".

### 5. Phone — Host lobby (roster)
- Heading "Your room" + code chip. Roster rows: white, 3px ink border,
  radius 16, 3px shadow — 40px avatar, bold name, right slot = HOST pill /
  green online dot / pink NEW! pill (new row uses pink border+shadow).
  - **Built**, and built because of §3: the television dropped the away
    treatment outright, so these rows are the only surface left in Huddle that
    says a non-Host player is away between games. They are a *section* of the
    Host's screen rather than a screen — that phone already carries §4 and §7,
    and one screen cannot have two headings, so "Your room" is a section label
    over the rows, drawn directly under §4's heading and above its color picker
    so the rows land without scrolling. Every measurement above is drawn as
    pinned *except the new row's pink border and shadow*, which is the NEW! pill
    below; all of them are measured back off
    `tools/design-fidelity/10-phone-host-roster.png`.
  - Two decisions about the right slot. **Away is the fourth thing it says**,
    and it says it the way the system already decided a listed player's
    presence reads: the Status Dot mutes, the face dims to 30%, the nickname
    goes to muted text. **The pink NEW! pill is not drawn** — an arrival is
    already greeted for four seconds on the television (§6), and the machinery
    that stops such a greeting repeating after a game lives in the TV app.
    Deferred rather than dropped; written up against the "§5's phone roster"
    task in docs/implementation-plan.md.
- **Host controls — transfer and remove (not in the original handoff; added by
  task 3.7).** §5 draws a row that *states* a player's presence; it did not draw
  the Host acting on one. The two approved host powers — hand the room to another
  player (`transferHost`), take a player out of it (`removePlayer`) — are wired
  here as a **manage sheet**, chosen over per-row buttons for two of this
  section's own reasons: the rows already run below the fold from about the
  sixth player (a per-row pair of buttons would push the count line further
  off-screen), and removal deletes a seat and is not undone, which is worth the
  deliberate second surface a stray thumb does not land on.
  - Every non-Host row gains a muted disclosure chevron (§7's own Bungee "›")
    and becomes a button; the Host's own row stays a plain label, since the
    server refuses both powers against it (`targetIsSelf`). Tapping a row opens
    the sheet: a centred Boardwalk confirm dialog over an ink scrim (ink at ~45%,
    so the room reads as still there), showing the player's avatar and name, then
    two full-width buttons — **"Make host"** (cobalt primary) and **"Remove"**
    (punch, the same "this ends something" face as Back to lobby) — a failure
    line, and a muted "Cancel". A tap off the panel dismisses.
  - **Transfer is disabled for an away target** — the room a game runs in needs
    a host who can run it, so `transferHost` refuses an away successor the way
    the automatic handover picks a connected one; the dimmed button carries a
    line saying to hand the room to someone still here. **Remove stays live for
    an away target** — clearing out a phone that has gone quiet is the main
    thing a Host removes anyone for. Which controls a row offers and whether
    each is live is the pure `apps/controller/src/host-controls.ts`
    (`rosterRowControls`), the same answer the row's chevron is gated on, so the
    sheet and the server never disagree about what is on offer.
- Footer: "<n> players in — you can start anytime" + cobalt primary button
  "Choose a game →".
  - The line is drawn, and drops "you can start anytime" when the room is too
    small for the game it is on, the way §1's footer drops "waiting for
    players…" once somebody is in: the start control immediately below already
    says what the room is short of. The **button is not** drawn — the picker it
    would open is on this same screen, and this screen's one cobalt primary
    button is §7's "Start <Game>".

### 6. TV — Game carousel
- Header as lobby. Center: 3 cards — side cards 300×400px at 50% opacity,
  scale 0.94, tilted, showing game key art (flat color block + Bungee title);
  focused card 440×520px, 4px ink border, **10px cobalt offset shadow**, art
  area + info block: title Bungee 34px, chips "2–10 players" / "~12 min" /
  category (yellow chip).
  - The chip *values* are the module's, not this document's: the carousel draws
    whatever `GameMetadata` declares (player range, estimated minutes,
    category), so a second game changes them without changing this layout. The
    three above are trivia's, and two of them are still exact. "~12 min" is
    not: trivia declares 5, which is what its scoped settings produce — ten
    questions at a 20s countdown and a 5s reveal, and the reveal comes sooner
    when everybody has answered. Treat the mock's number as the chip's *shape*
    (a tilde and a unit, sized for 2–3 digits) rather than trivia's duration.
- Footer: page dots (active = cobalt pill with ink border) + "<Host> is
  browsing on their phone".

### 7. Phone — Host game picker
- Label "YOU'RE THE HOST — PICK A GAME". Selected-game card (mini key art +
  title + meta). Prev/next round buttons 76px (white, ink border, shadow) with
  "2 / 3" between. Hint "Swipe or tap arrows — the TV follows along". Primary
  cobalt button "Select <Game>".

### 8. Phone — Player waiting
- Player avatar 88px, heading "<Host> is choosing…", status card "Now viewing
  <Game>" with green dot, caption "Your phone becomes the controller the
  moment the game starts".

## Interactions & Behavior
- **Join**: code entry auto-advances per letter; caret blinks in active cell;
  Join validates the code server-side.
- **Avatar pop-in**: when a player joins, their TV card animates in (scale
  0.6→1 with slight overshoot, ~300ms spring) and holds the pink "JUST
  JOINED!" treatment for ~4s before settling to the normal style.
  - **Built, on the surface that inherited what it announces.** The TV card is
    §3's, which is never coming, and the pairing Seat that stood in for it is
    only ever drawn for an *empty* room — so the spring as written has nothing
    reachable to run on. What survived §3 is the greeting itself: §6's footer
    line hands its four seconds to the newest arrival, in punch. That line is
    what pops in — same event, same treatment, same 0.6→1 spring at the same
    ~300ms — so the animation moved with the thing it was announcing rather
    than being dropped or pinned to dead code. The four seconds were already
    built and are unchanged. What a party sees is a *line* springing in under
    the carousel, not a card: there is no avatar on this television to scale,
    and the §4 phone avatar was considered and refused, because a spring there
    would fire on a rejoin as well as an arrival and only its owner would see
    it. Measured on the tvOS simulator against
    `tools/design-fidelity/17-tv-arrival-pop-in.png`; written up against "the
    two handoff animations" in docs/implementation-plan.md.
- **Color picker**: tapping a swatch claims it (server-validated uniqueness);
  unavailable colors dimmed to 30%.
- **Carousel sync**: host phone prev/next (or swipe) drives the TV carousel in
  real time via room state (`browsingGameIndex`); TV animates card transition
  ~250ms ease-out. Non-host phones live-update the "Now viewing X" label.
  - **Built**: the row of cards slides 96pt in from the direction the room
    browsed and eases out over 250ms as the new card lands. Transform only, so
    it moves nothing Yoga can see and the footer's measured 10pt of daylight
    (§6 above) is untouched. The travel distance is not this document's — it is
    deliberately shorter than a card's pitch, because the row is centred and
    changes width as neighbours appear at the ends of the Registry.
    **A build that installs one game can never show it**: with a single card the
    index has nowhere to go, so it was watched against a patched Registry of two
    (`tools/carousel-transition-repro.patch`), which is also the honest reading
    of the animation's status until a second game ships.
- **Start**: only the Host sees/can tap "Select …"; on select, all clients
  transition to the game.
- **Reconnect**: phones rejoining land on the phase-appropriate screen (room
  state is server-authoritative).

## Assets
- Fonts: Bungee, Space Grotesk (Google Fonts).
- QR codes in the mocks are decorative placeholders — generate real ones
  (room join deep link) at runtime.
- Game key art: flat color + Bungee title treatments as shown; no external
  images used.
