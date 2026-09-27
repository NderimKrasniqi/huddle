# Playroom design reference

Playroom is the approved visual direction for the Huddle platform screens on
Phone and TV. It replaces Heartbeat. The three concept boards in
[`reference/`](./reference/) are the source of truth for look and layout, and
the interactive prototype at <https://claude.ai/artifact/722ry5vuRaDCnR66PoAAML>
shows every platform screen, including the ones the boards do not cover. Where
the two disagree, the boards win for look and
[`../../project-scope.md`](../../project-scope.md) wins for behavior.

Only platform surfaces use Playroom. After the countdown ends, each game module
draws its own Phone controller and TV stage in its own theme.

## Principles

- **Cream, deep purple, one orange action.** Cream backgrounds, deep-purple
  text, and a single orange primary action per phone screen. Everything else
  is lavender, outlined, or a text link.
- **Clay characters, calm surfaces.** Personality comes from the 3D clay
  avatars, game art, and props. Surfaces stay flat, soft, and uncluttered.
- **The phone drives, the TV follows.** Every host action has a visible answer
  on the TV within one beat.
- **Readable from the couch.** Room codes, counts, and the countdown are the
  largest things on the TV.
- **Native where it can be.** Background, text, buttons, pills, QR code, and UI
  glyphs are drawn natively. Raster art is limited to characters, game art,
  props, and illustrations.

## Tokens

| Role | Value |
| --- | --- |
| Cream background | `#FCF6EF` |
| Card | `#FFFFFF` |
| Ink (deep purple) | `#1F0B3F` |
| Secondary text | `#3B2B5E` |
| Muted text | `#7A6E90` |
| Orange (primary action, bursts, host tag) | `#FC6221` |
| Lavender (pills, secondary buttons) | `#F0E8F8` |
| Lavender strong (selected, Make host) | `#E1D2F4` |
| Purple accent (selected card, dots) | `#6838DF` |
| Ready green | `#12C24A` |
| Remove red | `#D63B3B` |
| Coming-soon grey | `#EFECF0` |

Type is Nunito from the existing font package: 900 for headings and codes, 800
for buttons and names, 600–700 for body. The TV background is the cream
colour rendered natively with a faint warm vignette. It is never blurred at
runtime.

## Brand

- The wordmark is **Huddle** in deep purple with two orange dashes at the top
  right. Use the supplied wordmark artwork; never set it in orange.
- The app icon is the deep-purple H with the same dashes on cream.
- Headings carry three orange burst dashes on each side.

## Components

| Component | Notes |
| --- | --- |
| Wordmark | Top left on every TV platform screen, top left on phone screens. |
| Chip | Lavender pill for context on later screens: `KJMP · 10 players`, `Room: KJMP`. The room screen has none; its code is already the biggest thing on it. |
| Status pill | Wide lavender pill under the join card: `3 / 10 joined`, `Room full · 10 / 10`, `10 / 10 ready`. |
| Join code | “Join at” and the code, with the native QR code and “Scan to join” beside it, straight on the cream with no card behind them. |
| Avatar circle | Character on its pastel circle. Host gets an orange crown badge; Ready gets a green check; waiting shows three dots; away is greyscale. |
| Player tile | Phone lobby: white card with avatar, name, and orange HOST tag, in two columns. |
| Game card | TV picker: art, title, tagline, and an Available or Coming soon pill. The selected card has a purple outline. The window stops at each end instead of wrapping. |
| Game row | Phone picker list: round icon, title, tagline, status pill, chevron. |
| Setting row / tile | Phone: icon, label, value, chevron, opening an option sheet. TV: icon plus two-line value and unit (`20` / `seconds`). Icon and unit come from the game's settings schema. |
| Buttons | Orange primary with bursts; lavender secondary; red-outlined destructive; muted text link. |
| Countdown ring | Orange ring draining over five seconds around a large number, then Go!. |

## Screens

| Step | TV | Phone |
| --- | --- | --- |
| Splash | Splash illustration, wordmark, “Opening your room”. | Join a room: four code boxes, Join room, Scan the QR code. |
| Identity | Room waiting for players. | Pick your look: 5×2 avatar grid with taken avatars dimmed, name field, Let's go!. |
| Room | “Grab your phones!” → “Everyone's here!”, join code and QR, status pill, 2×5 avatar grid, “Alex is choosing what's next”. | Host: Your room, code, count, player tiles, Choose a game, Leave room. Tapping a player opens Manage player. Guest: You're in!, host card, Hang tight. |
| Pick a game | “Playroom — Pick a game”, three cards, labelled dot rail, split roster with “Alex is choosing a game”. | Host: featured card with Set up, list of the other games. Guest: Game night with the live selection. |
| Set up | “Setting up Trivia”: art card and live setting rows that flash when changed. | Host: Quick / Standard / Custom, setting rows, option sheet, Lock settings. Guest: Setting up with the live summary. |
| Ready check | “Ready for Trivia?”: setting tiles, avatars with checks or waiting dots, `7 / 10 ready · Waiting for …`. | Host: Settings locked, summary, Start (enabled when everyone is Ready), Edit setup. Guest: I'm ready! / You're ready!, I'm not ready. |
| Countdown | “Trivia starts in” with the ring, avatars with checks. | Get ready!, the ring, Eyes on the TV!. Host: Stop the countdown. Guest: Wait, I'm not ready. |
| Game on | Circle wipe, then the game's own screens. | The game's own controller. |

States off the happy path: scan, room not found, game paused (TV and phone),
TV reconnecting, removed from the room, game finished, and back in the room.
Each uses the matching status illustration.

## Motion

| Name | Timing | Where |
| --- | --- | --- |
| Screen enter | 450 ms, slight overshoot | every step change |
| Hop-in | 600 ms spring | a player joining |
| Card glide | 550 ms | the picker following the host |
| Flash | 1.4 s | a setting the host just changed |
| Tick | 1 s per number, 500 ms pop | countdown |
| Wipe | 800 ms | handoff into the game |
| Idle | 4–7 s loops | props float, burst dashes wiggle |

With reduced motion, props and dashes hold still, transitions are instant, and
every number and label still changes.

## Artwork

The supplied Huddle asset pack is the source for runtime art. Sheets are sliced
into one file per slot. Avatars keep the ten stable avatar ids, with the
concept characters mapped onto them:

| Avatar id | Character |
| --- | --- |
| `fox` | Fox |
| `pink-bunny` | Bunny |
| `teal-bear` | Teddy bear |
| `mint-cat` | Yellow cat |
| `blue-robot` | Purple robot |
| `green-alien` | Frog |
| `red-robot` | Kid in the orange beanie |
| `purple-owl` | Girl with curly hair |
| `yellow-robot` | Girl with headphones |
| `puppy` | Dino with sunglasses |

Avatars, game art, and the Difficulty, Category, Results, and people setting
icons come from the individually rendered set; props, status illustrations,
brand art, and the remaining setting icons are sliced from the asset sheets.
Portraits ship without circles: the pastel circle behind each one, and the grey
`#DDD9DF` circle for an away player, are drawn natively from the design tokens.
Doodle Dash, Quick Poll, and Hot Take art is supplied already muted for Coming
soon. Voting Rounds reuses the question-mark count icon, and the people icon
serves both Voting voter labels and the ready count. The asset pack's Trivia
folder belongs to the Trivia module's own theme, not to the platform.
