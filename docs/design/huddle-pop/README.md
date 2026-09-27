# Huddle Pop design reference

Huddle Pop is the approved visual direction for the Huddle platform screens on
Phone and TV. It replaces the Heartbeat direction. The interactive prototype in
[`prototype.html`](./prototype.html) is the visual source of truth: open it in a
browser, press **Play the flow**, or click through the steps. Where this file
and the prototype disagree, the prototype wins for look and motion, and
[`../../project-scope.md`](../../project-scope.md) wins for behavior.

Only platform surfaces use Huddle Pop. After the countdown ends, each game
module draws its own Phone controller and TV stage with its own theme.

## Principles

- **Playful characters, calm surfaces.** Personality comes from the blob
  avatars, the couch, and the game art. Everything around them is flat colour,
  a light cloud background, soft shadows, and generous space.
- **Drawn in code.** Brand mark, avatars, game art, couch, QR frame, and
  decorations are vector shapes. There are no raster illustrations to maintain.
- **The phone drives, the TV follows.** Every host action on the phone has a
  visible, animated answer on the TV within one beat.
- **Readable from the couch.** TV type never drops below 20 px at 1920×1080.
  Room codes, counts, and the countdown are the largest things on screen.
- **Motion explains state.** Things hop in when they join, flash when they
  change, and bounce when they tick. Idle motion is slow and small.

## Tokens

### Colour

| Token | Hex | Use |
| --- | --- | --- |
| Ink | `#1D1B3A` | text, primary buttons, outlines inside art |
| Cloud | `#F3F4FA` | platform background |
| Surface | `#FFFFFF` | cards, chips, setting rows |
| Muted | `#6B6A8A` | secondary text |
| Line | `#E3E4F0` | control outlines on Phone |
| Tomato | `#FF5A4E` | primary call to action, code tile 1, Hot Take |
| Sun | `#FFC53D` | host crown, host card, “just changed” flash |
| Mint | `#22D39A` | ready state, live dot, code tile 3, Doodle Dash |
| Sky | `#4C8DFF` | code tile 2, Trivia |
| Grape | `#8B5CFF` | code tile 4, caret, Quick Poll |
| Bubblegum | `#FF7AC6` | Voting |
| Sofa | `#E6E3F8` / `#EFEDFC` / `#D9D4F4` | couch back, seat, arms |

The background adds three faint corner glows (Sky top-left, Sun top-right,
Bubblegum bottom-right) at 12–15% opacity.

### Type

- **Display:** Bricolage Grotesque 800, tight tracking (−0.02 to −0.03 em).
  Headlines, room code, game titles, countdown numbers, wordmark.
- **Body:** DM Sans 500–800. Names, settings, chips, help text, buttons.

| Role | TV (px at 1920) | Phone (pt at 390) |
| --- | --- | --- |
| Countdown number | 326 | 117 |
| Room code tile | 127 | 43 |
| Screen headline | 80–88 | 33 |
| Game title on key art | 108 | 29 |
| Setting row | 28 | 13 |
| Chip / name tag | 20–22 | 12–13 |

### Shape and depth

- Radii: chips and buttons are fully rounded; cards 24–46 px on TV, 16–24 pt
  on Phone; setting rows 25 px on TV.
- Shadows are soft and tinted with Ink at 6–18% opacity. Code tiles and the
  Phone primary button use a solid darker base shadow of their own colour.
- The selected game card gets a white ring plus a glow in the game colour.

## Components

| Component | Notes |
| --- | --- |
| Huddle mark | Four overlapping blobs (Tomato, Sun, Mint, Sky) with dot eyes, beside the lowercase `huddle` wordmark. |
| Blob avatar | One character per stable avatar id. It shares a body, eyes, cheeks, and smile, and the id adds a feature: fox ears and muzzle, green-alien antenna, pink-bunny ears, blue-robot antennae, purple-owl tufts and beak, yellow-robot bolt, red-robot side knobs, teal-bear ears, mint-cat ears and whiskers, puppy floppy ears and nose. |
| Crown | Sits on the host's blob wherever the host is drawn on the platform. |
| Ready badge / waiting bubble | A Mint check on ready players, and a white bubble with three dots on players still waiting. |
| Code tiles | Four tiles in Tomato, Sky, Mint, and Grape that bob in a wave. |
| QR card | White card tilted 2°, with a sweeping scan line, a Huddle mark in the centre, and a blob peeking over the top edge. |
| Couch | Ten seats on a drawn sofa. Empty seats are dashed numbered circles; a joining player hops onto their seat with a name tag. Used for the room and the ready check. |
| Game card | Game colour, animated art, and the title. Coming-soon cards carry an Ink “COMING SOON” sticker and cannot be chosen. |
| Setting row | Label left, value pill right. When the host changes it, it flashes Sun with a “JUST CHANGED” tag. |
| Mode switch | Quick / Standard / Custom pill switch. Changing a value on its own selects Custom. |
| Ready button | 66% of the phone width, round. Idle it pulses with a Tomato ring; ready it turns Mint with a check. Tapping again un-readies. |
| Countdown ring | Drains in the game colour over five seconds. The players orbit it and bounce on each tick, and “Go!” fires confetti. |
| Circle wipe | Grows from the centre in the game colour and hands the screen to the game. |

### Game art

Each game has a looping, text-free animation on its colour. Trivia is a
bouncing question mark with orbiting sparkles, Voting is ballots dropping into a
box, Doodle Dash is a pencil drawing a squiggle, Quick Poll is growing bars with
a chat bubble, and Hot Take is a flickering flame with rising sparks. The art is
presentation owned by the platform catalog. A game's own screens are not
required to use it.

## Screens

Each step is one TV surface and one Phone surface. The TV stays display-only.

| Step | TV | Phone |
| --- | --- | --- |
| Splash | The mark's blobs gather and squash together, the wordmark pops in letter by letter, then the TV opens the room. | Huddle home: blobs peek over the code card, four code boxes, Join room, Scan QR code. |
| Room | Mark, “Room open” live chip, “Grab your phone!”, code tiles, QR card, and the couch with a count such as `4/10 on the couch`. | First joiner sees the Sun host card with a crown, a live player list, and Choose a game (enabled from two players). Guests see the room and wait. |
| Pick a game | “Sunny is picking” chip, “What are we playing?”, five cards with the selected one centred and larger, neighbours tilted, the tagline, facts, and dots. | Host swipes or taps arrows through the same cards and presses Play. The TV follows the card the swipe settles on. |
| Settings | The key art slides in from the carousel. Beside it are the mode switch and one row per module-declared setting, each flashing when changed. | Host edits the mode and settings, then Start ready check. |
| Ready check | Game chip with a settings summary, “Everyone ready?”, six progress segments, and the couch with checks and waiting bubbles. | Every player gets the Ready button and a row showing who is ready. The host is ready automatically. |
| Countdown | Starts automatically when everyone is ready: “Voting starts in”, the draining ring, bouncing players, then Go! with confetti. | “Eyes on the TV!”, the blob looking up, the synced number, and “Wait, I'm not ready” to stop it. |
| Game on | Circle wipe in the game colour, then the module's TV stage. | The module's Phone controller. |

If anyone un-readies, leaves, is removed, goes away, or joins, or if the TV
disconnects during the countdown, the room returns to the ready check and the
TV shows a toast that names why.

## Motion

| Name | Duration and curve | Where |
| --- | --- | --- |
| Hop-in | 750 ms, overshooting spring | a player joining the couch or list |
| Glide | 600 ms, overshooting spring | carousel cards following the host |
| Flash | 1.3 s | a setting the host just changed |
| Jump | 700 ms | a player readying up |
| Tick | 1 s per number, 550 ms pop | countdown number and orbit bounce |
| Wipe | 800 ms, ease in-out | handoff into the game |
| Screen enter | 550 ms, slight overshoot | every step change |
| Idle | 2.8–4.6 s loops | blob bob, blink, glance; drifting doodles; code-tile wave |

With reduced motion, characters and decorations hold still, transitions are
instant, and every number, label, and state change still appears.

## Building it in React Native

- Shapes use `react-native-svg`, which the TV already depends on. The Phone
  adds it for avatars, the mark, and game art.
- Hops, glides, flashes, the wipe, and the countdown are transform and opacity
  animations. The built-in React Native `Animated` API can drive them with the
  native driver.
- The blob outline wobble morphs SVG paths. It needs Reanimated, which the
  architecture validator currently forbids. Without it, blobs keep a fixed
  outline and use transform-only squash and bob. This is an open decision.
- The TV keeps its 1920×1080 stage and 5% overscan-safe frame.

## Replaces

This direction replaces the Heartbeat palette, Nunito typography, platform
stage primitives, raster runtime artwork, and the Heartbeat reference boards.
Those are removed once every platform surface has moved to Huddle Pop.
