# Handoff: Huddle — TV Lobby & Pairing Flow ("Boardwalk" design system)

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
  false at 10 of 10, and the seats that fill up claim the width it used. A
  taken seat is its player's avatar circle with the nickname under it.

### 2. Phone — Join
- Logo (20px), heading "Join the room" (Bungee 28px).
- ROOM CODE label (13px, letter-spacing 2px, bold, muted) + 4 tiles 64×80px:
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
- Footer: "<n> players in — you can start anytime" + cobalt primary button
  "Choose a game →".

### 6. TV — Game carousel
- Header as lobby. Center: 3 cards — side cards 300×400px at 50% opacity,
  scale 0.94, tilted, showing game key art (flat color block + Bungee title);
  focused card 440×520px, 4px ink border, **10px cobalt offset shadow**, art
  area + info block: title Bungee 34px, chips "2–10 players" / "~12 min" /
  category (yellow chip).
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
- **Color picker**: tapping a swatch claims it (server-validated uniqueness);
  unavailable colors dimmed to 30%.
- **Carousel sync**: host phone prev/next (or swipe) drives the TV carousel in
  real time via room state (`browsingGameIndex`); TV animates card transition
  ~250ms ease-out. Non-host phones live-update the "Now viewing X" label.
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
