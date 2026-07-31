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
