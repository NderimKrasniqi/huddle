# Design fidelity — the hub screens, side by side with the mock

The captures the Phase 5 task "Design fidelity — hub screens against the mock"
was decided on, kept here for the same reason `tools/blank-tile-ab/` is: the
finding should be readable by someone with no simulator to hand, and a claim
about a screen is worth what the frame behind it is worth.

Taken on 2026-07-31 against the Convex cloud dev deployment
(`nderim-krasniqi:huddle:dev`):

- TV — Apple TV 4K (3rd generation), tvOS 26.5, Debug build, 3840×2160 (×3 of
  the 1280×720 design stage, so every design point is 3 pixels).
- Controller — iPhone 17, iOS 26.5, Debug build, 1206×2622 (×3 of 402×874 pt).

| file | handoff section | what it is |
|---|---|---|
| `01-tv-pairing.png` | §1 TV — Pairing | empty room, code `HBMJ` |
| `02-phone-join-empty.png` | §2 Phone — Join | first launch, nothing typed |
| `03-phone-join-ready.png` | §2 Phone — Join | code from a scanned Join Link, name typed, Join enabled |
| `04-tv-carousel.png` | §6 TV — Game carousel | one player seated, one game installed |
| `05-phone-host-lobby.png` | §4 + §5 Phone — Host in the lobby | the Host's half of the merged seated screen |
| `06-phone-host-picker-before.png` | §7 Phone — Host game picker | before this task |
| `06-phone-host-picker-after.png` | §7 Phone — Host game picker | after: the game's meta, and the handoff's cobalt primary button |
| `07-phone-player-lobby-before.png` | §4 + §8 Phone — Player in the lobby | before this task |
| `07-phone-player-lobby-after.png` | §4 + §8 Phone — Player in the lobby | after: §8's status card, its green dot and its caption |

`04-tv-carousel.png` carries the one discrepancy that was measured and left
open: the focused card's 10px cobalt offset shadow runs to 640pt of the 720pt
stage and the page-dot row begins at 628pt, so the active dot sits inside the
shadow. It is drawn *on top* of it, not behind — the defect is camouflage, a
cobalt pill on a cobalt shadow, which leaves the active indicator reading as a
hollow ink rectangle. The arithmetic, and why the fix wants a tvOS build rather
than a nudge, are in the task in `docs/implementation-plan.md`.

Which screens were driven by a real client and which were seeded is recorded in
that task too; it has mattered on this project before.

## The carousel, after "the TV carousel closes its two departures"

Same device, same scale, same deployment, taken on 2026-07-31 at 22:09 off a
Debug build made that evening (`expo run:ios`, Metro serving the working tree).
`04-tv-carousel.png` above is the before for both.

| file | what it is |
|---|---|
| `08-tv-carousel-after.png` | the footer on one row: the page dots clear of the card's shadow, and §6's browsing line naming the Host |
| `09-tv-carousel-just-joined.png` | the same footer during a phone's four seconds — the line handed to the newest arrival, in punch |

Measured off these frames at ×3, one pixel column at a time, in design points:

| | `04` (before) | `08`/`09` (after) |
|---|---|---|
| focused card, ink border | 110 → 630 | 124 → 644 |
| its 10px cobalt shadow | 630 → 640 | 644 → 654 |
| active page dot | 626 → 639 — *inside the shadow* | 664 → 676 |
| daylight between them | none: the dot row starts 12pt above the shadow's bottom edge (9.3pt of it against painted cobalt) | **10pt of screen cream** |

The camouflage is visible as numbers in the before column: at the dot's own
x the run is ink 626→630, cobalt 630→636, ink 636→639, and the shadow behind it
is cobalt 630→640 — so the dot's fill and the shadow are the same colour at the
same pixels, and only the ink border survives. After, the dot's cobalt sits on
cream with 10pt of it above.

`09` measures identically to `08` line for line, which is the other half of the
claim: the arrival greeting borrows the footer's existing 28pt line rather than
adding anything, so the footer cannot grow back into the shadow.

The players in both frames were **seeded** with `npx convex run
players:joinRoom` — Ada (who is therefore the Host the line names) and then
Grace Hopper, whose arrival is what `09` catches. Nothing on this screen needs a
phone: the carousel is a pure renderer of `browsingGameIndex` and the roster.

## §5's phone roster, after "Design fidelity — §5's phone roster"

iPhone 17, iOS 26.5, Debug build at 1206×2622 (×3 of 402×874 pt), taken on
2026-08-01 against the same cloud dev deployment. `05-phone-host-lobby.png`
above is the before: the same Host screen with no roster on it at all.

**Three of the four are the landing view** — what the Host sees on arrival, with
nothing scrolled. That is said first because an earlier capture set for this
task was scrolled and unlabelled, which hid the question of whether the rows are
reachable without a swipe at all.

| file | scrolled? | what it is |
|---|---|---|
| `10-phone-host-roster.png` | **no — landing view** | three rows: the Host's pill, a player the room is hearing from, and one it is not, with the count line under them |
| `11-phone-host-roster-six-players.png` | **no — landing view** | six rows, showing exactly where the fold falls |
| `12-phone-host-roster-one-player.png` | **no — landing view** | a room of one: the count line without its "you can start anytime" |
| `13-phone-host-start-blocked.png` | yes, to the start control | "Trivia needs one more player." — the line `12`'s count defers to |

### The row, measured off `10` at ×3

§5 pins every one of these, and each is a pixel run read in design points:

| | handoff §5 | measured |
|---|---|---|
| row border | 3px ink | **3.00** (left edge x 24.0→27.0) |
| row shadow | 3px | **3.00** — the right edge reads as one 6.00 ink run, border plus shadow |
| row radius | 16 | **16** — the top scanline's ink begins 15.33pt in and the edge is straight 15.33pt down, which is a 16pt arc with the most-transparent pixel or two at each end under the threshold |
| avatar | 40px | **40.00** (x 41.0→81.0), inside a 2.00pt ink ring |
| status dot | green online dot | **12.00 × 12.00**, `#17A34A` |
| row box | not pinned | 60.00 interior on a 76.0 pitch — 3 + 60 + 3, then a 10pt gap of which the shadow takes 3 |

Colour, not eye, is what checks the away row. Milo's ink ring reads
`(186,186,185)` and his face `(185,227,200)` — ink and the claimed green at
exactly 30% over white, which is `opacity.unavailable`. His nickname reads
`(110,102,83)` (`colors.mutedText`) against Grace's ink, and his dot
`(201,191,172)` (`colors.mutedBorder`) against her `(23,163,74)`. The Host's
fill is `(43,75,242)` cobalt and Grace's `(226,61,109)` punch, so the palette's
paired monogram inks — white on cobalt, ink on punch — are on screen too.

### Where the fold falls, measured off `11`

The roster is drawn under §4's heading and **above** its color picker, which is
what puts it on the landing view at all. On this phone the scroll viewport ends
at **839.3pt** of the 874pt screen (the safe-area bottom inset), and:

| | design pt |
|---|---|
| "YOUR ROOM" label | 383.3 |
| row 1, ink border top | 411.3 |
| row pitch | 76.0 |
| row 5, bottom edge including its shadow | 784.3 |
| row 6, ink border top | 791.3 — **clipped at 839.3** |

So **rows 1–6 all show their avatar, nickname and status**, and row 6 loses only
its bottom edge and shadow; from the **seventh** player a row is entirely below
the fold, as is the count line from six players on. The room cap is ten, so a
full room still keeps four rows behind a swipe. That residue is named against
the task in `docs/implementation-plan.md` rather than left to be found. For
contrast, the review that caught this measured the previous layout's first row
beginning at **676pt** — two rows on the landing view, and in `10`'s own
three-player room the away row would have been below the fold.

**Driven and seeded.** The Host (Ada) was **driven** on the phone in every
frame: the Join Link opened, the nickname typed, Join tapped, cobalt claimed off
§4's picker. Everyone else was **seeded** with `players:joinRoom`. The away
players are Milo (`10`, `11`) and Zoe (`11`), because a seeded seat never beats
and the room's own `markAway` reached them; Grace Hopper, Bea and Cyd were held
present by a `players:heartbeat` loop from the CLI. `players:roster` was read at
capture time and reported exactly the split the frames draw — in `11`, Milo and
Zoe `away: true` and the other four `false` — so every muted dot is the room's
answer and not a rendering accident.

## The phone's field labels, after "Design fidelity — the phone's 14px floor"

iPhone 17, iOS 26.5, Debug build at 1206×2622 (×3 of 402×874 pt), taken on
2026-08-01 against the same cloud dev deployment. An **A/B on one line**: the
`label` style's `fontSize` was flipped in place and Metro's fast refresh
re-rendered the screen that was already up, so the two frames of each pair
differ in that number and in nothing else — same device, same room, same scroll
position, seconds apart.

| file | what it is |
|---|---|
| `14-phone-join-label-before.png` | §2 Join, ROOM CODE and YOUR NAME at the handoff's 13px |
| `14-phone-join-label-after.png` | the same screen at `minBodyFontSize.phone` (14) |
| `15-phone-host-lobby-label-before.png` | §4 + §5 + §7 Host lobby, three labels at 13px (landing view; SETTINGS is further down and unmounted) |
| `15-phone-host-lobby-label-after.png` | the same screen at 14 |

Measured off the frames at ×3 by scanning for `colors.mutedText`
(`#6E6653`), in design points:

| label | 13px | 14px | Δ |
|---|---|---|---|
| ROOM CODE | 87.67 wide, 9.33 cap | 93.33, 10.00 | +5.67 |
| YOUR NAME | 87.33, 9.33 | 93.00, 10.00 | +5.67 |
| YOUR ROOM | 88.67, 9.33 | 94.33, 10.00 | +5.67 |
| YOUR COLOR | 94.67, 9.33 | 100.33, 10.00 | +5.67 |
| YOU'RE THE HOST — PICK A GAME | 256.67, 9.33 | 272.00, 10.00 | +15.33 |

The Δ is **proportional, not constant**: `letterSpacing.label` is a fixed 2pt
per character and does not scale, so only the glyph run grows, by 14/13. Every
row above is that model to within about 0.35pt (the misses run 0.05 to 0.34,
and the residual is the space glyph, whose own advance scales with size where
the model holds it fixed) — "ROOM CODE" is 9 characters, so
(87.67 − 18) × 14/13 + 18 = 93.03 against 93.33 measured, and the 29-character
label gives 271.95 against 272.00. Both are ~6% of width, which is why the long
one gains 15.33 where the short ones gain 5.67.

The sixth label, **SETTINGS, is on neither frame**: it mounts only once a game
with settings is picked. It is the same `label` style and one word long, so it
gains less than anything measured above — that much is inferred from the shared
style, not observed.

**Nothing wraps and nothing reflows.** The longest label is the one that could:
at 14 it runs 24.3 → 296.3pt in a column that is 354pt wide (402 less the
PhoneScreen's two 24pt insets), so it would have to grow another 30% to break.
Every label keeps its left edge at 24pt. What does move is vertical: each label's
line box grows about 1.3pt, so §5's roster row — the measurement the previous
task pinned at an ink border top of **411.3pt** — now begins at **412.67pt**, and
each label further down the Host's screen is displaced by the growth of the ones
above it (YOUR COLOR +1.67, the picker's label +3.00).

That leaves the fold finding above unchanged, by arithmetic rather than by a
frame: these frames hold a **one-player** room, so row 6 is not in them, and
row 1 is where the 1.33pt was measured. Carried onto `11`'s six-player layout it
puts row 6's border top at 791.3 + 1.33 = **792.7pt inferred**, against a
measured 839.3pt viewport — 46pt of margin, so rows 1–6 are still the landing
view and the seventh player is still below it. Re-capturing a six-player room
would settle it by observation; the margin is wide enough that it was not worth
seating five phones for.

**Driven, not seeded.** Ada was joined on the phone itself — Join Link opened
(`huddle://join/GGGU`), nickname typed, Join tapped. The join-form pair is the
same phone sent to a *second* room's link (`huddle://join/HHWH`), which is the
one case a seated Controller is let back to the form (see Rejoin in
docs/CONTEXT.md); it is the join screen with a scanned code in it, not a fresh
launch.

## The two handoff animations

Apple TV 4K (3rd generation) **at 1080p** (tvOS 26.5, 1920×1080 — ×1.5 of the
1280×720 design stage, where every other capture here is ×3), Debug build,
Metro serving the working tree, taken on 2026-08-01 against the same cloud dev
deployment.

The lower resolution is the point rather than a compromise: these two files are
frames pulled out of a *recording*, and `simctl io recordVideo` at ×3 dropped
most of a 300ms animation on this machine.

| file | what it is |
|---|---|
| `16-tv-carousel-transition.png` | the carousel's Card Transition, seven frames of one 250ms ease-out, labelled with elapsed time and the row's measured offset |
| `17-tv-arrival-pop-in.png` | the arrival greeting's Pop-in, seven frames of one ~300ms spring, labelled with elapsed time and the measured scale |

Both are strips of real frames at their real presentation times, not renders of
a curve. How they were taken:

- `simctl io <udid> recordVideo --codec h264` while the room was driven from the
  CLI, then `swift tools/motion-frames.swift <movie> <dir> <prefix> <from-ms>
  <to-ms>`, which decodes the track through and writes every frame in the window
  named by its own timestamp.
- The recorder writes frames **only while the screen is changing**, so a
  recording of a still television holds one frame and each animation is a burst
  of ~15–18 frames at 60fps. That is how the bursts were found.
- It also loses the tail of an interrupted recording, and its index stops before
  its samples do — seeking with `AVAssetImageGenerator` returns the same last
  frame for every request past that point, which reads exactly like an animation
  that finished instantly. `motion-frames.swift` reads sequentially for that
  reason.

**Driven and seeded.** Everything here was **seeded**: the arrivals with
`players:joinRoom`, the browsing with `games:browseGame` under the Host's own
Session Token. The television takes no input.

**The carousel frames needed a second game.** The Registry ships one, so the
Browsing Game Index has nowhere to go; `16` was taken with
`tools/carousel-transition-repro.patch` applied to both Registry lists *and
pushed to the Convex deployment*, since `browseGame` clamps the index
server-side. Both were reverted afterwards. `17` was taken on the unpatched
tree, which is why its footer shows a single page dot.

The numbers measured off both files — the cubic fit for the slide, the scale
curve for the spring, and the 10.00pt that still separates the greeting from the
focused card's shadow at the spring's peak — are in the "two handoff animations"
task in `docs/implementation-plan.md`.
