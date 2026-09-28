# Playroom design reference

Playroom is the visual direction for the Huddle platform screens on Phone and
TV. Its tokens come from the Huddle-Platform design system, kept here in
[`spec/tokens.json`](./spec/tokens.json) and
[`spec/avatar-map.json`](./spec/avatar-map.json). Its look follows the three
concept boards in [`reference/`](./reference/). The interactive prototype at
<https://claude.ai/artifact/722ry5vuRaDCnR66PoAAML> shows every platform
screen, including the ones the boards do not cover. For behavior,
[`../../project-scope.md`](../../project-scope.md) wins.

Only platform surfaces use Playroom. After the countdown ends, each game module
draws its own Phone controller and TV stage in its own theme.

## Where the look departs from the spec

The concept boards win over three spec rules:

- **Headings** use Nunito Black (900) and run larger: 84 for TV headings and
  104 for the TV hero at 1080p, 32 on the phone.
- **The primary button is orange** with deep-purple text. White text on this
  orange is too faint for phone-sized labels.
- **Decoration is fuller:** orange burst dashes beside headings and main
  actions, and clay stars and balls framing every TV screen. Props still
  settle once and then hold still.

Everything else follows the spec.

## Tokens

| Role | Value |
| --- | --- |
| Canvas | `#F9F1E6` |
| Surface (cards) | `#FFFCF7` |
| Ink (text, text on orange) | `#2D0B4E` |
| Muted text | `#6D5B79` |
| Orange (primary action, bursts, host tag) | `#FF781F` |
| Lavender (pills, selection, Make host) | `#E3D9FF` |
| Border | `#D8CCDF` |
| Success / surface | `#286447` / `#D4F1CC` |
| Danger / surface | `#A52C44` / `#FFE0E5` |
| Disabled | `#E5DEE9` |

Type is Nunito: 900 for headings and codes, 800 for titles, names and button
labels, 700 for labels, 400 for body. Nothing on the TV is smaller than 24 at
1080p. The TV stage is 1920×1080 with a 96×54 overscan-safe inset. Radii are
16 for inputs, 20 for buttons and 28 for cards.

## Components

| Component | Notes |
| --- | --- |
| Wordmark | Top left on every platform screen. Deep purple with orange dashes; use the supplied artwork. |
| Heading | Nunito Black with three orange burst dashes on each side. |
| Code tiles | The room code as four letter tiles on the TV, matching the phone's four input boxes, with the QR code beside them. |
| Status pill | Lavender pill with an icon: `3 / 10 joined`, `Room full · 10 / 10`. |
| Avatar | The character on its pastel circle. Below the circle's middle the portrait is clipped to the circle; above it, hair and ears break out of the top. Host gets an orange crown, a ready player an orange raised hand, and an away player a grey circle with a faded portrait that stays inside it. |
| Empty seat | A plain silhouette with no number or label. |
| Game card | TV picker: three cards, art, title, tagline and an Available or Coming soon pill. The card the host is on is lavender with an ink border. |
| Game row | Phone picker list: round icon, title, tagline, and a Coming soon pill with no chevron when it cannot be set up. |
| Setting row | Phone: icon, label and value; a stepper for counts, a segmented control for short lists, a sheet for long lists. TV: art card beside rows of icon, label and value; a changed row lights up. |
| Buttons | Orange primary with burst dashes (hidden while disabled); outlined secondary; lavender for Make host; red-outlined destructive; muted text link. |
| You chip | Phone top bar: your avatar and `You · Name`. |

## Screens

| Step | TV | Phone |
| --- | --- | --- |
| Splash | Splash illustration, wordmark, `Opening your room`. | Join a room: four code boxes, Join room, Scan the QR code. |
| Identity | The room, with a silhouette seat for whoever is joining. | Pick your look: 5×2 avatar grid with taken avatars dimmed, name field, Let's go!. From here the phone is tinted with your avatar's circle colour. |
| Room | `Grab your phones!` → `Come on in!` → `Everyone's here!`, code tiles and QR, status pill, 2×5 seats, `Alex is choosing what's next`. | Host: Your room, code, count, player tiles, Choose a game, Leave room; tapping a player opens Manage player. Guest: You're in!, host card, Hang tight. |
| Pick a game | `What are we playing?`, `Alex is looking at`, three game cards, the roster along the bottom. | Host: featured card with Set up, list of the other games. Guest: Game night with the live selection. |
| Set up | `Setting up Trivia`: art card beside live setting rows; everyone else waits along the bottom. | Host: Quick / Standard / Custom, setting controls, Lock settings. Guest: Setting up with the live summary. |
| Ready check | `Hands up for Trivia!`: summary chip, 2×5 avatars that lift with a raised hand when ready, a bar with one segment per player, `7 of 10 hands up`. | Host: Settings locked, summary, who is still waiting, Start (enabled when every hand is up), Edit setup. Guest: a large Raise your hand button; tap again to put it down. |
| Countdown | `Trivia starts in` with a large ring and number, the roster below; everyone jumps once at Go!. | Get ready!, the ring, Eyes on the TV!, and a haptic tick each second. Host: Stop the countdown. Guest: Wait, I'm not ready. |
| Game on | The game's art grows in, then the game's own screens. | The game's own controller. |

States off the happy path: scan, room not found, game paused (TV and phone),
TV reconnecting, removed from the room, game finished, and back in the room
(a podium for the top three and `Play Trivia again?`). Each uses the matching
status illustration.

## Motion

Motion follows the spec and Emil Kowalski's design-engineering rules (the
`emil-design-eng` and `animate-expo` skills): keep UI motion under 300 ms,
enter with a strong ease-out (`cubic-bezier(0.23, 1, 0.32, 1)`), never grow
from `scale(0)`, and keep motion on the UI thread with Reanimated.

| Name | Timing | Where |
| --- | --- | --- |
| Press | 100 ms to scale 0.98 on press-in | every phone button and tappable row |
| Transition | 180 ms fade or colour change | toggles, option rows, badges |
| Entrance | 240 ms with at most 12 units of travel | surfaces, seats, props |
| Stagger | 40 ms per item | the avatar grid's first appearance |
| Highlight | 600 ms fade | a setting the host just changed |
| Tick | one pop per second, following the server deadline | the countdown number |

Nothing bobs forever behind essential information. With reduced motion, scale
and travel are dropped; opacity changes remain, and every number and label
still changes. Haptics accompany, never replace, a visual change.

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
