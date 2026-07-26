# Project Scope — Huddle

## Problem
A group of friends is gathered at someone's home and wants to play games together
on the TV. Today they cope with: Jackbox (needs a console/PC wired to the TV and a
purchase), Kahoot (classroom-flavored, someone must pre-author a quiz), or
pass-the-phone apps (no shared screen, no party energy). There's no native TV app
where the TV is the stage and everyone's phone is instantly a controller.

## Solution
Huddle is a native TV app (Android TV first) that acts as a hub for party games.
The TV displays a room QR code; guests join from their phones with a nickname —
no accounts. One player's phone becomes the Host controller that picks the game,
sets options, and runs the night. Games are self-contained modules adapted
specifically to the TV-plus-phones format, following one principle: **eyes up** —
the TV is the stage, phones are minimal controllers. Game logic runs server-side
(Convex); TV and phones are renderers. MVP ships with one game: trivia.

## Target Users
- **Host** — owns the TV and starts the room; their phone gets room controls
  (pick game, settings, start/skip/end). In-game, the Host plays like any other
  player — the extra controls sit alongside normal play. Primary case: running
  game night for friends.
- **Player (guest)** — joins with their phone via QR, plays with a session-only
  nickname and avatar. Primary case: zero-friction participation at someone
  else's house.

## Features

### MVP
- **Room lifecycle** — TV app creates a room with QR + short room code; room
  expires after everyone leaves.
- **Join & lobby** — phone app joins via QR/code; nickname + a claimed player
  color (unique per room; avatar circle shows the player's initials); lobby
  roster on TV; done when 10 phones can sit in a lobby together.
- **Host controls** — first player is Host; picks game, adjusts settings, starts
  game; Host auto-transfers to longest-connected player on disconnect.
- **Game module foundation** — hub knows only a game-module interface (metadata,
  settings schema, player range, reducer, TV/phone views); trivia is the first
  module; done when adding a hypothetical game #2 requires no hub changes.
- **Trivia** — Kahoot-style: question + 4 options on TV, four answer buttons on
  phones; 2–10 players; settings: scoring mode (flat per correct answer default,
  speed-bonus optional), question count, category filter. Host plays too.
- **Question packs** — versioned data format (metadata + questions with
  text/options/answer/category/difficulty); one curated pack ships in-repo;
  trivia reads only packs.
- **Scoreboard & victory** — per-question reveal, running scores on TV,
  end-of-game victory screen, then back to hub lobby with the room intact.
- **Disconnect handling** — session token rejoin with score intact; game never
  waits; "away" badge on scoreboard; no duplicate players.

### Later
- More games (drawing, hidden-role/Werewolf-style) — deferred until the
  platform's feel is validated with trivia.
- New question sources (Open Trivia DB importer, AI-generated themed packs,
  user-authored packs) — all emit the same pack format; deferred as content
  plumbing, not platform.
- Accounts, profiles, stats, game library — layers on top of session identity;
  no MVP value.
- App Clips (iOS) / Instant Apps (Android) for install-free joining — friction
  optimization after the core is fun.
- tvOS as a *tested* target, then Samsung/LG via web builds — same
  codebase/protocol by design; deferred for lack of test hardware.
- Store publishing (Play Store, App Store) — after MVP proves itself at real
  parties.
- huddle.tv domain / web landing page (the design's TV copy references it) —
  MVP copy says "open Huddle on your phone" instead; a landing/redirect page
  only matters at public distribution.

## Out of Scope
- Third-party game SDK, marketplace, purchases, coins — the original platform
  vision; revisit only if Huddle's own games succeed.
- Twitch/real-time genres (racing, rhythm) — the relay/Convex latency model
  can't serve them; a deliberate genre fence.
- Cloud-streamed games (the Netflix model) — wrong constraints for this project.
- Roku — incompatible platform, permanently out.
- Microphone/camera-based games — capability and privacy surface MVP doesn't
  need.

## Constraints & Non-functional Requirements
- **Deployment:** Android TV (Philips, the dev's own TV) is the primary tested
  target; tvOS builds best-effort from the same Expo codebase. Controllers: iOS
  via TestFlight, Android via direct APK. Backend on Convex cloud.
- **Scale:** a handful of concurrent rooms (dev + friends); design honestly for
  ~10 rooms, not thousands.
- **Sensitive data:** effectively none — no accounts, ephemeral nicknames only.
  Keep it that way in MVP.
- **Cost:** as cheap as possible — local builds (no paid EAS), Convex free tier,
  sideloading; sole unavoidable cost is the $99/yr Apple Developer account for
  TestFlight.
- **Team:** solo developer.
- **Visual design:** fixed by the "Boardwalk" design system (high-fidelity
  mocks + tokens in `docs/design/`, source: claude.ai/design project "Mobile TV
  game controller system"). Hub screens are designed; trivia screens extend the
  same system.

## Open Questions
- Minimum viable size of the curated question pack (100? 300?) — decide during
  content authoring.
