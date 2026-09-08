# Huddle approved-screen asset audit

This audit covers the approved reference images in this directory. It identifies what must be supplied as raster artwork, what must remain native React Native UI, and whether the current runtime asset library can reproduce the reference exactly.

No composite reference image should be used as a screen background. Text, room codes, QR codes, controls, badges, status marks, lists, timers, and player data must remain native and accessible.

## Conclusion

The project is **not yet asset-ready for pixel-perfect implementation**.

The reference set contains 64 Phone state frames, 32 TV state frames, and one motion storyboard. The repository currently has a reusable runtime foundation—two brand marks, ten avatars, two Phone environments, one TV stage, five game-card illustrations, and two game-world scenes—but those files were generated for earlier directions and do not reproduce many of the approved frames exactly.

The main blockers are:

1. The avatar lineup changes between the identity, lobby, Host-management, and TV boards.
2. Trivia uses different owl designs across the game-picker boards and TV boards.
3. The glossy and flat Huddle marks vary across references.
4. Most Phone recovery/celebration illustrations do not exist as clean assets.
5. Most TV diagnostic, paused, unavailable, and finished scenes do not exist as clean assets.
6. The recovered Trivia and Voting loops introduce additional game-world, character-pose, result, and transition artwork that does not yet exist as clean runtime assets.

## Reference conflicts to resolve before asset generation

| Conflict | Evidence | Required decision |
| --- | --- | --- |
| Avatar lineup | `phone-player-identity-flow.png` uses bear, chick, owl, puppy, bunny, hedgehog, frog, fox, otter, and deer. Lobby/management and TV references use a different mix including cat, lion, robot, sloth, and additional rabbits. | Approve one canonical ten-avatar lineup and reuse it everywhere while preserving stable `AvatarId` values. |
| Trivia character | `phone-game-picker-carousel-list.png`, `phone-game-picker-sync-leave.png`, the TV picker, and current runtime art use visibly different owl designs and materials. | Approve one canonical Trivia owl and one canonical card composition. |
| Brand mark | References mix a flatter small mark with two different glossy marks. The runtime display and launcher marks also differ in shape and highlight treatment. | Approve one master glossy mark; derive small-display and launcher versions from it. |
| TV roster | The saved TV board shows one long avatar row. | User override is authoritative: use two rows. |
| TV carousel | The saved TV board shows five cards. | User override is authoritative: show three cards—one larger center card and one card on each side. |

## Phone screen audit

### Manual join — four states

Reference: `approved-screens/phone-manual-join-flow.png`

| State | Raster artwork required | Current status |
| --- | --- | --- |
| Empty code | Shared lower-room vignette: coral armchair, console, plants, lamp, and round rug | Missing. Current `join-environment.png` is a different full-height sofa scene. |
| Checking | Same room vignette; keyboard is operating-system UI | Missing shared vignette; no other raster needed. |
| Room found | Same room vignette | Missing shared vignette. |
| Room full | Same room vignette | Missing shared vignette. |

All headings, code tiles, availability notices, buttons, QR icon, spinner, and keyboard remain native.

### Player identity — four states

Reference: `approved-screens/phone-player-identity-flow.png`

| State | Raster artwork required | Current status |
| --- | --- | --- |
| Remembered identity | Red bear hero plus landscaped diorama base | Missing exact hero/diorama. Current identity environment is a different forest scene. |
| Avatar grid | Ten canonical transparent avatar portraits | Current ten files have correct alpha/dimensions but use a different character lineup. |
| Missing name | Same avatar set | Canonical set unresolved. |
| Joining/success overlay | Huddle mark only | Candidate runtime mark exists, but master mark is unresolved. |

The back button, name field, selection/taken states, validation, loading dots, sheet, and success notice remain native.

### QR scan and recovery — eight states

Reference: `approved-screens/phone-qr-scan-recovery-flow.png`

The scanner preview, framing corners, progress, notices, controls, and all copy remain native. Clean raster dependencies are the canonical owl-with-phone introduction illustration and the camera-unavailable still life. The blurred living-room camera preview may be created from the approved TV room asset at runtime; it must not include a baked QR code or UI.

### Platform lifecycle — eight states

Reference: `approved-screens/phone-platform-lifecycle.png`

| State | Raster artwork required | Current status |
| --- | --- | --- |
| Restoring/loading | Glossy mark and lower living-room vignette | Mark candidate exists; exact lower vignette is missing. |
| Host lobby | Canonical avatar portraits | Current lineup conflicts with references. |
| Guest lobby | Canonical avatar portraits and optional waiting character vignette | Avatar conflict; waiting composition is missing. |
| Locked setup | Game-mode thumbnails plus waiting red-bear pose | Existing game art is not an exact match; bear pose is missing. |
| Scanner recovery | Transparent reading-owl foreground overlay | Missing. Camera preview and scan frame stay native. |
| Paused game | Owl-reading armchair/lamp scene | Missing. Current Trivia world is a different scene and aspect treatment. |
| Seat lost | Sad red bear plus faded empty-seat/ghost silhouette | Missing. |
| Finished | Mint owl holding trophy plus separable confetti | Missing. |

### Host and player management — eight states

Reference: `approved-screens/phone-host-player-management.png`

The panels, dimming layer, crown, arrow, confirmations, success notice, and buttons should be native. The only raster dependency is the canonical avatar collection. The current avatar lineup cannot reproduce the bear/owl/cat/lion/sloth roster exactly.

### Game picker — carousel/list states

Reference: `approved-screens/phone-game-picker-carousel-list.png`

| Asset | Current status |
| --- | --- |
| Trivia card illustration | Existing felt owl is a different owl/composition from this board. Replace after canonical Trivia direction is chosen. |
| Voting card illustration | Existing ballot box differs in material, proportions, and supporting details. Replace for exact matching. |
| Doodle Dash illustration | Existing transparent pencil is close, but still requires visual approval against the selected board. |
| Quick Poll illustration | Existing transparent speech bubble is close, but still requires visual approval. |
| Hot Take illustration | Existing transparent flame is close, but still requires visual approval. |

Card surfaces, borders, arrows, dots, metadata, Coming-soon pills, and buttons remain native.

### Game-picker synchronization and leave states

Reference: `approved-screens/phone-game-picker-sync-leave.png`

| State | Raster artwork required | Current status |
| --- | --- | --- |
| Showing selection on TV | Canonical Trivia card art | Trivia conflict unresolved. |
| TV update error | Canonical Trivia card art | Trivia conflict unresolved. |
| Guest waiting for Host | Red bear seated in green chair with mug and plant | Missing. |
| Leave-picker confirmation | Huddle mark | Candidate mark exists; master unresolved. |

Spinner, warning, retry, modal, and roster strip remain native.

### Trivia and Voting setup — eight states

Reference: `approved-screens/phone-trivia-voting-setup.png`

No full-screen raster background is required. The screens need approved miniature Trivia/Voting art, canonical avatars in locked summaries, and a deterministic SVG icon set for question count, rounds, difficulty, timer, category, scoring, reveal mode, voter labels, players, and Host.

### Trivia gameplay — eight states

Reference: `approved-screens/phone-trivia-gameplay-flow.png`

The Phone needs a clean leafy cream background, the canonical owl in intro/celebration poses, the small animated next-question card, and a TV/console vignette for reveal and completion. Questions, answers, countdowns, locks, participation counts, result copy, and Host controls remain native.

### Voting gameplay — eight states

Reference: `approved-screens/phone-voting-gameplay-flow.png`

The Phone needs a clean coral-cloud background, canonical ballot-box and rabbit foregrounds, and the small cozy plant/lamp staging as separable layers. Prompts, choices, countdowns, locks, participation counts, result copy, and Host controls remain native.

## TV screen audit

### Lobby and game picker — eight states

Reference: `approved-screens/tv-lobby-game-picker-flow.png`

| Asset | Current status |
| --- | --- |
| Clean 1920×1080 TV lobby/stage background | Missing exact reference artwork. Current `platform-stage.png` is 1672×941 and depicts a different stage. |
| Huddle display mark | Candidate exists; master mark unresolved. |
| Ten canonical avatar portraits | Current lineup conflicts with the Phone and TV references. |
| Five text-free game illustrations | Existing set is partial/visually inconsistent; Trivia and Voting require replacement. |

The room code, real QR code, join copy, player names/status, empty slots, two-row roster, three-card perspective carousel, metadata, selected glow, and Coming-soon treatment remain native.

### TV platform system states — eight states

Reference: `approved-screens/tv-platform-system-states.png`

| State | Raster artwork required | Current status |
| --- | --- | --- |
| Creating/restoring | Approved TV base stage and Huddle mark | Exact stage missing; mark unresolved. Orbit and progress remain native animation. |
| TV setup required | Cream diagnostic background plus display/gear foreground illustration | Missing. |
| Device failure | Cream diagnostic background plus disconnected-device/cable illustration | Missing. |
| Paused/reconnecting | Trivia environment plus reading-owl foreground | Existing Trivia world has different composition and character design. |
| Trivia entered | Trivia game-world background and canonical owl foreground positioned for left-side composition | Existing world is different and places the owl differently. |
| Voting entered | Voting game-world background and canonical ballot-box foreground | Existing world is different from the reference. |
| Game unavailable | Dim forest/platform scene plus sad red bear | Missing. |
| Finished | Dark stage/lobby scene plus golden trophy and separable confetti | Missing. |

All text, roster data, room code, counts, badges, and progress remain native.

### Trivia gameplay — eight states

Reference: `approved-screens/tv-trivia-gameplay-flow.png`

Required clean assets include the Trivia room/world background, canonical owl poses, podium/celebration staging, and a lobby-return transition background. Questions, answer cards, timers, participation, correctness, standings, scores, and labels remain native.

### Voting gameplay — eight states

Reference: `approved-screens/tv-voting-gameplay-flow.png`

Required clean assets include the coral Voting room/world background, rabbit poses, ballot box, choice illustrations, recap icons, and lobby-return transition background. Prompts, timers, vote counts, tallies, percentages, voter labels, recap facts, and all status copy remain native.

## Motion asset audit

Reference: `approved-screens/platform-motion-storyboard.png`

The current Huddle mark is one flattened PNG. Exact splash assembly requires either four individual transparent heart-petal assets or a deterministic vector master that can expose each petal separately. The following are therefore missing:

- coral glossy heart petal;
- butter glossy heart petal;
- mint glossy heart petal;
- sky glossy heart petal;
- approved small heart/confetti particles or a deterministic native particle specification;
- transition-ready trophy/celebration foreground;
- transition-safe lobby, Trivia, and Voting backgrounds without embedded UI.

Orbit, bounce, crossfade, carousel movement, roster arrival, and reduced-motion behavior should be implemented with native animation using these layers, not with video or a screenshot sequence.

## Native assets and UI that should not be generated as raster images

The repository has `react-native-svg`, but it does not yet have the complete approved icon set. A deterministic SVG set is needed for:

- back and forward chevrons;
- QR code and camera frame;
- refresh/retry;
- check, minus, warning, information, and success;
- people/player count;
- clock/timer;
- all-ages smile;
- crown/Host;
- more/menu;
- edit pencil;
- trash/remove;
- lock;
- home/Back to lobby;
- pause;
- category, difficulty, scoring, rounds, questions, reveal, and voter-label settings.

The following foundations already exist and should remain native:

- Nunito Regular, Bold, and ExtraBold;
- room-code tiles and text fields;
- QR generation on the TV;
- camera preview on the scan route;
- sheets, alerts, buttons, cards, chips, badges, player rows, progress dots, and selection rings;
- all dynamic text, names, counts, timers, statuses, and accessibility labels;
- operating-system status bars and keyboards.

## Remaining reference gaps

The recovered boards now cover the primary playable loops for Trivia and Voting on both Phone and TV. Explicit standalone frames are still absent for submission-busy, submission-error/retry, and Host next-question/next-round confirmation states. Those gaps should be designed before claiming every error and Host-control state is pixel-perfect; they do not block extraction of the artwork used by the recovered primary flows.

## Recommended approval order

1. Approve one master Huddle mark.
2. Approve one canonical ten-avatar lineup.
3. Approve one canonical Trivia owl and Voting ballot-box treatment.
4. Generate and approve a Phone asset contact sheet containing only clean backgrounds and transparent foreground layers.
5. Generate and approve a TV asset contact sheet containing clean 1920×1080 backgrounds and transparent foreground layers.
6. Generate and approve the clean Trivia and Voting gameplay layers identified above.
7. Design the remaining busy/error and Host-advance frames.
8. Only after these approvals, implement screens in React Native using native UI over the approved artwork.
