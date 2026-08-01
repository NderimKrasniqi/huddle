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
